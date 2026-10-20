"""`sq run`: once a minute, with no model, sync once and tick each started role whose minute
it is. A wake starts one worker, `sq worker`, which runs `claude -p` for that one item.

Everything a run decides is printed, one line each, for the journal."""

import datetime
import json
import os
import subprocess
import sys
import time

from . import checkout, machine, roles, runlog, store, sync, update

VERSION_EVERY_SECONDS = 10 * 60
MILESTONES = ("At each milestone (a branch pushed, a part built, a result found) write one "
              "line with `sq {role} note sc-<n> --text '…'` and push what you have, so a "
              "run stopped part way loses minutes, not the thread.")


def due(role, minute):
    return minute % 3 == roles.ROLES[role].get("offset", 0)


def started(db):
    return set(store.get_meta(db, "started") or [])


def set_started(db, role_names, on):
    now = started(db)
    store.set_meta(db, "started", sorted(now | set(role_names) if on else now - set(role_names)))


def paused(db):
    return store.get_meta(db, "paused")


def once(db, key, value):
    """True the first time `value` is seen under `key`, so a warning is given once."""
    if store.get_meta(db, key) == value:
        return False
    store.set_meta(db, key, value)
    return True


def installed_claude():
    try:
        out = subprocess.run(["claude", "--version"], capture_output=True, text=True,
                             timeout=30).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    return out.split()[0] if out.strip() else None


def claude_version(db, now, probe=installed_claude):
    seen = store.get_meta(db, "claude_version") or {}
    if now - seen.get("at", 0) >= VERSION_EVERY_SECONDS:
        seen = {"at": now, "version": probe()}
        store.set_meta(db, "claude_version", seen)
    return seen.get("version")


def drift(config, version):
    pinned = config.get("claudeVersion")
    if not pinned or not version or version == pinned:
        return None
    return (f"claude is {version}, but agents.json pins {pinned}: set claudeVersion to "
            f"{version} once you are happy with it, or install {pinned} again")


def guards(config, home, platform, db, ready, say):
    """Reasons no new worker may start right now, each told to the owner once a day."""
    reasons = []
    free, floor = machine.free_gb(config), config.get("minFreeGb", 15)
    if floor and free < floor:
        reasons.append(f"only {free:.0f} GB free, under minFreeGb {floor}: no new workers")
    cap = config.get("dailyBudgetUsd")
    if cap:
        total = sum(runlog.spent(home, ready).values())
        if total >= cap:
            reasons.append(f"${total:.2f} spent today, at dailyBudgetUsd {cap}: no new workers")
    today = datetime.date.today().isoformat()
    for reason in reasons:
        say(f"held: {reason}")
        if once(db, f"told:{reason.split(':')[0]}", today):
            platform.notify("Soirely agents held", reason)
    return reasons


def run(db, home, platform, sq, python, now=None, dry_run=False, say=print,
        load=machine.load, probe=installed_claude):
    now = now or time.time()
    try:
        config = load()
    except machine.ConfigError as error:
        return say(f"error: {error}")
    errors, refused, ready = machine.check(config)
    for error in errors:
        say(f"error: {error}")
    if errors:
        return None
    if not os.environ.get("SHORTCUT_API_TOKEN"):
        return say(f"error: SHORTCUT_API_TOKEN is not set in {machine.env_file()}; "
                   "nothing synced, no role ticked")
    if paused(db):
        return say(f"paused since {paused(db)}: sq resume starts the roles again")
    version = claude_version(db, now, probe)
    late = drift(config, version)
    if late:
        say(f"warning: {late}")
        if once(db, "told:drift", version):
            platform.notify("Soirely: claude version drifted", late)
        if config.get("onVersionDrift") == "stop":
            return say("held: onVersionDrift is stop, so no role ticks until the pin matches")
    for role, why in refused.items():
        say(f"refused {role}: {why}")
    errors = sync.sync(db, now)
    if errors and not store.get_meta(db, "synced_ok_at"):
        return say(f"error: {'; '.join(errors)}")
    from .cli import refresh_work
    refresh_work(db, now)
    if not dry_run and update.check(db, home, now, say):
        say("the new sq takes over from the next minute")
    if not dry_run:
        platform.install(sq, machine.env_file(), python)
    held = guards(config, home, platform, db, list(ready), say)
    minute = int(now // 60)
    # A dry run previews every ready role, started or not, whatever the minute.
    for role in sorted(set(ready) if dry_run else set(ready) & started(db)):
        if not dry_run and not due(role, minute):
            continue
        if platform.worker_active(role):
            say(f"{role}: worker still running")
            continue
        if store.held_by(db, role, now):
            say(f"{role}: busy")
            continue
        if dry_run:
            waiting = store.waiting(db, role)
            say(f"{role}: would wake for {waiting[0]['reason']}" if waiting else f"{role}: idle")
            continue
        if held:
            continue
        row = store.claim(db, role, now)
        if not row:
            say(f"{role}: idle")
            continue
        values = dict(ready[role], maxRuntimeMinutes=machine.minutes(ready[role]["maxRuntime"]))
        try:
            platform.launch(role, row["id"], values, sq, python, machine.checkout(config, role),
                            machine.env_file())
        except (OSError, subprocess.CalledProcessError) as error:
            store.release(db, row["id"])
            say(f"error: {role}: the worker did not start ({error}); item {row['id']} released")
            continue
        say(f"{role}: woke for {row['reason']} (item {row['id']})")
    return None


def prompt(row, role, main, note):
    from .cli import brief
    lines = [f"Your checkout was brought up to origin/main at {main[:7]} before this run."]
    if note:
        lines.append(note)
    return "\n".join(lines + ["", brief(row, role), MILESTONES.format(role=role)])


def command(values, config_dir):
    argv = ["claude", "-p", "--model", values["model"], "--effort", values["effort"],
            "--permission-mode", "auto", "--output-format", "json"]
    if values.get("maxBudgetUsd"):
        argv += ["--max-budget-usd", str(values["maxBudgetUsd"])]
    env = dict(os.environ, CLAUDE_CONFIG_DIR=str(machine.expand(config_dir)))
    return argv, env


def worker(db, home, platform, role, item_id, run_claude=subprocess.run, load=machine.load,
           prepare=checkout.prepare, now=None):
    """Runs inside the role's unit: prepares the checkout, runs the model, records the run."""
    config = load()
    values = machine.settings(config, role)
    row = store.item(db, item_id)
    story = store.story(db, row["story_id"]) if row and row["story_id"] else None
    entry = {"at": now or time.time(), "item": item_id, "role": role,
             "model": values["model"], "effort": values["effort"],
             "claude": (store.get_meta(db, "claude_version") or {}).get("version")}
    path = machine.checkout(config, role)
    main, note = prepare(path, role, story)
    entry["main"] = main
    argv, env = command(values, config.get("claudeConfigDir") or "~/.claude-soirely")
    finished = run_claude(argv, input=prompt(row, role, main, note), capture_output=True,
                          text=True, cwd=path, env=env)
    try:
        result = json.loads(finished.stdout or "{}")
    except json.JSONDecodeError:
        result = {"result": (finished.stdout or finished.stderr or "")[-2000:]}
    entry.update(runlog.from_result(result, finished.returncode))
    runlog.append(home, role, entry)
    waits = runlog.waits_on_owner(entry["report"])
    if waits:
        store.set_meta(db, f"owner:{role}", {"at": entry["at"], "lines": waits})
        platform.notify(f"Soirely: {role} needs you", "\n".join(waits)[:300])
    else:
        store.set_meta(db, f"owner:{role}", None)
    return entry


def worker_ended(home, platform, role, item_id, now=None):
    """`ExecStopPost`: a run stopped by its memory or time limit, or a crash, writes no
    report of its own, so this leaves the record."""
    if any(e.get("item") == item_id for e in runlog.entries(home, role)[-5:]):
        return None
    reason = os.environ.get("SERVICE_RESULT", "unknown")
    entry = {"at": now or time.time(), "item": item_id, "role": role,
             "exit": os.environ.get("EXIT_STATUS"), "stopped": reason,
             "report": f"the worker ended without a report: {reason}"}
    runlog.append(home, role, entry)
    platform.notify(f"Soirely: {role}'s worker stopped", entry["report"])
    return entry
