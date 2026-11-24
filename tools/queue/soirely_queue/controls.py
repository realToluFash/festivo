"""Pausing, resuming, starting and stopping, as `sq` does them and as `sq web` asks for them.
Each answers in the words `sq` prints; a line opening with `error:` is a refusal. What the
page asked for is kept in `<sq home>/runs/controls.jsonl`, with the address it came from."""

import subprocess
import time

from . import agents, github, machine, runlog, settings, shared, store

LOG = "controls"
MACHINE = ("pause", "resume", "pause-everywhere", "resume-everywhere")
ROLE = ("start", "stop")


def pause(db, say):
    store.set_meta(db, "paused", time.strftime("%d %b %H:%M"))
    say("paused: no role ticks, running workers finish their item")
    return 0


def resume(db, say):
    store.set_meta(db, "paused", None)
    everywhere = (store.get_meta(db, "shared_view") or {}).get("paused")
    say("resumed" + (f"; every machine is still paused by {everywhere.get('machine')}: "
                     "sq resume --everywhere" if everywhere else ""))
    return 0


def seen_here(db, paused):
    """Shows the shared pause on this machine at once, rather than at its next tick."""
    view = store.get_meta(db, "shared_view") or {}
    store.set_meta(db, "shared_view", dict(view, paused=paused))


def pause_everywhere(db, refs, name, say, now=None):
    now = now or time.time()
    if shared.pause_everywhere(refs, name, now):
        seen_here(db, {"machine": name, "at": now})
        say("paused every machine: no role ticks anywhere, running workers finish their item")
    else:
        say("every machine was already paused")
    return 0


def resume_everywhere(db, refs, say):
    shared.resume_everywhere(refs)
    seen_here(db, None)
    say("resumed every machine; a machine paused on its own stays paused")
    return 0


def act(db, home, platform, action, role=None, by=None, refs=shared.GitHubRefs,
        load=machine.load, now=None):
    """`(status, answer)` for the page: `{"said": …}` when it was done, `{"error": …}` when
    it was refused or could not be."""
    if action not in MACHINE + ROLE:
        return 404, {"error": f"no such control: {action}"}
    if (action in ROLE) != bool(role):
        return 400, {"error": f"{action} needs a role" if action in ROLE
                     else f"{action} takes no role"}
    lines = []
    try:
        if action == "pause":
            failed = pause(db, lines.append)
        elif action == "resume":
            failed = resume(db, lines.append)
        elif action == "start":
            failed = agents.start_here(db, platform, [role], lines.append, load)
        elif action == "stop":
            failed = agents.stop(db, [role], lines.append)
        elif action == "pause-everywhere":
            failed = pause_everywhere(db, refs(), load().get("machine") or "machine",
                                      lines.append, now)
        else:
            failed = resume_everywhere(db, refs(), lines.append)
        status = 409 if failed else 200
    except machine.ConfigError as error:
        status, lines = 409, [f"error: {error}"]
    except (github.GitHubError, subprocess.CalledProcessError, OSError) as error:
        status, lines = 502, [f"error: {error}"]
    said = "\n".join(lines)
    runlog.append(home, LOG, {"at": now or time.time(), "action": action, "role": role,
                              "from": by, "said": said, "failed": status != 200})
    return status, {"said": said} if status == 200 else {"error": said}


def described(done):
    """What a save or an undo changed, as the page and the run log say it."""
    return "; ".join(f"{where}: " + ", ".join(f"{key} {value['old']} → {value['new']}"
                                             for key, value in fields.items())
                     for where, fields in done.items())


def change(home, asked, by, path=None, now=None):
    """A save from the page's Settings. The answer carries the file as it now is, so a page
    refused for reading an older one shows what is there."""
    changes = asked.get("changes")
    try:
        done = settings.save(changes, asked.get("revision"), path)
    except settings.Refused as refused:
        status, answer, done = refused.status, {"error": str(refused)}, None
    else:
        status, answer = 200, {"said": described(done) or "nothing changed"}
    if done or status != 200:
        runlog.append(home, LOG, {"at": now or time.time(), "action": "settings",
                                  "changes": done or changes, "from": by,
                                  "said": answer.get("said") or answer["error"],
                                  "failed": status != 200})
    return status, dict(answer, settings=settings.read(path))


def undo(home, asked, by, path=None, now=None):
    try:
        done = settings.undo(asked.get("revision"), path)
    except settings.Refused as refused:
        status, answer, done = refused.status, {"error": str(refused)}, None
    else:
        status, answer = (409, {"error": "error: there is no change to undo"}) if done is None \
            else (200, {"said": "put back agents.json as it was before the last change"
                                + (f": {described(done)}" if done else "")})
    runlog.append(home, LOG, {"at": now or time.time(), "action": "undo",
                              "changes": done or {}, "from": by,
                              "said": answer.get("said") or answer["error"],
                              "failed": status != 200})
    return status, dict(answer, settings=settings.read(path))
