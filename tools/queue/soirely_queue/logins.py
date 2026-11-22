"""The Claude logins this machine's roles run under, and a new one started from `sq web`.

`claude auth status` says when each login runs out. A login started from the page is
`claude auth login` held open here: the page's own machine opens the sign-in in the Chrome
profile of the account, and the code comes back through Claude's own callback, through a
bridge on the page's machine when the login is held by the other one, or pasted."""

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

from . import machine

WARN_SECONDS = 3 * 86400
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
ACCOUNT_FILES = (".claude.json", "settings.json", ".credentials.json")
USAGE_SECONDS = 5 * 60
USAGE_LOOK_SECONDS = 30
USAGE_TIMEOUT = 60
USAGE_WARN = 90
USAGE_ARGV = ["claude", "-p", "/usage", "--output-format", "json", "--no-session-persistence",
              "--setting-sources", ""]
ESCAPES = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-z]")

_kept, _failed, _lock = {}, {}, threading.Lock()


def found(home=None):
    """The Claude config folders in the home folder, whether or not a role uses them:
    `~/.claude`, and each `~/.claude-*` holding an account file, settings or a login."""
    home = pathlib.Path.home() if home is None else home
    named = [home / ".claude"] if (home / ".claude").is_dir() else []
    return named + [path for path in sorted(home.glob(".claude-*")) if path.is_dir()
                    and any((path / name).exists() for name in ACCOUNT_FILES)]


def folders(config, home=None):
    """`{folder: [roles]}` for each Claude config folder on this machine: the ones its roles
    run under, then the rest of the home folder's, with no roles."""
    held, seen = {}, {}
    for role in config.get("roles") or {}:
        folder = machine.claude_dir(config, role)
        if folder:
            folder = seen.setdefault(folder.resolve(), folder)
            held.setdefault(folder, []).append(role)
    for folder in found(home):
        if folder.resolve() not in seen:
            seen[folder.resolve()] = folder
            held[folder] = []
    return held


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


def usage_env(folder, roles):
    """The environment a folder's workers run in, so the usage read is the account they
    spend. A folder no role uses has only its own token."""
    return machine.account_env(folder, spare=not roles)


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
            _failed.clear()
        else:
            _kept.pop(pathlib.Path(folder), None)
            _failed.pop(pathlib.Path(folder), None)


def read(config, run=subprocess.run, clock=time.monotonic, home=None):
    """One row per folder, each read again at most every `FRESH_SECONDS`, with the usage
    Claude last read for it."""
    rows = []
    for folder, names in folders(config, home).items():
        with _lock:
            at, said = _kept.get(folder, (None, None))
            failed = _failed.get(folder)
        if at is None or clock() - at >= FRESH_SECONDS:
            said = status(folder, run)
            with _lock:
                _kept[folder] = (clock(), said)
        token = machine.token_source(folder) if names else (
            machine.token_name(folder) if os.environ.get(machine.token_name(folder)) else None)
        rows.append(dict(said, folder=shown(folder), roles=names, token=token,
                         usage=cached_usage(folder), usage_error=failed))
    return rows


def cached_usage(folder):
    """The plan usage Claude last read for the folder's account, from the account file it
    keeps it in: `{"read_at", "limits": [{"name", "percent", "resets_at", "tone"}]}`."""
    try:
        said = json.loads(machine.account_file(folder).read_text())
    except (OSError, ValueError):
        return None
    kept = said.get("cachedUsageUtilization") if isinstance(said, dict) else None
    if not isinstance(kept, dict) or not isinstance(kept.get("utilization"), dict):
        return None
    account = (said.get("oauthAccount") or {}).get("accountUuid")
    if account and kept.get("accountUuid") and kept["accountUuid"] != account:
        return None
    read_at = kept.get("fetchedAtMs")
    return {"read_at": read_at / 1000 if isinstance(read_at, (int, float)) else None,
            "limits": limits_of(kept["utilization"])}


OLD_LIMITS = (("five_hour", "Session"), ("seven_day", "Week"), ("seven_day_opus", "Week · Opus"),
              ("seven_day_sonnet", "Week · Sonnet"))


def limits_of(utilization):
    """Each limit Claude reports, named as `/usage` names it, from its `limits` list or,
    from a Claude before it, its one field per limit."""
    listed = utilization.get("limits")
    if isinstance(listed, list):
        return [limit(limit_name(each), each.get("percent"), each.get("resets_at"),
                      each.get("severity")) for each in listed if isinstance(each, dict)]
    return [limit(name, utilization[key].get("utilization"), utilization[key].get("resets_at"))
            for key, name in OLD_LIMITS if isinstance(utilization.get(key), dict)]


def limit_name(each):
    kind, group = str(each.get("kind") or ""), str(each.get("group") or "")
    scope = each.get("scope") or {}
    named = ((scope.get("model") or {}).get("display_name") or scope.get("surface")
             if isinstance(scope, dict) else None)
    base = ("Session" if "session" in (kind + group) or "five_hour" in kind
            else "Week" if group == "weekly" or kind.startswith("weekly")
            else kind.replace("_", " ").capitalize() or "Limit")
    return f"{base} · {named}" if named else base


def limit(name, percent, resets_at, severity=None):
    percent = percent if isinstance(percent, (int, float)) else None
    tone = {"critical": "critical", "warning": "warning"}.get(severity) or (
        "" if percent is None else "critical" if percent >= USAGE_WARN
        else "warning" if percent >= 75 else "good")
    return {"name": name, "percent": percent, "tone": tone,
            "resets_at": when(resets_at) if resets_at else None}


def refresh_usage(folder, roles, run=subprocess.run, workdir=None):
    """Has the folder's Claude read its plan usage again, as `/usage` does: answered by
    Claude itself, with no model call, no hooks or settings loaded and no session kept,
    in a folder of sq's own. None once read, else why it was not."""
    workdir = workdir or pathlib.Path.home() / ".cache" / "soirely-usage"
    try:
        workdir.mkdir(mode=0o700, parents=True, exist_ok=True)
        answer = run(USAGE_ARGV, capture_output=True, text=True, timeout=USAGE_TIMEOUT,
                     cwd=workdir, env=usage_env(folder, roles), stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired) as error:
        return f"claude /usage failed ({error})"
    said = json_object(answer.stdout)
    if said is None:
        return (first_line(answer.stderr or answer.stdout)
                or f"claude /usage exited {answer.returncode}")
    if said.get("is_error") or said.get("local_command") != "usage":
        return first_line(said.get("result")) or "claude did not read its usage"
    return None


class Usage:
    """Keeps each folder's usage at most `USAGE_SECONDS` old, behind `sq web`, one folder at a
    time, so the page never waits on it."""

    def __init__(self, config, run=subprocess.run, clock=time.time, home=None, workdir=None):
        self.config, self.run, self.clock = config, run, clock
        self.home, self.workdir, self.tried = home, workdir, {}

    def once(self):
        for folder, roles in folders(self.config(), self.home).items():
            said = cached_usage(folder)
            now = self.clock()
            if said and said["read_at"] and now - said["read_at"] < USAGE_SECONDS:
                with _lock:
                    _failed.pop(folder, None)
                continue
            if now - self.tried.get(folder, float("-inf")) < USAGE_SECONDS:
                continue
            self.tried[folder] = now
            failed = refresh_usage(folder, roles, self.run, self.workdir)
            with _lock:
                _failed[folder] = failed

    def keep(self, wait=time.sleep):
        while True:
            try:
                self.once()
            except Exception as error:  # noqa: BLE001 — the page outlives a bad read
                print(f"sq web: usage not read ({error})", file=sys.stderr)
            wait(USAGE_LOOK_SECONDS)

    def start(self):
        threading.Thread(target=self.keep, name="usage", daemon=True).start()


def left(seconds):
    if seconds < 3600:
        return f"{max(int(seconds // 60), 0)} min"
    if seconds < 2 * 86400:
        return f"{int(seconds // 3600)} h"
    return f"{int(seconds // 86400)} days"


def warnings(rows, now):
    """A line for each login that has run out or runs out within `WARN_SECONDS`."""
    found = []
    for row in rows:
        if not row["roles"]:
            continue
        who = f"{row.get('email') or row['folder']} ({', '.join(row['roles'])})"
        for each in (row.get("usage") or {}).get("limits") or []:
            resets = each.get("resets_at")
            if (each.get("percent") or 0) >= USAGE_WARN and (resets is None or resets > now):
                found.append(f"the Claude account {who} has used {each['percent']:g}% of its "
                             f"{each['name'].lower()} limit"
                             + (f": it resets in {left(resets - now)}" if resets else ""))
        if row.get("token"):
            continue
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
                 clock=time.monotonic, wait=time.sleep, timer=threading.Timer, home=None):
        self.config, self.popen, self.run, self.clock, self.wait = config, popen, run, clock, wait
        self.timer, self.home = timer, home
        self.held, self.lock = {}, threading.Lock()

    def folder(self, asked):
        """The folder asked for, only when it is one the page lists: a folder this machine's
        roles run under, or one of the home folder's no role uses."""
        for folder in folders(self.config(), self.home):
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
