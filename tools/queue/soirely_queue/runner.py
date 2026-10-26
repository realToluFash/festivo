"""`sq run`: once a minute, with no model, sync once and tick each started role whose minute
it is. A wake starts one worker, `sq worker`, which runs `claude -p` for that one item.

Everything a run decides is printed, one line each, for the journal."""

import datetime
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time

from . import (checkout, drawing, harness, local, machine, permissions, review, roles, runlog,
               shared, store, sync, update)

VERSION_EVERY_SECONDS = 10 * 60
# `claude -p` stays up while a background shell it started still runs, so a run whose item
# is done and whose answer is written is given this long to exit, then ended.
SETTLE_SECONDS = 15
STOP_GRACE_SECONDS = 5
READER_SECONDS = 5
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


def any_active(platform, config, role):
    count = machine.settings(config, role).get("workers")
    return any(platform.worker_active(name) for name in machine.worker_names(role, count))


def agree(db, config, platform, now, say, remote, ready):
    """Settles with the other machines. Returns `(view, mine, elsewhere)`, or None when
    GitHub cannot be reached: then another machine may be taking this one's roles over, so
    nothing shared starts here, and only this machine's own ops work runs."""
    try:
        return shared.reconcile(remote, db, config, started(db) & ready,
                                lambda role: any_active(platform, config, role),
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
        if dry_run:
            waiting = store.waiting(db, role)
            say(f"{role}: would wake for {waiting[0]['reason']}" if waiting else f"{role}: idle")
            continue
        for name in machine.worker_names(role, ready[role].get("workers")):
            if not wake(db, config, platform, role, name, ready[role], now, say, sq, python,
                        kinds, held, skip, view, remote):
                break
    if not dry_run and not held and "ux" in mine and "ux" in started(db):
        drawing.tick(db, home, config, ready["ux"], platform, now, say)
    return None


def wake(db, config, platform, role, name, values, now, say, sq, python, kinds, held, skip,
         view, remote):
    """Starts worker `name` on the role's next item. False when the role has nothing more
    to start this minute, so its further workers are not tried."""
    if platform.worker_active(name):
        say(f"{name}: worker still running")
        return True
    claimed = store.held_by(db, role, now, worker=name)
    if claimed and claimed["worker"]:
        # Its worker is gone without finishing it, a crash or a kill; a role run by hand
        # claims with no worker, so only a worker's item is given back.
        store.release(db, claimed["id"])
        say(f"{name}: item {claimed['id']} given back, its worker ended without "
            "finishing it")
        claimed = None
    if claimed:
        say(f"{name}: busy")
        return True
    if held:
        # A full disk is the one hold ops@<machine> exists to clear.
        if role != "ops" or set(held) - {"disk"}:
            return False
        kinds = ("machine",)
    values = dict(values, maxRuntimeMinutes=machine.minutes(values["maxRuntime"]))
    row = store.claim(db, role, now, kinds=kinds, skip=skip, worker=name,
                      workers=values.get("workers") or 1)
    if not row:
        say(f"{name}: idle")
        return False
    key = store.claim_key(row)
    try:
        taken = view and row["kind"] != "machine" and \
            not shared.claim_item(remote, view, row["pool"], key, role)
    except RuntimeError as error:
        store.release(db, row["id"])
        say(f"error: {name}: could not claim {key} ({error}); item {row['id']} released")
        return False
    if taken:
        store.release(db, row["id"])
        say(f"{name}: {key} was just taken on another machine")
        return True
    try:
        path = machine.checkout(config, role, name)
        if name != role:
            checkout.ensure(machine.checkout(config, role), path)
        platform.launch(name, row["id"], values, sq, python, path, machine.env_file())
    except (OSError, subprocess.CalledProcessError, checkout.Unprepared) as error:
        store.release(db, row["id"])
        say(f"error: {name}: the worker did not start ({error}); item {row['id']} released")
        return False
    say(f"{name}: woke for {row['reason']} (item {row['id']})")
    return True


def prompt(row, role, main, note):
    from .cli import brief
    lines = [f"Your checkout was brought up to origin/main at {main[:7]} before this run."]
    if note:
        lines.append(note)
    return "\n".join(lines + ["", brief(row, role), MILESTONES.format(role=role)])


def command(values, config_dir, allowed=(), denied=()):
    argv = ["claude", "-p", "--model", values["model"], "--effort", values["effort"],
            "--permission-mode", "auto", "--output-format", "stream-json", "--verbose"]
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


def process_table():
    """`{pid: (parent pid, command)}` for every process on the machine."""
    out = subprocess.run(["ps", "-A", "-o", "pid=,ppid=,command="], capture_output=True,
                         text=True).stdout
    table = {}
    for line in out.splitlines():
        parts = line.split(None, 2)
        if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
            table[int(parts[0])] = (int(parts[1]), parts[2] if len(parts) > 2 else "")
    return table


def descendants(pid, table):
    """Every process started under `pid`, however many sessions down: claude starts each
    background shell in a session of its own, out of reach of its process group."""
    found, frontier = [], [pid]
    while frontier:
        parent = frontier.pop()
        children = [child for child, (ppid, _) in table.items() if ppid == parent]
        found += children
        frontier += children
    return found


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def stop_tree(pid, running, table=process_table, sleep=time.sleep):
    """Ends `pid` and everything under it, and returns the commands left running under it.
    `running()` says whether `pid` itself is still up: it is our own child, so `alive` would
    see it until it is reaped."""
    snapshot = table()
    left = descendants(pid, snapshot)
    for target in [pid, *left]:
        try:
            os.kill(target, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
    for _ in range(STOP_GRACE_SECONDS * 10):
        if not running() and not any(alive(target) for target in left):
            break
        sleep(0.1)
    for target in ([pid] if running() else []) + [target for target in left if alive(target)]:
        try:
            os.kill(target, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    return [snapshot[target][1] for target in left if target in snapshot]


def run_until_done(argv, input, cwd, env, finished, poll=1.0, clock=time.monotonic,
                   sleep=time.sleep, stop=stop_tree):
    """Runs claude, reading its stream as it comes. Once the run has written its own answer
    and `finished()` says its item is done, anything it left running is ended. Returns
    `(exit status, stdout, stderr, the commands that were ended)`."""
    child = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    lines, errors = [], []
    readers = [threading.Thread(target=lambda: lines.extend(child.stdout), daemon=True),
               threading.Thread(target=lambda: errors.extend(child.stderr), daemon=True)]
    for reader in readers:
        reader.start()
    try:
        child.stdin.write(input)
        child.stdin.close()
    except BrokenPipeError:
        pass
    settled, ended, read, answered = None, None, 0, False
    while child.poll() is None:
        if not answered:
            fresh = lines[read:]
            read += len(fresh)
            answered = own_result(fresh) is not None
        if settled is None and answered and finished():
            settled = clock()
        if settled is not None and clock() - settled >= SETTLE_SECONDS:
            ended = stop(child.pid, lambda: child.poll() is None)
            break
        sleep(poll)
    child.wait()
    for reader, pipe in zip(readers, (child.stdout, child.stderr)):
        reader.join(timeout=READER_SECONDS)
        if not reader.is_alive():
            pipe.close()
    return (0 if ended is not None else child.returncode), "".join(lines), "".join(errors), \
        ended


def results(stdout):
    found = []
    for line in (stdout or "").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict) and event.get("type") == "result":
            found.append(event)
    return found


def own_result(lines):
    """The run's own answer: a later result answers a background task's notice, such as the
    bundler it left running ending, and is not the report."""
    own = [event for event in results("".join(lines))
           if (event.get("origin") or {}).get("kind") != "task-notification"]
    return own[-1] if own else None


def run_dir(home, name, item_id):
    """The run's own scratch folder, named so `worker_ended` finds it after a timeout."""
    return home / "scratch" / f"{name}-{item_id}"


def worker(db, home, platform, name, item_id, run_claude=run_until_done, load=machine.load,
           prepare=checkout.prepare, make_review=review.make, refresh_harness=harness.refresh,
           now=None):
    """Runs inside the worker's unit: prepares the checkout, runs the model, records the
    run. `name` is the role, or `pm-2` and on for a further worker of it."""
    role = machine.worker_role(name)
    config = load()
    values = machine.settings(config, role)
    row = store.item(db, item_id)
    story = store.story(db, row["story_id"]) if row and row["story_id"] else None
    entry = {"at": now or time.time(), "item": item_id, "role": role,
             "model": values["model"], "effort": values["effort"],
             "claude": (store.get_meta(db, "claude_version") or {}).get("version")}
    if name != role:
        entry["worker"] = name
    path = machine.checkout(config, role, name)
    try:
        main, note = prepare(path, role, story)
        if role in roles.TESTERS:
            note = "\n".join(filter(None, [note, refresh_harness(db, path, main)]))
        cwd = path
        if role in review.ROLES:
            pr = row["pr"] if row else None
            head = (store.pr(db, pr) or {}).get("head_sha") if pr else None
            base = machine.checkout(config, role)
            cwd = make_review(path, base, head or main, pr if head else None, rules=main)
            note = "\n".join(filter(None, [note, review.note(cwd, head or main,
                                                              pr if head else None, base)]))
    except checkout.Unprepared as error:
        entry["report"] = f"the worker could not prepare its checkout: {error}"
        runlog.append(home, role, entry)
        platform.notify(f"Soirely: {name}'s worker stopped", entry["report"][:300])
        return entry
    entry["main"] = main
    folder = machine.claude_dir(config, role)
    entry["account"] = machine.account(folder)
    argv, env = command(values, folder, permissions.for_role(permissions.applied(), role),
                        permissions.denied(home / "sq" / "sq", folder))
    scratch = run_dir(home, name, item_id)
    scratch.mkdir(parents=True, exist_ok=True)
    env["SQ_RUN_DIR"] = str(scratch)
    try:
        code, stdout, stderr, ended = run_claude(
            argv, prompt(row, role, main, note), cwd, env,
            lambda: (store.item(db, item_id) or {"status": None})["status"] == "done")
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
        if cwd != path:
            review.remove(path)
    every = results(stdout)
    own = own_result([stdout])
    if own:
        result = dict(own, total_cost_usd=every[-1].get("total_cost_usd"))
    else:
        result = {"result": (stdout or stderr or "")[-2000:]}
    entry.update(runlog.from_result(result, code))
    if ended is not None:
        entry["ended"] = ended
    runlog.append(home, role, entry)
    waits = runlog.waits_on_owner(entry["report"])
    if waits:
        store.set_meta(db, f"owner:{role}", {"at": entry["at"], "lines": waits, "worker": name})
        platform.notify(f"Soirely: {role} needs you", "\n".join(waits)[:300])
    elif (store.get_meta(db, f"owner:{role}") or {}).get("worker", role) == name:
        # Another worker's question stays until that worker's next run settles it.
        store.set_meta(db, f"owner:{role}", None)
    return entry


def worker_ended(home, platform, name, item_id, now=None, load=machine.load):
    """`ExecStopPost`: a run stopped by its memory or time limit, or a crash, writes no
    report of its own, so this leaves the record, and takes its review worktree away."""
    role = machine.worker_role(name)
    shutil.rmtree(run_dir(home, name, item_id), ignore_errors=True)
    if role in review.ROLES:
        try:
            review.remove(machine.checkout(load(), role, name))
        except (machine.ConfigError, OSError) as error:
            platform.notify(f"Soirely: {name}'s review worktree is still there", str(error))
    if any(e.get("item") == item_id for e in runlog.entries(home, role)[-20:]):
        return None
    reason = os.environ.get("SERVICE_RESULT", "unknown")
    status = os.environ.get("EXIT_STATUS")
    said = f"it exited with status {status}" if reason == "exit-code" and status else reason
    entry = {"at": now or time.time(), "item": item_id, "role": role,
             "exit": status, "stopped": reason,
             "report": f"the worker ended without a report: {said}"}
    if name != role:
        entry["worker"] = name
    runlog.append(home, role, entry)
    platform.notify(f"Soirely: {name}'s worker stopped", entry["report"])
    return entry
