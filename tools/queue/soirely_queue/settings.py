"""The settings `sq web` may change in `agents.json`, checked as `sq run` checks the file,
with the file each change replaced kept beside it for one undo. The rest of the file stays
at the keyboard, where a mistake cannot stop a machine from a phone."""

import hashlib
import json
import os
import threading

from . import logins, machine, roles

DEFAULTS = ("model", "effort", "inboxEffort", "wakeEvery", "workers", "maxBudgetUsd")
ACCOUNT = "claudeConfigDir"
ROLE = DEFAULTS + (ACCOUNT,)
MACHINE = ("dailyBudgetUsd", ACCOUNT)
# `sq web` answers each request on a thread of its own; two saves must not both pass the
# revision check before either writes.
WRITING = threading.Lock()


class Refused(Exception):
    """A change not written, with why, in `sq run`'s words where it has them."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def revision(text):
    return hashlib.sha256(text.encode()).hexdigest()


def previous(path):
    return path.with_name(path.name + ".prev")


def written(path):
    """The revision of the file the last change wrote, so an undo can tell a hand edit since."""
    return path.with_name(path.name + ".prev.sha256")


def undoable(path=None, text=None):
    """The revision an undo puts the kept file back over: the file as the last change wrote
    it. None when there is no change kept, or the file has been changed since."""
    path = path or machine.path()
    if not previous(path).exists() or not written(path).exists():
        return None
    current = revision(path.read_text() if text is None else text)
    return current if written(path).read_text().strip() == current else None


def accounts(config, home=None, logged_in=machine.account):
    """The Claude config folders a role may be moved to: the ones sq finds on this machine,
    as the page's logins list them, each with who it runs as and the roles on it."""
    return [{"folder": logins.shown(folder), "account": logged_in(folder), "roles": held}
            for folder, held in logins.folders(config, home).items()]


def found_folder(value, config, home=None):
    """The one of `accounts`' folders `value` resolves to, as they name it, else `Refused`:
    a folder's settings and hooks run in every worker started under it, so the page offers
    no other."""
    if isinstance(value, str) and value.strip():
        wanted = machine.expand(value.strip()).resolve()
        for folder in logins.folders(config, home):
            if folder.resolve() == wanted:
                return logins.shown(folder)
    raise Refused(400, f"error: {value!r} is not a Claude config folder sq found on this "
                       "machine; make it and log in to it there first")


def shown(value):
    """A folder as `accounts` names it, so the page can tell which one is chosen."""
    return logins.shown(machine.expand(value)) if isinstance(value, str) and value else value


def read(path=None, known=None, home=None, logged_in=machine.account):
    """What the page shows: each listed role's fields as the file sets them and as they are
    in force, the defaults, the machine's own, and what each field may be."""
    path = path or machine.path()
    text = path.read_text()
    config = json.loads(text)
    known = known or machine.models()
    defaults = config.get("defaults") or {}

    def field(own, key, role):
        if key == ACCOUNT:
            folder = machine.claude_dir(config, role)
            return {"value": shown(own.get(key)), "in_force": folder and logins.shown(folder),
                    "from": "role" if own.get(key) else "machine"}
        in_force = machine.settings(config, role).get(key)
        source = "role" if own.get(key) is not None else \
            "defaults" if defaults.get(key) is not None else "built-in"
        return {"value": own.get(key), "in_force": in_force, "from": source}

    def default(key):
        value = defaults.get(key)
        if value is not None:
            return {"value": value, "in_force": value, "from": "defaults"}
        floor = machine.BUILT_IN.get(key)
        return {"value": None, "in_force": floor, "from": "built-in" if floor is not None else None}

    return {
        "revision": revision(text), "undo": undoable(path, text) is not None,
        "models": {name: model["efforts"] for name, model in known.items()},
        "parallel": list(roles.PARALLEL),
        "accounts": accounts(config, home, logged_in),
        "machine": {"dailyBudgetUsd": config.get("dailyBudgetUsd"),
                    ACCOUNT: shown(config.get(ACCOUNT))},
        "defaults": {key: default(key) for key in DEFAULTS},
        "roles": {role: {key: field(own or {}, key, role) for key in ROLE}
                  for role, own in (config.get("roles") or {}).items()},
    }


def changed(config, where, changes, home=None):
    """`config` with `changes` made at `where`: "machine", "defaults" or a listed role. A
    null clears the field, so the role falls back to `defaults`, or for its account to the
    machine's. Returns the fields that changed, old and new."""
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
        if key == ACCOUNT and value is not None:
            value = found_folder(value, config, home)
        old = entry.get(key)
        if value == old:
            continue
        done[key] = {"old": old, "new": value}
        if value is None and where != "machine":
            entry.pop(key, None)
        else:
            entry[key] = value
    return done


def differences(before, after):
    """The page's fields that differ between two versions of the file, by where they live,
    old and new, as a save reports them."""
    def fields(config, where):
        if where == "machine":
            return {key: config.get(key) for key in MACHINE}
        if where == "defaults":
            return {key: (config.get("defaults") or {}).get(key) for key in DEFAULTS}
        own = (config.get("roles") or {}).get(where) or {}
        return {key: own.get(key) for key in ROLE}

    found = {}
    listed = list((before.get("roles") or {}))
    listed += [role for role in (after.get("roles") or {}) if role not in listed]
    for where in ["defaults", *listed, "machine"]:
        old, new = fields(before, where), fields(after, where)
        made = {key: {"old": old[key], "new": new[key]} for key in old if old[key] != new[key]}
        if made:
            found[where] = made
    return found


def problems(before, after, known, logged_in):
    """What `sq run` would say of `after` that it does not say of `before`, in its own words,
    so a role refused for something else, a missing login say, does not stop a change, nor
    does fixing one of two things wrong with a role."""
    errors, refused, _ = machine.check(before, known, logged_in)
    new_errors, new_refused, _ = machine.check(after, known, logged_in)
    found = [f"error: {error}" for error in new_errors if error not in errors]
    for role, why in new_refused.items():
        was = set(refused.get(role, "").split("; "))
        fresh = [part for part in why.split("; ") if part not in was]
        if fresh:
            found.append(f"refused {role}: {'; '.join(fresh)}")
    return found


def unready_accounts(after, done, logged_in):
    """`sq run`'s line for each folder `done` moves a role, or the machine, to with no
    Claude login, whether or not the role is refused already: `sq run` stops at a role's
    first refusal, so `problems` would not see it, and the role would stop on it later. A
    machine's folder names each role that runs under it, or itself when none does."""
    found = []
    for where, fields in done.items():
        new = (fields.get(ACCOUNT) or {}).get("new")
        if not new or logged_in(machine.expand(new)):
            continue
        folder = machine.expand(new)
        if where != "machine":
            found.append(f"refused {where}: {machine.no_login(folder)}")
            continue
        under = [role for role, own in (after.get("roles") or {}).items()
                 if not (own or {}).get(ACCOUNT)]
        found += [f"refused {role}: {machine.no_login(folder)}" for role in under] or \
            [f"error: {machine.no_login(folder)}"]
    return found


def stale(path):
    return Refused(409, f"error: {path} changed since the page read it; read it again")


def save(changes, asked_revision, path=None, known=None, logged_in=machine.account,
         home=None):
    """Makes `changes`, `{where: {field: value}}`, as one change: checked once, written once,
    undone at once. Returns what changed, `{where: {field: {old, new}}}`, or raises
    `Refused` having written nothing."""
    if not isinstance(changes, dict) or not changes or not all(
            isinstance(fields, dict) and fields for fields in changes.values()):
        raise Refused(400, "error: a save names the fields it changes, by where they live")
    path = path or machine.path()
    known = known or machine.models()
    with WRITING:
        text = path.read_text()
        if asked_revision != revision(text):
            raise stale(path)
        before, after = json.loads(text), json.loads(text)
        done = {}
        for where, fields in changes.items():
            made = changed(after, str(where), fields, home)
            if made:
                done[str(where)] = made
        if not done:
            return done
        found = unready_accounts(after, done, logged_in)
        found += [line for line in problems(before, after, known, logged_in)
                  if line not in found]
        if found:
            raise Refused(409, "\n".join(found))
        write(path, json.dumps(after, indent=2) + "\n", keep=text)
    return done


def undo(asked_revision, path=None):
    """Puts back the file the last change replaced, and returns what that changed back.
    None when there is no change kept; refused when the file changed since the page read it,
    or since that change wrote it, so a hand edit is never undone."""
    path = path or machine.path()
    with WRITING:
        kept = previous(path)
        if not kept.exists():
            return None
        text = path.read_text()
        if asked_revision != revision(text):
            raise stale(path)
        if undoable(path, text) is None:
            raise Refused(409, f"error: {path} was changed by hand since the last change from "
                               "the page, so the page cannot undo it; change it there")
        done = differences(json.loads(text), json.loads(kept.read_text()))
        os.replace(kept, path)
        written(path).unlink(missing_ok=True)
    return done


def write(path, text, keep):
    mode = path.stat().st_mode & 0o777
    kept, fresh, wrote = previous(path), path.with_name(path.name + ".new"), written(path)
    wrote.unlink(missing_ok=True)
    for target, content in ((kept, keep), (fresh, text)):
        target.write_text(content)
        target.chmod(mode)
    os.replace(fresh, path)
    wrote.write_text(revision(text) + "\n")
    wrote.chmod(mode)
