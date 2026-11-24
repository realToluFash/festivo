"""The settings `sq web` may change in `agents.json`, checked as `sq run` checks the file,
with the file each change replaced kept beside it for one undo. The rest of the file stays
at the keyboard, where a mistake cannot stop a machine from a phone."""

import hashlib
import json
import os

from . import machine, roles

ROLE = ("model", "effort", "inboxEffort", "wakeEvery", "workers", "maxBudgetUsd")
DEFAULTS = ROLE
MACHINE = ("dailyBudgetUsd",)


class Refused(Exception):
    """A change not written, with why, in `sq run`'s words where it has them."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def revision(text):
    return hashlib.sha256(text.encode()).hexdigest()


def previous(path):
    return path.with_name(path.name + ".prev")


def read(path=None, known=None):
    """What the page shows: each listed role's fields as the file sets them and as they are
    in force, the defaults, the machine's own, and what each field may be."""
    path = path or machine.path()
    text = path.read_text()
    config = json.loads(text)
    known = known or machine.models()
    defaults = config.get("defaults") or {}

    def field(own, key, role):
        in_force = machine.settings(config, role).get(key)
        source = "role" if own.get(key) is not None else \
            "defaults" if defaults.get(key) is not None else "built-in"
        return {"value": own.get(key), "in_force": in_force, "from": source}

    return {
        "revision": revision(text), "undo": previous(path).exists(),
        "models": {name: model["efforts"] for name, model in known.items()},
        "parallel": list(roles.PARALLEL),
        "machine": {key: config.get(key) for key in MACHINE},
        "defaults": {key: defaults.get(key) for key in DEFAULTS},
        "roles": {role: {key: field(own or {}, key, role) for key in ROLE}
                  for role, own in (config.get("roles") or {}).items()},
    }


def changed(config, where, changes):
    """`config` with `changes` made at `where`: "machine", "defaults" or a listed role. A
    null clears the field, so the role falls back to `defaults`. Returns the fields that
    changed, old and new."""
    if where == "machine":
        allowed, entry = MACHINE, config
    elif where == "defaults":
        allowed, entry = DEFAULTS, config.setdefault("defaults", {})
    elif where in (config.get("roles") or {}):
        allowed, entry = ROLE, config["roles"][where] or {}
        config["roles"][where] = entry
    else:
        raise Refused(404, f"error: {where} is not listed in {machine.path()}")
    stray = sorted(set(changes) - set(allowed))
    if stray:
        raise Refused(400, f"error: {', '.join(stray)} cannot be changed from the page; "
                           f"it can be set in {machine.path()}")
    done = {}
    for key, value in changes.items():
        old = entry.get(key)
        if value == old:
            continue
        done[key] = {"old": old, "new": value}
        if value is None and where != "machine":
            entry.pop(key, None)
        else:
            entry[key] = value
    return done


def problems(before, after, known, logged_in):
    """What `sq run` would say of `after` that it does not say of `before`, in its own words,
    so a role refused for something else, a missing login say, does not stop a change."""
    errors, refused, _ = machine.check(before, known, logged_in)
    new_errors, new_refused, _ = machine.check(after, known, logged_in)
    return [f"error: {error}" for error in new_errors if error not in errors] + \
        [f"refused {role}: {why}" for role, why in new_refused.items()
         if refused.get(role) != why]


def save(where, changes, asked_revision, path=None, known=None, logged_in=machine.account):
    """Writes the change and returns the fields it changed, or raises `Refused`."""
    path = path or machine.path()
    text = path.read_text()
    if asked_revision != revision(text):
        raise Refused(409, f"error: {path} changed since the page read it; read it again")
    known = known or machine.models()
    before = json.loads(text)
    after = json.loads(text)
    done = changed(after, where, changes)
    if not done:
        return done
    found = problems(before, after, known, logged_in)
    if found:
        raise Refused(409, "\n".join(found))
    write(path, json.dumps(after, indent=2) + "\n", keep=text)
    return done


def undo(asked_revision, path=None):
    """Puts back the file the last change replaced. Returns False when there is none."""
    path = path or machine.path()
    kept = previous(path)
    if not kept.exists():
        return False
    if asked_revision != revision(path.read_text()):
        raise Refused(409, f"error: {path} changed since the page read it; read it again")
    os.replace(kept, path)
    return True


def write(path, text, keep):
    mode = path.stat().st_mode & 0o777
    kept, fresh = previous(path), path.with_name(path.name + ".new")
    for target, content in ((kept, keep), (fresh, text)):
        target.write_text(content)
        target.chmod(mode)
    os.replace(fresh, path)
