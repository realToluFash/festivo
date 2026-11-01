"""The designer's drawings, made unattended. A `claude -p` worker has no Artifact tool, so ux
lists what it could not draw (`sq ux to-draw`), and the manager draws the list one story at a
time in a background session (`claude --bg`), which has it. The session runs under ux's
Claude account, in ux's checkout, and the manager stops it once the story is off the list."""

import subprocess
import time

from . import background, machine, permissions, runlog, store

WORKER = "ux-draw"
MAX_TRIES = 2
UNATTENDED = """

You run unattended, started by sq: nobody answers here. Draw this one story, write its Design
section, run `sq ux drawn sc-{story}`, and stop. Ask `[pm]` on the story about anything you
cannot settle, as the skill says, and draw your proposal meanwhile. If you cannot finish, say
why in your last message and stop."""


def environment(config, values):
    from .runner import command
    folder = machine.claude_dir(config, "ux")
    _, env = command(values, folder)
    env["SOIRELY_WORKER"] = WORKER
    return folder, env


def sessions(env, run=subprocess.run):
    return {short: s.get("state") or s.get("status")
            for short, s in (background.listed(env, run) or {}).items()}


def start(drawing, values, home, config, cwd, run=subprocess.run, daemon=None):
    """`daemon`, the platform's, starts the account's daemon outside the tick's unit, whose
    end would otherwise take down every session of an account ux shares."""
    folder, env = environment(config, values)
    if daemon:
        daemon(env)
    allowed = permissions.for_role(permissions.applied(), "ux")
    denied = permissions.denied(home / "sq" / "sq", folder)
    # ux draws in the artifact, so its session is the one not kept to reading.
    argv, _ = background.command(
        values, folder, f"draw sc-{drawing['story_id']}",
        drawing["prompt"] + UNATTENDED.format(story=drawing["story_id"]), allowed, denied,
        read_only=False)
    return background.start(argv, cwd, env, run)


def finish(session, env, keep, run=subprocess.run):
    background.stop(session, env, run)
    if not keep:
        run(["claude", "rm", session], capture_output=True, env=env)


def tick(db, home, config, values, platform, now=None, say=print, run=subprocess.run):
    """One minute of the drawing: settle the session that is running, or start the next."""
    now = now or time.time()
    current = store.get_meta(db, "drawing")
    tries = store.get_meta(db, "draw_tries") or {}
    listed = store.drawings(db)
    if current:
        story = current["story_id"]
        _, env = environment(config, values)
        state = sessions(env, run).get(current["session"])
        limit = machine.minutes(values["maxRuntime"]) * 60
        if state != current.get("state"):
            current = dict(current, state=state)
            store.set_meta(db, "drawing", current)
        if story not in {d["story_id"] for d in listed}:
            outcome, failed = f"drew sc-{story}", False
        elif state is None or state in background.ENDED:
            outcome, failed = f"sc-{story}: the session ended without `sq ux drawn`", True
        elif now - current["at"] > limit:
            outcome, failed = f"sc-{story}: stopped at its time limit", True
        elif state == "blocked":
            if not current.get("told"):
                platform.notify("Soirely: a drawing waits for you",
                                f"sc-{story} is blocked: claude attach {current['session']}")
                store.set_meta(db, "drawing", dict(current, told=True))
            return say(f"{WORKER}: sc-{story} waits for you, claude attach {current['session']}")
        else:
            return say(f"{WORKER}: drawing sc-{story}")
        # A failed session is kept, so its conversation can be read with `claude attach`.
        finish(current["session"], env, keep=failed, run=run)
        entry = {"at": now, "role": "ux", "worker": WORKER, "item": None, "story": story,
                 "session": current["session"], "exit": 1 if failed else 0,
                 "duration_ms": int((now - current["at"]) * 1000), "report": outcome}
        runlog.append(home, "ux", entry)
        if failed:
            tries[str(story)] = tries.get(str(story), 0) + 1
            store.set_meta(db, "draw_tries", tries)
            if tries[str(story)] >= MAX_TRIES:
                platform.notify("Soirely: a drawing failed twice",
                                f"{outcome}; it stays on the list for /soirely-designer")
        store.set_meta(db, "drawing", None)
        return say(f"{WORKER}: {outcome}")
    waiting = [d for d in listed if tries.get(str(d["story_id"]), 0) < MAX_TRIES]
    if not waiting:
        return None
    drawing = waiting[0]
    cwd = machine.checkout(config, "ux")
    try:
        session = start(drawing, values, home, config, cwd, run,
                        daemon=getattr(platform, "claude_daemon", None))
    except (OSError, RuntimeError) as error:
        return say(f"error: {WORKER}: sc-{drawing['story_id']} did not start ({error})")
    store.set_meta(db, "drawing", {"story_id": drawing["story_id"], "session": session,
                                   "at": now})
    return say(f"{WORKER}: drawing sc-{drawing['story_id']} in session {session}")
