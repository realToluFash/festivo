"""What `sq status` prints and `sq web` draws: one reading of this machine's manager, its
roles, the other machines and what the workers cost. The page is served on 127.0.0.1 only
and reads the same snapshot every few seconds."""

import datetime
import http.server
import json
import pathlib
import shutil
import threading
import time
import urllib.parse
import webbrowser

from . import (drawing, leftovers, local, logins, machine, permissions, remote, roles, runlog,
               runner, sessions, store)

PAGE = pathlib.Path(__file__).with_name("dashboard.html")
RECENT = 20
NEXT = 5
# Asked of a peer, so two machines settling with each other never ask in a circle.
OWN = "status.json?own=1"
# A reading takes a second or more, and every open page and every peer asks for one every few
# seconds: without these, two machines' pages slow each other past the peers' time limit.
SHARED_SECONDS = 3
ASK_SECONDS = 10
# Long enough for a reading told once a minute to last until the next.
KEPT_SECONDS = 150
TOLD = "peer.json"
TOLD_MOST_BYTES = 1 << 20
ASKED_MOST_BYTES = 64 << 10
# Starting a role starts its stack, which Docker can take a minute or two over.
CONTROL_SECONDS = 180


def first_line(text):
    lines = (text or "").strip().splitlines()
    return lines[0] if lines else ""


def run_view(entry):
    return {"at": entry.get("at"), "role": entry.get("role"), "worker": entry.get("worker"),
            "cost": entry.get("cost_usd") or 0, "exit": entry.get("exit"),
            "stopped": entry.get("stopped"), "item": entry.get("item"),
            "seconds": (entry.get("duration_ms") or 0) // 1000 or None,
            "model": entry.get("model"), "effort": entry.get("effort"),
            "session": entry.get("session"), "report": first_line(entry.get("report")),
            "failed": bool(entry.get("stopped") or entry.get("is_error")
                           or entry.get("exit") not in (0, None))}


def drawing_view(db):
    current = store.get_meta(db, "drawing")
    tries = store.get_meta(db, "draw_tries") or {}
    return {"current": current, "tries": tries, "max_tries": drawing.MAX_TRIES}


def spend(home, days, today=None):
    today = today or datetime.date.today()
    found = []
    for back in range(days - 1, -1, -1):
        on = today - datetime.timedelta(days=back)
        per_role = {r: v for r, v in runlog.spent(home, roles.ROLES, on).items() if v}
        found.append({"day": on.isoformat(), "total": sum(per_role.values()),
                      "roles": per_role})
    return found


def snapshot(db, platform, now, home, load=machine.load):
    synced_at = store.get_meta(db, "synced_ok_at")
    view = {"now": now, "synced_ago": now - synced_at if synced_at else None,
            "errors": [f"sync: {e}" for e in store.get_meta(db, "sync_errors") or []],
            "warnings": [], "machine": None, "manager": platform.timer_active(),
            "paused": runner.paused(db), "paused_everywhere": None, "machines": [],
            "peers": [], "roles": [],
            "elsewhere": [], "recent": [], "spend": spend(home, 7), "drawings": store.drawings(db),
            "drawing": drawing_view(db), "logins": []}
    try:
        config = load()
    except machine.ConfigError as error:
        config = None
        view["errors"].append(str(error))
    shown, accounts = set(), {}
    if config:
        problems, refused, ready = machine.check(config)
        view["machine"] = config.get("machine") or "this machine"
        view["peers"] = sorted(remote.peers(config))
        view["warnings"] += remote.problems(config) + machine.tester_problems(config)
        view["warnings"] += [f"a run that ended left {leftovers.describe(left)}"
                             for left in leftovers.ended(home)]
        view["warnings"] += [f"task output past 1 GB: {path} ({local.amount(size)})"
                             for path, size in leftovers.oversized()]
        view["free_gb"] = round(machine.free_gb(config))
        view["litter"] = local.measure_litter(config, False)
        view["errors"] += problems
        late = runner.drift(config, (store.get_meta(db, "claude_version") or {}).get("version"))
        if late:
            view["warnings"].append(late)
        search = getattr(platform, "search_path", None)
        node = search and shutil.which("node", path=search())
        if search and not node:
            wanted = machine.wanted_node(config) or "22"
            view["warnings"].append("workers have no node: install nvm with a default alias "
                                    f"(nvm alias default {wanted}), or node on the PATH")
        behind = node and machine.node_behind(config, node)
        if behind:
            view["warnings"].append(behind)
        on = runner.started(db)
        agreed = store.get_meta(db, "shared_view") or {}
        unreachable = store.get_meta(db, "shared_unreachable")
        if unreachable:
            view["warnings"].append(f"could not reach the shared leases ({unreachable})")
        view["paused_everywhere"] = agreed.get("paused")
        if agreed.get("paused"):
            view["warnings"].append(f"paused everywhere by {agreed['paused'].get('machine')}: "
                                    "sq resume --everywhere")
        for role, other in agreed.get("conflicts") or []:
            view["warnings"].append(f"{role} is listed here and on {other}, and neither marks "
                                    "it standby; only one runs it")
        pending = permissions.pending(home)
        if pending:
            view["warnings"].append(f"permissions: main grants {len(pending)} change(s) this "
                                    "machine has not applied: just agents permissions apply")
        view["machines"] = [{"name": name, "seen": seen["seen"], "started": seen["started"]}
                            for name, seen in sorted((agreed.get("machines") or {}).items())]
        view["logins"] = logins.read(config)
        view["warnings"] += logins.warnings(view["logins"], now)
        accounts = {role: machine.account(machine.claude_dir(config, role)) for role in ready}
        if "ux" in ready:
            folder = machine.claude_dir(config, "ux")
            view["drawing"]["config_dir"] = None if machine.is_claude_default(folder) \
                else str(folder)
        listed = config.get("roles") or {}
        for role in [r for r in refused if r not in listed] + list(listed):
            if role in refused:
                view["roles"].append({"role": role, "state": "refused",
                                      "detail": refused[role]})
                continue
            if role not in ready:
                continue
            held, waiting = store.held_by(db, role, now), store.waiting(db, role)
            away = (agreed.get("elsewhere") or {}).get(role)
            names = machine.worker_names(role, ready[role].get("workers"))
            running = sum(1 for name in names if platform.worker_active(name))
            holding = [dict(worker=name, id=h["id"], reason=h["reason"])
                       for name in names if (h := store.held_by(db, role, now, name))]
            live = [{"worker": name, "session": run["session"], "at": run.get("at")}
                    for name in names if platform.worker_active(name)
                    and (run := sessions.current(db, name))]
            state, detail = ("running", None) if running else \
                ("elsewhere", {"machine": away[0], "seen": away[1]}) if role in on and away \
                else ("busy", None) if held else \
                ("started", None) if role in on else ("stopped", None)
            last = runlog.last(home, role)
            owner = store.get_meta(db, f"owner:{role}")
            artifact = store.get_meta(db, f"artifact:{role}")
            prompt = store.get_meta(db, f"prompt:{role}") or {}
            prompt = prompt if prompt.get("at") else None
            if prompt and state != "running":
                state = "prompt"
            view["roles"].append({
                "role": role, "state": state, "detail": detail,
                "model": ready[role]["model"], "effort": ready[role]["effort"],
                "account": accounts[role],
                "wake_every": ready[role].get("wakeEvery"),
                "workers": len(names), "running": running,
                "last": run_view(last) if last else None,
                "held": {"id": held["id"], "reason": held["reason"]} if held else None,
                "holding": holding if len(names) > 1 else [],
                "sessions": live,
                "waiting": len(waiting),
                "next": [{"id": w["id"], "reason": w["reason"]} for w in waiting[:NEXT]],
                "note": machine.price_note(role, ready[role]["model"], config),
                "owner": owner["lines"][0] if owner else None,
                "artifact": artifact, "prompt": prompt})
            shown.add(role)
    for role in roles.ROLES:
        if role in shown:
            continue
        held, waiting = store.held_by(db, role, now), store.waiting(db, role)
        if held or waiting:
            view["elsewhere"].append({
                "role": role, "waiting": len(waiting),
                "held": {"id": held["id"], "reason": held["reason"]} if held else None,
                "next": [{"id": w["id"], "reason": w["reason"]} for w in waiting[:NEXT]]})
    runs = [e for role in roles.ROLES for e in runlog.entries(home, role) if e.get("at")]
    view["recent"] = [dict(run_view(e), account=accounts.get(e.get("role")))
                      for e in sorted(runs, key=lambda e: -e["at"])[:RECENT]]
    today = datetime.date.today()
    view["runs_today"] = sum(1 for e in runs if runlog.day(e["at"]) == today)
    return view


def own_view(base, secret, fetch=remote.fetch):
    """A peer's own reading of itself, or None when it does not give one."""
    status, body = fetch(base, OWN, secret)
    try:
        view = json.loads(body) if status == 200 else None
    except ValueError:
        return None
    return view if isinstance(view, dict) else None


def peer_views(peers, secret, fetch=remote.fetch):
    """Each peer's own reading by name, asked all at once and waited for; a peer that does
    not answer is left out."""
    found = {}

    def ask(name, base):
        view = own_view(base, secret, fetch)
        if view is not None:
            found[name] = view

    asking = [threading.Thread(target=ask, args=peer, daemon=True) for peer in peers.items()]
    for thread in asking:
        thread.start()
    for thread in asking:
        thread.join()
    return found


class PeerViews:
    """The same for the page, which is read every few seconds and waits for no peer: a call
    asks again behind it, each peer at most every `ASK_SECONDS`, and returns the answers
    already in, while they are fresh."""

    def __init__(self, peers, secret, fetch=remote.fetch):
        self.peers, self.secret, self.fetch = peers, secret, fetch
        self.kept, self.asked, self.asking, self.lock = {}, {}, set(), threading.Lock()

    def ask(self, name, base):
        try:
            view = own_view(base, self.secret, self.fetch)
            if view is not None:
                with self.lock:
                    self.kept[name] = (time.monotonic(), view)
        finally:
            with self.lock:
                self.asking.discard(name)

    def keep(self, name, view):
        with self.lock:
            self.kept[name] = (time.monotonic(), view)

    def views(self):
        peers = self.peers()
        with self.lock:
            now = time.monotonic()
            unasked = [name for name in peers if name not in self.asking
                       and now - self.asked.get(name, -ASK_SECONDS) >= ASK_SECONDS]
            self.asking.update(unasked)
            self.asked.update(dict.fromkeys(unasked, now))
            fresh = {name: view for name, (at, view) in self.kept.items()
                     if name in peers and now - at < KEPT_SECONDS}
        for name in unasked:
            threading.Thread(target=self.ask, args=(name, peers[name]), daemon=True).start()
        return fresh


def tell(view, peers, secret, send=remote.send):
    """Sends this machine's own reading to each peer's page, all at once. A machine whose
    page may not open a connection to the others, as macOS can refuse a background Python,
    still takes one from them, so its counts come this way."""
    body = json.dumps(view).encode()
    path = f"{TOLD}?from={urllib.parse.quote(view.get('machine') or '')}"
    telling = [threading.Thread(target=send, args=(base, path, secret, body), daemon=True)
               for base in peers.values()]
    for thread in telling:
        thread.start()
    for thread in telling:
        thread.join()


def settle(view, others):
    """Counts a role another machine runs as that machine does. This one never hears what
    was finished there, so its own queue for the role only grows; when that machine does
    not answer, the count is unknown rather than this one's."""
    theirs = {}
    for name, other in others.items():
        for row in other.get("roles") or []:
            if row.get("state") not in ("refused", "elsewhere"):
                theirs.setdefault(row["role"], (name, row))
    unread = {role: seen["name"] for seen in view.get("machines") or []
              if seen["name"] not in others for role in seen["started"]}

    def counted(row, name):
        if name in others and theirs.get(row["role"], (None,))[0] == name:
            there = theirs[row["role"]][1]
            return dict(row, waiting=there.get("waiting") or 0, next=there.get("next") or [],
                        held=there.get("held"), counted_on=name)
        if name and name not in others:
            return dict(row, waiting=None, next=[], held=None, counted_on=name)
        return row

    if "roles" in view:
        view["roles"] = [counted(row, (row.get("detail") or {}).get("machine"))
                         if row.get("state") == "elsewhere" else row for row in view["roles"]]
    if "elsewhere" in view:
        away = [counted(row, theirs.get(row["role"], (unread.get(row["role"]),))[0])
                for row in view["elsewhere"]]
        view["elsewhere"] = [row for row in away
                             if row["held"] or row["waiting"] or row["waiting"] is None]
    if "logins" in view:
        view["peer_logins"] = {name: other.get("logins") or [] for name, other in others.items()}
    return view


def relay(answer):
    """A peer's `(status, body)` as `(status, dict)`."""
    status, body = answer
    try:
        said = json.loads(body)
    except ValueError:
        said = None
    return status, said if isinstance(said, dict) else {"error": f"it answered {status}"}


class LoginDoor:
    """The page's Claude logins: this machine's own, held by `desk`, and the other
    machines', asked of them. Only a page looked at on this machine has its sign-in opened
    in Chrome, since this machine's Chrome is the only one it can open."""

    def __init__(self, desk, config, peers, secret, fetch=remote.fetch, post=remote.post,
                 opener=logins.open_chrome, bridge=logins.bridge):
        self.desk, self.config, self.peers, self.secret = desk, config, peers, secret
        self.fetch, self.post, self.opener, self.bridge = fetch, post, opener, bridge
        self.bridges = {}

    def state(self, name, login_id):
        if name:
            base = self.peers().get(name)
            if not base:
                return 404, {"error": f"no machine called {name}"}
            return relay(self.fetch(base, "login/state?id=" + urllib.parse.quote(login_id),
                                    self.secret))
        login = self.desk.get(login_id)
        return (200, login.answer()) if login else (404, {"error": "no such login"})

    def act(self, path, asked, here):
        name = asked.get("machine") or ""
        if name:
            return self.elsewhere(name, path, asked, here)
        if path == "/login/start":
            folder = self.desk.folder(str(asked.get("folder") or ""))
            if not folder:
                return 404, {"error": "no role on this machine runs under that folder"}
            said = self.desk.start(folder).answer()
            if here and not asked.get("for_peer"):
                self.open(said)
            return 200, said
        login = self.desk.get(str(asked.get("id") or ""))
        if not login:
            return 404, {"error": "no such login"}
        if path == "/login/callback":
            status, location, body = self.desk.callback(login, str(asked.get("query") or ""))
            return 200, {"status": status, "location": location,
                         "body": body.decode(errors="replace")}
        if path == "/login/code":
            self.desk.paste(login, str(asked.get("code") or ""))
        elif path == "/login/cancel":
            self.desk.cancel(login)
        else:
            return 404, {"error": "no such step"}
        self.desk.check(login)
        return 200, login.answer()

    def elsewhere(self, name, path, asked, here):
        base = self.peers().get(name)
        if not base:
            return 404, {"error": f"no machine called {name}"}
        if path == "/login/start":
            status, said = relay(self.post(base, "login/start", self.secret,
                                           json.dumps({"folder": asked.get("folder"),
                                                       "for_peer": True}).encode(),
                                           timeout=logins.LINK_SECONDS + 10))
            if status == 200 and here:
                self.open(said, base)
            return status, said
        if path not in ("/login/code", "/login/cancel"):
            return 404, {"error": "no such step"}
        if path == "/login/cancel" and (bridged := self.bridges.pop(asked.get("id"), None)):
            bridged.close()
        return relay(self.post(base, path[1:], self.secret,
                               json.dumps({key: asked.get(key) for key in ("id", "code")}).encode(),
                               timeout=logins.CALLBACK_SECONDS))

    def open(self, said, base=None):
        """Opens the sign-in in this machine's Chrome: Claude's own link while its callback
        can come back, through a bridge to `base` when the login is held there; otherwise
        the link whose page shows a code to paste."""
        said["opened"] = None
        if said.get("ended"):
            return
        direct, made = said.get("direct"), None
        if direct and base:
            made = self.bridge(direct, lambda query: self.forward(base, said["id"], query))
            direct = direct if made else None
        url = direct or said.get("link")
        if url and self.opener(said.get("email"), url, self.config()):
            said["opened"] = "direct" if url == direct else "link"
            if made:
                self.bridges[said["id"]] = made
        elif made:
            made.close()

    def forward(self, base, login_id, query):
        status, said = relay(self.post(base, "login/callback", self.secret,
                                       json.dumps({"id": login_id, "query": query}).encode(),
                                       timeout=logins.CALLBACK_SECONDS + 5))
        if status != 200:
            return 502, None, (said.get("error") or "the other machine did not answer").encode()
        return said.get("status") or 502, said.get("location"), (said.get("body") or "").encode()


class ControlDoor:
    """The page's pause, resume, start and stop: done here by `here`, or asked of the
    machine the page names, whose own page does it."""

    def __init__(self, here, peers, secret, post=remote.post):
        self.here, self.peers, self.secret, self.post = here, peers, secret, post

    def act(self, asked, by):
        action, role = str(asked.get("action") or ""), asked.get("role") or None
        name = asked.get("machine") or ""
        if not name:
            return self.here(action, role and str(role), by)
        base = self.peers().get(name)
        if not base:
            return 404, {"error": f"no machine called {name}"}
        status, body = self.post(base, "control", self.secret,
                                 json.dumps({"action": action, "role": role}).encode(),
                                 timeout=CONTROL_SECONDS)
        if status == 404 and not body.lstrip().startswith(b"{"):
            return 404, {"error": f"{name}'s sq web has no controls yet; it gets them when its "
                                  "sq updates from main"}
        status, said = relay((status, body))
        if "error" in said:
            said = dict(said, error=f"{name}: {said['error']}")
        return status, said


def named_here(host):
    """Whether a `Host` names this machine's loopback, which a page that rebound its own
    name to 127.0.0.1 cannot send."""
    name = urllib.parse.urlsplit(f"//{host or ''}").hostname
    return name in ("localhost", "127.0.0.1", "::1")


def serve(read, port, open_page=True, say=print, session=lambda session_id: None,
          host=remote.LOOPBACK, secret=None, peers=dict, fetch=remote.fetch, config=dict,
          desk=None, post=remote.post, opener=logins.open_chrome, bridge=logins.bridge,
          usage=None, control=None):
    """Serves the page, `/status.json` and `/session.json?id=` until interrupted, and the same
    for each peer under `/m/<name>/`, read through `fetch`. A peer may also post its own
    reading to `/peer.json?from=<name>`. `read` returns a snapshot, which is
    settled with the peers unless one of them is asking, `session` one session's view or
    None, and `peers` the names and addresses of the other machines. `/login/…` starts and
    follows a Claude login, here or on a peer, through `LoginDoor`, and `usage`, when given,
    keeps each account's plan usage read behind the page. `/control` pauses, resumes, starts
    and stops through `control`, here or on a peer, through `ControlDoor`. Loopback needs no
    token to read; anyone else does, and every control does, wherever it comes from. Each request has a thread of its own, so a peer that is slow to
    answer, or a connection left idle, holds only itself; the queue is read by one request
    at a time, and requests within `SHARED_SECONDS` of each other share a reading."""
    if not remote.loopback(host) and not remote.usable(secret):
        say(f"error: sq web will not listen on {host} without {remote.TOKEN} of at least "
            f"{remote.TOKEN_MIN} characters in the env file")
        return

    reading, last = threading.Lock(), {}
    others = PeerViews(peers, secret, fetch)
    others.views()
    door = LoginDoor(desk or logins.Desk(config), config, peers, secret, fetch, post, opener,
                     bridge)
    controls = ControlDoor(control or (lambda *_: (404, {"error": "no controls here"})), peers,
                           secret, post)

    def shared():
        with reading:
            if "view" not in last or time.monotonic() - last["at"] >= SHARED_SECONDS:
                last.update(view=read(time.time()), at=time.monotonic())
            return last["view"]

    class Page(http.server.BaseHTTPRequestHandler):
        timeout = 10

        def answer(self, status, body, kind="application/json"):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def asked(self, most):
            """The posted JSON object, or the status that refuses it."""
            try:
                size = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                return 400
            if not 0 < size <= most:
                return 413
            try:
                found = json.loads(self.rfile.read(size))
            except ValueError:
                return 400
            return found if isinstance(found, dict) else 400

        def do_GET(self):
            path, _, query = self.path.partition("?")
            ok, cookie = remote.allowed(self.client_address[0], self.headers, query, secret)
            if not ok:
                return self.send_error(401)
            if cookie:
                self.send_response(303)
                self.send_header("Location", path)
                self.send_header("Set-Cookie", f"{remote.COOKIE}={cookie}; HttpOnly; "
                                               "SameSite=Strict; Path=/; Max-Age=31536000")
                self.end_headers()
                return None
            status, kind = 200, "application/json"
            if path.startswith("/m/"):
                name, _, rest = path[len("/m/"):].partition("/")
                base = peers().get(urllib.parse.unquote(name))
                if not base or rest not in ("status.json", "session.json"):
                    return self.send_error(404)
                status, body = fetch(base, rest + (f"?{query}" if query else ""), secret)
            elif path == "/status.json":
                view = shared()
                if "own=1" not in query.split("&"):
                    view = settle(dict(view), others.views())
                    view["controls"] = remote.presented(self.headers, secret)
                body = json.dumps(view).encode()
            elif path == "/session.json":
                with reading:
                    found = session((urllib.parse.parse_qs(query).get("id") or [""])[0])
                if found is None:
                    return self.send_error(404)
                body = json.dumps(found).encode()
            elif path == "/login/state":
                asked = urllib.parse.parse_qs(query)
                status, said = door.state((asked.get("machine") or [""])[0],
                                          (asked.get("id") or [""])[0])
                body = json.dumps(said).encode()
            elif path in ("/", "/index.html"):
                body, kind = PAGE.read_bytes(), "text/html; charset=utf-8"
            else:
                return self.send_error(404)
            self.answer(status, body, kind)
            return None

        def do_POST(self):
            path, _, query = self.path.partition("?")
            ok, _ = remote.allowed(self.client_address[0], self.headers, "", secret)
            if not ok:
                return self.send_error(401)
            if path.startswith("/login/"):
                return self.login(path)
            if path == "/control":
                return self.control()
            name = (urllib.parse.parse_qs(query).get("from") or [""])[0]
            if path != f"/{TOLD}" or name not in peers():
                return self.send_error(404)
            view = self.asked(TOLD_MOST_BYTES)
            if isinstance(view, int):
                return self.send_error(view)
            others.keep(name, view)
            self.send_response(204)
            self.end_headers()
            return None

        def own_json(self):
            """The posted JSON object, or the status that refuses it. Only JSON from this
            page's own address is taken, so another site open in the browser cannot post one
            to this machine."""
            kind = (self.headers.get("Content-Type") or "").split(";")[0].strip()
            if kind != "application/json":
                return 415
            origin = self.headers.get("Origin")
            if origin and urllib.parse.urlsplit(origin).netloc != self.headers.get("Host"):
                return 403
            if remote.loopback(self.client_address[0]) and \
                    not named_here(self.headers.get("Host")):
                return 403
            return self.asked(ASKED_MOST_BYTES)

        def login(self, path):
            asked = self.own_json()
            if isinstance(asked, int):
                return self.send_error(asked)
            status, said = door.act(path, asked, remote.loopback(self.client_address[0]))
            self.answer(status, json.dumps(said).encode())
            return None

        def control(self):
            """A pause, resume, start or stop. The token is asked of every address, this
            machine's own included: a worker shares its loopback, not the owner's cookie."""
            if not remote.presented(self.headers, secret):
                return self.send_error(401)
            asked = self.own_json()
            if isinstance(asked, int):
                return self.send_error(asked)
            status, said = controls.act(asked, self.client_address[0])
            self.answer(status, json.dumps(said).encode())
            return None

        def log_message(self, *_):
            pass

    server = http.server.ThreadingHTTPServer((host, port), Page)
    if usage:
        usage.start()
    url = f"http://127.0.0.1:{server.server_port}/"
    elsewhere = "" if remote.loopback(host) else f", and on {host} with the token"
    say(f"sq web: {url} (ctrl-c stops it){elsewhere}")
    if open_page:
        # Through the address once, so the page holds the cookie its controls need.
        webbrowser.open(url + (f"?token={urllib.parse.quote(secret, safe='')}"
                               if remote.usable(secret) else ""))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
