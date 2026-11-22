"""The Claude logins this machine's roles run under, and a new one started from `sq web`.

`claude auth status` says when each login runs out, and `claude -p /usage` how much of
each of the account's limits is used. A login started from the page is
`claude auth login` held open here: the page's own machine opens the sign-in in the Chrome
profile of the account, and the code comes back through Claude's own callback, through a
bridge on the page's machine when the login is held by the other one, or pasted."""

import concurrent.futures
import datetime
import http.client
import http.server
import json
import os
import pathlib
import re
import secrets
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse

from . import machine, store

WARN_SECONDS = 3 * 86400
USAGE_SECONDS = 5 * 60
USAGE_WARN = 90
USAGE_AT_ONCE = 3
USAGE_TIMEOUT = 60
USAGE_KEY = "claude_usage"
NO_HOOKS = '{"disableAllHooks": true}'
LIMIT = re.compile(r"^Current (?P<name>.+?):\s*(?P<used>\d+(?:\.\d+)?)% used"
                   r"(?:\s*·\s*resets (?P<resets>.+))?$")
FRESH_SECONDS = 60
LINK_SECONDS = 20
OPEN_SECONDS = 15 * 60
KEPT_SECONDS = 10 * 60
CALLBACK_SECONDS = 30
OUTPUT_MOST = 64 * 1024
CHROMES = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
DESKTOP = ("DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR",
           "DBUS_SESSION_BUS_ADDRESS")
LINK = re.compile(r"https://\S+/oauth/authorize\S*")
PROMPT = "Paste code here if prompted >"
QUIET = ("Opening browser", "If the browser didn't open")
ESCAPES = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-z]")

_kept, _lock = {}, threading.Lock()


def home_folders(home=None):
    """`~/.claude` and each `~/.claude-*` holding a Claude account file or settings."""
    home = pathlib.Path.home() if home is None else home
    found = []
    for folder in [home / ".claude"] + sorted(home.glob(".claude-*")):
        account = home / ".claude.json" if folder.name == ".claude" else folder / ".claude.json"
        if folder.is_dir() and (account.is_file() or (folder / "settings.json").is_file()):
            found.append(folder)
    return found


def folders(config, home=None):
    """`{folder: [roles]}` for each Claude config folder this machine's roles run under,
    then each other one in the home folder, which no role uses."""
    found = {}
    for role in config.get("roles") or {}:
        folder = machine.claude_dir(config, role)
        if folder:
            found.setdefault(folder, []).append(role)
    used = {folder.resolve() for folder in found}
    for folder in home_folders(home):
        if folder.resolve() not in used:
            found[folder] = []
    return found


def shown(folder):
    home = pathlib.Path.home()
    return f"~/{folder.relative_to(home)}" if folder.is_relative_to(home) else str(folder)


def login_env(folder, base=None):
    """The folder's own login, as `claude auth` reads it: no token, which would stand in
    front of the login it is asked about."""
    env = {key: value for key, value in (os.environ if base is None else base).items()
           if not key.startswith(machine.TOKEN)}
    env.pop("CLAUDE_CONFIG_DIR", None)
    if not machine.is_claude_default(folder):
        env["CLAUDE_CONFIG_DIR"] = str(folder)
    return env


def when(stamp):
    try:
        return datetime.datetime.fromisoformat(str(stamp).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def status(folder, run=subprocess.run):
    """`claude auth status` for the folder: who is logged in and when the login runs out."""
    try:
        answer = run(["claude", "auth", "status"], capture_output=True, text=True, timeout=20,
                     env=login_env(folder))
        said = json_object(answer.stdout)
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"error": f"claude auth status failed ({error})"}
    if said is None:
        return {"error": first_line(answer.stderr or answer.stdout)
                or f"claude auth status exited {answer.returncode}"}
    expires = said.get("loginExpiresAt")
    return {"email": said.get("email"), "logged_in": bool(said.get("loggedIn")),
            "expires_at": when(expires) if expires else None,
            "plan": said.get("planTier") or said.get("subscriptionType")}


def json_object(text):
    try:
        found = json.loads(text or "")
    except ValueError:
        return None
    return found if isinstance(found, dict) else None


def first_line(text):
    lines = [line.strip() for line in ESCAPES.sub("", text or "").splitlines() if line.strip()]
    return lines[0] if lines else ""


def forget(folder=None):
    with _lock:
        if folder is None:
            _kept.clear()
        else:
            _kept.pop(pathlib.Path(folder), None)


def limits(text):
    """Each limit `/usage` reports: its name, the percent used and when it resets."""
    found = []
    for line in (text or "").splitlines():
        match = LIMIT.match(line.strip())
        if match:
            found.append({"name": match["name"], "used": float(match["used"]),
                          "resets": (match["resets"] or "").strip() or None})
    return found


def usage(folder, run=subprocess.run):
    """What `/usage` says of the folder's account: no model call, none of its hooks, no
    session kept, and its own login rather than a token."""
    with tempfile.TemporaryDirectory(prefix="sq-usage-") as workdir:
        try:
            answer = run(["claude", "-p", "/usage", "--output-format", "json",
                          "--no-session-persistence", "--settings", NO_HOOKS],
                         capture_output=True, text=True, timeout=USAGE_TIMEOUT, cwd=workdir,
                         stdin=subprocess.DEVNULL, env=login_env(folder))
        except (OSError, subprocess.TimeoutExpired) as error:
            return {"error": f"claude -p /usage failed ({error})"}
    said = json_object(answer.stdout)
    if said is None:
        return {"error": first_line(answer.stderr or answer.stdout)
                or f"claude -p /usage exited {answer.returncode}"}
    found = limits(said.get("result"))
    if said.get("is_error") or not found:
        return {"error": first_line(said.get("result")) if said.get("is_error")
                else "Claude reported no plan limits for this account"}
    return {"limits": found}


def refresh_usage(db, config, now, read_usage=None):
    """Reads `/usage` again for each folder last read `USAGE_SECONDS` ago or more, a few at
    a time, into the database the page and `sq status` read."""
    read_usage = read_usage or usage
    kept = store.get_meta(db, USAGE_KEY) or {}
    stale = [folder for folder in folders(config)
             if now - (kept.get(str(folder)) or {}).get("at", 0) >= USAGE_SECONDS]
    if not stale:
        return kept
    with concurrent.futures.ThreadPoolExecutor(USAGE_AT_ONCE) as pool:
        for folder, said in zip(stale, pool.map(read_usage, stale)):
            kept[str(folder)] = dict(said, at=now)
    known = {str(folder) for folder in folders(config)}
    kept = {folder: said for folder, said in kept.items() if folder in known}
    store.set_meta(db, USAGE_KEY, kept)
    return kept


def read(config, run=subprocess.run, clock=time.monotonic, used=None):
    """One row per folder, each read again at most every `FRESH_SECONDS`, with the usage
    last read into `used`."""
    rows = []
    for folder, names in folders(config).items():
        with _lock:
            at, said = _kept.get(folder, (None, None))
        if at is None or clock() - at >= FRESH_SECONDS:
            said = status(folder, run)
            with _lock:
                _kept[folder] = (clock(), said)
        token = machine.token_source(folder)
        rows.append(dict(said, folder=shown(folder), roles=names, token=token,
                         usage=(used or {}).get(str(folder))))
    return rows


def left(seconds):
    if seconds < 3600:
        return f"{max(int(seconds // 60), 0)} min"
    if seconds < 2 * 86400:
        return f"{int(seconds // 3600)} h"
    return f"{int(seconds // 86400)} days"


def warnings(rows, now):
    """A line for each login a role uses that has run out or runs out within
    `WARN_SECONDS`, and for each of its limits used `USAGE_WARN` percent or more."""
    found = []
    for row in rows:
        if not row["roles"]:
            continue
        who = f"{row.get('email') or row['folder']} ({', '.join(row['roles'])})"
        for limit in (row.get("usage") or {}).get("limits") or []:
            if limit["used"] >= USAGE_WARN:
                found.append(f"the Claude account {who} has used {limit['used']:g}% of its "
                             f"{limit['name']} limit"
                             + (f": it resets {limit['resets']}" if limit["resets"] else ""))
        if row.get("token"):
            continue
        who = f"{row.get('email') or row['folder']} ({', '.join(row['roles'])})"
        if row.get("error"):
            found.append(f"the Claude login of {who} could not be read: {row['error']}")
        elif not row.get("logged_in"):
            found.append(f"{row['folder']} has no Claude login for {', '.join(row['roles'])}: "
                         "log in from Claude logins on sq web")
        elif row.get("expires_at") is not None and row["expires_at"] - now < WARN_SECONDS:
            gone = row["expires_at"] <= now
            found.append(f"the Claude login of {who} "
                         + ("has run out" if gone else
                            f"runs out in {left(row['expires_at'] - now)}")
                         + ": log in again from Claude logins on sq web")
    return found


def callback_of(link):
    """`(port, path)` of the localhost address a sign-in link sends its code to, or None."""
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(link or "").query)
    target = urllib.parse.urlsplit((query.get("redirect_uri") or [""])[0])
    if target.hostname not in ("localhost", "127.0.0.1") or not target.port:
        return None
    return target.port, target.path or "/"


class Login:
    """One `claude auth login` for a folder, held until it ends or `OPEN_SECONDS` pass."""

    def __init__(self, folder, email, process, workdir, clock=time.monotonic):
        self.id = secrets.token_urlsafe(16)
        self.folder, self.email, self.process, self.workdir = folder, email, process, workdir
        self.clock, self.started, self.output, self.ended = clock, clock(), "", None
        self.lock = threading.Lock()

    def link(self):
        """The link Claude prints for a browser elsewhere: its page shows a code to paste."""
        with self.lock:
            found = LINK.search(ESCAPES.sub("", self.output))
        return found.group(0) if found else None

    def direct(self):
        """The link Claude would open in a browser here, whose code comes back by itself."""
        try:
            return (self.workdir / "link").read_text().strip() or None
        except OSError:
            return None

    def said(self):
        """What Claude last said, past its own prompts: a refused code, or why it stopped."""
        with self.lock:
            text = ESCAPES.sub("", self.output)
        lines = [line.rpartition(PROMPT)[2].strip() for line in text.splitlines()]
        lines = [line for line in lines
                 if line and not LINK.search(line) and not line.startswith(QUIET)]
        return lines[-1] if lines else ""

    def keep_reading(self):
        stream = self.process.stdout
        while True:
            chunk = stream.read1(4096) if hasattr(stream, "read1") else stream.read(4096)
            if not chunk:
                return
            with self.lock:
                self.output = (self.output + chunk.decode(errors="replace"))[-OUTPUT_MOST:]

    def answer(self):
        """What the page shows: the links, what Claude last said, and how it ended."""
        return {"id": self.id, "folder": shown(self.folder), "email": self.email,
                "link": self.link(), "direct": self.direct(), "said": self.said(),
                "ended": self.ended}


class Desk:
    """The logins this machine holds, by id: at most one per folder."""

    def __init__(self, config, popen=subprocess.Popen, run=subprocess.run,
                 clock=time.monotonic, wait=time.sleep, timer=threading.Timer):
        self.config, self.popen, self.run, self.clock, self.wait = config, popen, run, clock, wait
        self.timer = timer
        self.held, self.lock = {}, threading.Lock()

    def folder(self, asked):
        """The folder asked for, only when it is one this machine's roles run under."""
        for folder in folders(self.config()):
            if asked in (shown(folder), str(folder)):
                return folder
        return None

    def start(self, folder):
        """Starts the login and waits until Claude has printed its link."""
        self.tidy()
        with self.lock:
            for login in [h for h in self.held.values() if h.folder == folder and not h.ended]:
                self.end(login, {"state": "cancelled", "message": "a new login replaced it"})
        email = status(folder, self.run).get("email")
        workdir = pathlib.Path(tempfile.mkdtemp(prefix="sq-login-"))
        opener = workdir / "open"
        opener.write_text(f"#!/bin/sh\nprintf '%s\\n' \"$1\" > {shlex.quote(str(workdir))}/link\n")
        opener.chmod(0o700)
        argv = ["claude", "auth", "login"] + (["--email", email] if email else [])
        process = self.popen(argv, env=dict(login_env(folder), BROWSER=str(opener)),
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, start_new_session=True)
        login = Login(folder, email, process, workdir, self.clock)
        threading.Thread(target=login.keep_reading, daemon=True).start()
        with self.lock:
            self.held[login.id] = login
        ending = self.timer(OPEN_SECONDS, self.expire, [login])
        ending.daemon = True
        ending.start()
        deadline = self.clock() + LINK_SECONDS
        while self.clock() < deadline and process.poll() is None \
                and not (login.link() and login.direct()):
            self.wait(0.1)
        self.check(login)
        if not login.ended and not login.link():
            self.end(login, {"state": "failed",
                             "message": login.said() or "claude printed no sign-in link"})
        return login

    def get(self, login_id):
        self.tidy()
        with self.lock:
            login = self.held.get(login_id)
        if login:
            self.check(login)
        return login

    def check(self, login):
        """Notes how a login that has finished ended, and reads its folder again."""
        if login.ended or login.process.poll() is None:
            return
        if login.process.returncode != 0:
            return self.end(login, {"state": "failed", "message": login.said()
                                    or f"claude auth login exited {login.process.returncode}"})
        forget(login.folder)
        now = status(login.folder, self.run)
        got = now.get("email")
        if login.email and got and got.lower() != login.email.lower():
            return self.end(login, {"state": "wrong account", "email": got,
                                    "expires_at": now.get("expires_at"),
                                    "message": f"logged in as {got}, not {login.email}"})
        return self.end(login, {"state": "done", "email": got,
                                "expires_at": now.get("expires_at")})

    def paste(self, login, code):
        """Hands Claude the code its sign-in page showed."""
        if login.ended or login.process.poll() is not None:
            return False
        try:
            login.process.stdin.write((code.strip() + "\n").encode())
            login.process.stdin.flush()
        except OSError:
            return False
        return True

    def callback(self, login, query):
        """Hands Claude's own callback the code a browser elsewhere was sent back with.
        `(status, location, body)` of Claude's answer, for that browser."""
        found = callback_of(login.direct())
        if login.ended or not found:
            return 409, None, b"This login is no longer waiting."
        port, path = found
        connection = http.client.HTTPConnection("localhost", port, timeout=CALLBACK_SECONDS)
        try:
            connection.request("GET", f"{path}?{query}")
            answer = connection.getresponse()
            return answer.status, answer.getheader("Location"), answer.read(OUTPUT_MOST)
        except OSError as error:
            return 502, None, f"Claude's callback did not answer ({error})".encode()
        finally:
            connection.close()

    def cancel(self, login):
        self.end(login, {"state": "cancelled", "message": "cancelled"})

    def expire(self, login):
        self.end(login, {"state": "failed", "message": "nobody signed in in time"})

    def end(self, login, how):
        if login.ended:
            return
        login.ended = how
        if login.process.poll() is None:
            try:
                os.killpg(login.process.pid, signal.SIGTERM)
            except OSError:
                login.process.terminate()
        shutil.rmtree(login.workdir, ignore_errors=True)

    def tidy(self):
        now = self.clock()
        with self.lock:
            held = list(self.held.values())
        for login in held:
            if not login.ended and now - login.started >= OPEN_SECONDS:
                self.expire(login)
            elif login.ended and now - login.started >= OPEN_SECONDS + KEPT_SECONDS:
                with self.lock:
                    self.held.pop(login.id, None)


def desktop_env(environ=None, run=subprocess.run):
    """The environment with the desktop session's display: a systemd user service starts
    without one, and its manager usually has it."""
    env = dict(os.environ if environ is None else environ)
    if env.get("DISPLAY") or env.get("WAYLAND_DISPLAY"):
        return env
    try:
        found = run(["systemctl", "--user", "show-environment"], capture_output=True,
                    text=True, timeout=5).stdout
    except (OSError, subprocess.TimeoutExpired):
        return env
    for line in found.splitlines():
        key, _, value = line.partition("=")
        if key in DESKTOP and key not in env:
            env[key] = value
    return env


def chrome_argv(email, url, config, system=None, which=shutil.which):
    """How to open `url` in the Chrome profile of `email`, or None. `chromeProfiles` in
    agents.json names the profile folder of an account Chrome is not signed in to."""
    profile = (config.get("chromeProfiles") or {}).get(email) if email else None
    if not (profile or email):
        return None
    choose = f"--profile-directory={profile}" if profile else f"--profile-email={email}"
    if (system or sys.platform) == "darwin":
        return ["open", "-na", "Google Chrome", "--args", choose, url]
    binary = next((found for name in CHROMES if (found := which(name))), None)
    return [binary, choose, url] if binary else None


def open_chrome(email, url, config, system=None, which=shutil.which, popen=subprocess.Popen,
                environ=None, run=subprocess.run, wait=time.sleep):
    """Opens the link on this machine in the account's Chrome profile. False when there is
    no Chrome, no profile to name, or no desktop to open it on."""
    argv = chrome_argv(email, url, config, system, which)
    if not argv:
        return False
    env = desktop_env(environ, run)
    if (system or sys.platform) != "darwin" and not (env.get("DISPLAY")
                                                     or env.get("WAYLAND_DISPLAY")):
        return False
    try:
        process = popen(argv, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL, start_new_session=True)
    except OSError:
        return False
    for _ in range(20):
        if process.poll() is not None:
            return process.returncode == 0
        wait(0.1)
    return True


class Bridge:
    """Claude's callback port, opened on the machine whose browser signs in and passed on
    to the machine holding the login: the browser is sent back to localhost, which is this
    machine and not that one. `forward(query)` returns Claude's `(status, location, body)`."""

    def __init__(self, port, path, forward, seconds=OPEN_SECONDS):
        bridge = self

        class Callback(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                asked, _, query = self.path.partition("?")
                if asked != path:
                    return self.send_error(404)
                status, location, body = forward(query)
                self.send_response(status)
                if location:
                    self.send_header("Location", location)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body or b"")))
                self.end_headers()
                self.wfile.write(body or b"")
                if status < 400:
                    threading.Thread(target=bridge.close, daemon=True).start()
                return None

            def log_message(self, *_):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Callback)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.timer = threading.Timer(seconds, self.close)
        self.timer.daemon = True
        self.timer.start()

    def close(self):
        self.timer.cancel()
        self.server.shutdown()
        self.server.server_close()


def bridge(link, forward, seconds=OPEN_SECONDS):
    """A `Bridge` for the link's callback port, or None when the link has none or the port
    is taken here."""
    found = callback_of(link)
    if not found:
        return None
    try:
        return Bridge(found[0], found[1], forward, seconds)
    except OSError:
        return None
