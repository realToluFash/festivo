"""`sq run`: once a minute, with no model, sync once and tick each started role whose minute
it is. A wake starts one worker, `sq worker`, which runs `claude -p` for that one item.

Everything a run decides is printed, one line each, for the journal."""

import datetime
import json
import os
import subprocess
import sys
import time

from . import checkout, local, machine, permissions, roles, runlog, shared, store, sync, update

VERSION_EVERY_SECONDS = 10 * 60
MILESTONES = ("At each milestone (a branch pushed, a part built, a result found) write one "
              "line with `sq {role} note sc-<n> --text '…'` and push what you have, so a "
              "run stopped part way loses minutes, not the thread.")


def due(role, minute, every=3):
    """A role wakes once every `every` minutes; the testers' offsets keep them apart."""
    return minute % every == roles.ROLES[role].get("offset", 0) % every


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
    reasons = {}
    free, floor = machine.free_gb(config), config.get("minFreeGb", 15)
    if floor and free < floor:
        reasons["disk"] = f"only {free:.0f} GB free, under minFreeGb {floor}: no new workers"
    cap = config.get("dailyBudgetUsd")
    if cap:
        total = sum(runlog.spent(home, ready).values())
        if total >= cap:
            reasons["budget"] = (f"${total:.2f} spent today, at dailyBudgetUsd {cap}: "
                                 "no new workers")
    today = datetime.date.today().isoformat()
    for guard, reason in reasons.items():
        say(f"held: {reason}")
        if once(db, f"told:{guard}", today):
            platform.notify("Soirely agents held", reason)
    return reasons


def holding(db, now):
    """The (pool, claim key) pairs this machine's workers hold right now."""
    return {(row["pool"], store.claim_key(row)) for row in db.execute(
        "select pool, story_id, kind from work where status = 'claimed' and lease_until >= ? "
        "and kind != 'machine'", (now,))}


def void_passes(db, now, say):
    from . import actions
    from .cli import refresh_work
    try:
        moved = actions.void_passes(actions.Context(db, "runner", None))
    except Exception as error:  # noqa: BLE001 — Shortcut down: the lead's review item stands
        return say(f"warning: could not move a voided pass back to In Review ({error})"[:240])
    for story_id in moved:
        say(f"sc-{story_id}: pushed after its pass, back to In Review")
    if moved:
        refresh_work(db, now)
    return None


def agree(db, config, platform, now, say, remote, ready):
    """Settles with the other machines. Returns `(view, mine, elsewhere)`, or None when
    GitHub cannot be reached: then another machine may be taking this one's roles over, so
    nothing shared starts here, and only this machine's own ops work runs."""
    try:
        return shared.reconcile(remote, db, config, started(db) & ready, platform.worker_active,
                                holding(db, now), now, bool(paused(db)))
    except Exception as error:  # noqa: BLE001 — offline, rate-limited, or GitHub refusing
        say(f"warning: could not reach the shared leases ({str(error)[:160]}); starting only "
            "this machine's own ops work until it can")
        return None


def run(db, home, platform, sq, python, now=None, dry_run=False, say=print,
        load=machine.load, probe=installed_claude, remote=None):
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
    version = claude_version(db, now, probe)
    late = drift(config, version)
    if late:
        say(f"warning: {late}")
        if once(db, "told:drift", version):
            platform.notify("Soirely: claude version drifted", late)
        if config.get("onVersionDrift") == "stop":
            return say("held: onVersionDrift is stop, so no role ticks until the pin matches")
    running = started(db)
    for role, why in refused.items():
        # A started role that cannot run is an error, for whatever alerts on the journal.
        say(f"{'error' if role in running else 'refused'}: {role}: {why}")
    errors = sync.sync(db, now)
    if errors and not store.get_meta(db, "synced_ok_at"):
        return say(f"error: {'; '.join(errors)}")
    from .cli import refresh_work
    local.checks(db, config, now)
    refresh_work(db, now)
    if not dry_run:
        void_passes(db, now, say)
    if not dry_run and update.check(db, home, now, say):
        say("the new sq takes over from the next minute")
    if not dry_run:
        platform.install(sq, machine.env_file(), python)
    remote = remote or shared.GitHubRefs()
    # Settled even while paused, so a pause here never hands this machine's roles away.
    agreed = None if dry_run else agree(db, config, platform, now, say, remote, set(ready))
    if paused(db):
        return say(f"paused since {paused(db)}: sq resume starts the roles again")
    held = guards(config, home, platform, db, list(ready), say)
    if agreed:
        view, mine, elsewhere = agreed
        if view.paused():
            pause = view.paused()
            return say(f"paused everywhere by {pause.get('machine')}: sq resume --everywhere "
                       "starts every machine again")
        skip = view.taken_elsewhere()
    else:
        view, mine, elsewhere, skip = None, set(), {}, set()
    minute = int(now // 60)
    # A dry run previews every ready role, started or not, whatever the minute.
    for role in sorted(set(ready) if dry_run else set(ready) & started(db)):
        if not dry_run and not due(role, minute, machine.minutes(ready[role]["wakeEvery"])):
            continue
        # ops@<machine> runs on every machine; the lease decides only ops' shared duties.
        kinds = None
        if role not in mine and not dry_run:
            if role != "ops":
                where = elsewhere.get(role)
                say(f"{role}: running on {where[0]}, last seen {where[1]}s ago" if where
                    else f"{role}: not held here" if view else f"{role}: held back, offline")
                continue
            kinds = ("machine",)
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
            # A full disk is the one hold ops@<machine> exists to clear.
            if role != "ops" or set(held) - {"disk"}:
                continue
            kinds = ("machine",)
        values = dict(ready[role], maxRuntimeMinutes=machine.minutes(ready[role]["maxRuntime"]))
        row = store.claim(db, role, now, kinds=kinds, skip=skip)
        if not row:
            say(f"{role}: idle")
            continue
        key = store.claim_key(row)
        if view and row["kind"] != "machine" and \
                not shared.claim_item(remote, view, row["pool"], key, role):
            store.release(db, row["id"])
            say(f"{role}: {key} was just taken on another machine")
            continue
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


def command(values, config_dir, allowed=(), denied=()):
    argv = ["claude", "-p", "--model", values["model"], "--effort", values["effort"],
            "--permission-mode", "auto", "--output-format", "json"]
    if values.get("maxBudgetUsd"):
        argv += ["--max-budget-usd", str(values["maxBudgetUsd"])]
    if allowed:
        argv += ["--allowedTools", *allowed]
    if denied:
        argv += ["--disallowedTools", *denied]
    env = dict(os.environ)
    folder = machine.expand(config_dir)
    # Claude's own folder runs as Claude does by default, with nothing set.
    if machine.is_claude_default(folder):
        env.pop("CLAUDE_CONFIG_DIR", None)
    else:
        env["CLAUDE_CONFIG_DIR"] = str(folder)
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
    try:
        main, note = prepare(path, role, story)
    except checkout.Unprepared as error:
        entry["report"] = f"the worker could not prepare its checkout: {error}"
        runlog.append(home, role, entry)
        platform.notify(f"Soirely: {role}'s worker stopped", entry["report"][:300])
        return entry
    entry["main"] = main
    folder = machine.claude_dir(config, role)
    entry["account"] = machine.account(folder)
    argv, env = command(values, folder, permissions.for_role(permissions.applied(), role),
                        permissions.denied(home / "sq" / "sq", folder))
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
    status = os.environ.get("EXIT_STATUS")
    said = f"it exited with status {status}" if reason == "exit-code" and status else reason
    entry = {"at": now or time.time(), "item": item_id, "role": role,
             "exit": status, "stopped": reason,
             "report": f"the worker ended without a report: {said}"}
    runlog.append(home, role, entry)
    platform.notify(f"Soirely: {role}'s worker stopped", entry["report"])
    return entry
