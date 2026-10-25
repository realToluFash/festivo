"""What `sq status` prints and `sq web` draws: one reading of this machine's manager, its
roles, the other machines and what the workers cost. The page is served on 127.0.0.1 only
and reads the same snapshot every few seconds."""

import datetime
import http.server
import json
import pathlib
import time
import webbrowser

from . import drawing, machine, permissions, roles, runlog, runner, store

PAGE = pathlib.Path(__file__).with_name("dashboard.html")
RECENT = 20
NEXT = 5


def first_line(text):
    lines = (text or "").strip().splitlines()
    return lines[0] if lines else ""


def run_view(entry):
    return {"at": entry.get("at"), "role": entry.get("role"), "worker": entry.get("worker"),
            "cost": entry.get("cost_usd") or 0, "exit": entry.get("exit"),
            "stopped": entry.get("stopped"), "item": entry.get("item"),
            "seconds": (entry.get("duration_ms") or 0) // 1000 or None,
            "model": entry.get("model"), "effort": entry.get("effort"),
            "report": first_line(entry.get("report")),
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
            "paused": runner.paused(db), "machines": [], "roles": [], "elsewhere": [],
            "recent": [], "spend": spend(home, 7), "drawings": store.drawings(db),
            "drawing": drawing_view(db)}
    try:
        config = load()
    except machine.ConfigError as error:
        config = None
        view["errors"].append(str(error))
    shown, accounts = set(), {}
    if config:
        problems, refused, ready = machine.check(config)
        view["machine"] = config.get("machine") or "this machine"
        view["free_gb"] = round(machine.free_gb(config))
        view["errors"] += problems
        late = runner.drift(config, (store.get_meta(db, "claude_version") or {}).get("version"))
        if late:
            view["warnings"].append(late)
        on = runner.started(db)
        agreed = store.get_meta(db, "shared_view") or {}
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
            state, detail = ("running", None) if running else \
                ("elsewhere", {"machine": away[0], "seen": away[1]}) if role in on and away \
                else ("busy", None) if held else \
                ("started", None) if role in on else ("stopped", None)
            last = runlog.last(home, role)
            owner = store.get_meta(db, f"owner:{role}")
            view["roles"].append({
                "role": role, "state": state, "detail": detail,
                "model": ready[role]["model"], "effort": ready[role]["effort"],
                "account": accounts[role],
                "wake_every": ready[role].get("wakeEvery"),
                "workers": len(names), "running": running,
                "last": run_view(last) if last else None,
                "held": {"id": held["id"], "reason": held["reason"]} if held else None,
                "holding": holding if len(names) > 1 else [],
                "waiting": len(waiting),
                "next": [{"id": w["id"], "reason": w["reason"]} for w in waiting[:NEXT]],
                "note": machine.price_note(role, ready[role]["model"], config),
                "owner": owner["lines"][0] if owner else None})
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


def serve(read, port, open_page=True, say=print):
    """Serves the page and `/status.json` until interrupted. `read` returns a snapshot; one
    request at a time, since the queue's connection belongs to this thread."""
    class Page(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.split("?")[0] == "/status.json":
                body, kind = json.dumps(read(time.time())).encode(), "application/json"
            elif self.path in ("/", "/index.html"):
                body, kind = PAGE.read_bytes(), "text/html; charset=utf-8"
            else:
                return self.send_error(404)
            self.send_response(200)
            self.send_header("Content-Type", kind)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            pass

    server = http.server.HTTPServer(("127.0.0.1", port), Page)
    url = f"http://127.0.0.1:{server.server_port}/"
    say(f"sq web: {url} (ctrl-c stops it)")
    if open_page:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
