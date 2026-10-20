"""Permission rules the owner has granted the workers, and the rules no worker ever gets.

`tools/queue/permissions.json` on `main` says what is granted. It reaches a machine only
when the owner runs `just agents permissions apply` at a keyboard, which copies it into
this machine's config folder. The runner then hands each worker its role's rules on the
command line (`--allowedTools`), with the admin commands and the config files denied
(`--disallowedTools`). No Claude settings file is written by anyone."""

import json
import os
import pathlib
import re
import subprocess
import sys

from . import machine

FILE = "tools/queue/permissions.json"
RULE = re.compile(r"^([A-Za-z]+)(?:\((.+)\))?$")
# Tools a rule must narrow: bare, or with only wildcards, each grants the whole tool.
NARROW = {"Bash", "Edit", "Write", "MultiEdit", "NotebookEdit", "WebFetch"}
WILDCARD = re.compile(r"^[\s*:/~.]*$")


class Invalid(RuntimeError):
    pass


def applied_path():
    return machine.config_dir() / "permissions.json"


def parse(text, where):
    try:
        data = json.loads(text)
    except ValueError as error:
        raise Invalid(f"{where} is not valid JSON: {error}") from error
    rules = data.get("rules") if isinstance(data, dict) else None
    if not isinstance(rules, list):
        raise Invalid(f"{where} has no rules list")
    from . import roles
    for entry in rules:
        rule, names = entry.get("rule"), entry.get("roles")
        match = RULE.match(rule) if isinstance(rule, str) else None
        if not match:
            raise Invalid(f"{where}: {rule!r} is not a permission rule such as "
                                   "Bash(xcrun simctl boot:*)")
        if match.group(1) in NARROW and WILDCARD.match(match.group(2) or ""):
            raise Invalid(f"{where}: {rule} grants every {match.group(1)} call; name the "
                          f"command or path, such as Bash(xcrun simctl boot:*)")
        if not isinstance(names, list) or not names or any(
                n != "all" and n not in roles.ROLES for n in names):
            raise Invalid(f"{where}: {rule} names no roles, or one sq does not know")
        if not isinstance(entry.get("ask"), int):
            raise Invalid(f"{where}: {rule} names no ask (its comment on sc-4992)")
    return rules


def applied():
    path = applied_path()
    if not path.exists():
        return []
    return parse(path.read_text(), path)


def installed(home):
    path = home / "sq" / "permissions.json"
    return parse(path.read_text(), path) if path.exists() else []


def for_role(rules, role):
    return [entry["rule"] for entry in rules if "all" in entry["roles"] or role in entry["roles"]]


def as_path(path):
    """A path as Claude's permission rules write it: `~/` under home, `//` for absolute."""
    path = pathlib.Path(path).expanduser()
    try:
        return "~/" + str(path.relative_to(pathlib.Path.home()))
    except ValueError:
        return "/" + str(path)


def denied(sq, claude_folder):
    """What no worker may run or edit, whatever it was granted: a guard against a worker
    that misreads a thread. The boundary is that granting needs the owner at a keyboard."""
    from .cli import OWNER_ONLY
    rules = []
    for command in OWNER_ONLY:
        rules += [f"Bash(python3 {sq} {command}:*)", f"Bash({sq} {command}:*)",
                  f"Bash(sq {command}:*)"]
    rules += ["Bash(just agents:*)", "Bash(systemctl --user:*)"]
    for folder in (machine.config_dir(), claude_folder):
        if folder:
            rules += [f"Edit({as_path(folder)}/**)", f"Write({as_path(folder)}/**)"]
    return rules


def difference(before, after):
    key = lambda entry: (entry["rule"], tuple(sorted(entry["roles"])))  # noqa: E731
    old, new = {key(e) for e in before}, {key(e) for e in after}
    return sorted(new - old), sorted(old - new)


def pending(home):
    """What `main`'s file (as installed with sq) has that this machine has not applied."""
    try:
        added, removed = difference(applied(), installed(home))
    except Invalid as error:
        return [f"error: {error}"]
    lines = [f"+ {rule} for {', '.join(names)}" for rule, names in added]
    return lines + [f"- {rule} for {', '.join(names)}" for rule, names in removed]


def apply(home, say=print, ask=input, interactive=None, show=None):
    """Only the owner, at a terminal: shows what `main` grants that this machine has not
    applied, and writes it only after a yes typed at the keyboard."""
    interactive = sys.stdin.isatty() if interactive is None else interactive
    if os.environ.get("SOIRELY_WORKER"):
        say(f"error: permissions are the owner's to apply, and this is "
            f"{os.environ['SOIRELY_WORKER']}'s worker")
        return 1
    if not interactive:
        say("error: run this in your own terminal; it needs a yes typed at the keyboard")
        return 1
    git = ["git", f"--git-dir={home.parent}"]
    show = show or (lambda: (
        subprocess.run(git + ["fetch", "--quiet", "origin", "main"], check=True),
        subprocess.run(git + ["rev-parse", "origin/main"], capture_output=True, text=True,
                       check=True).stdout.strip(),
        subprocess.run(git + ["show", f"origin/main:{FILE}"], capture_output=True,
                       text=True).stdout)[1:])
    sha, text = show()
    try:
        # A file deleted from main revokes everything it granted.
        rules = parse(text, f"{FILE} at {sha[:7]}") if text else []
        added, removed = difference(applied(), rules)
    except Invalid as error:
        say(f"error: {error}")
        return 1
    if not added and not removed:
        say(f"this machine already has every rule main grants at {sha[:7]}")
        return 0
    say(f"main at {sha[:7]} changes what this machine's workers may run:")
    for rule, names in added:
        say(f"  + {rule}  for {', '.join(names)}")
    for rule, names in removed:
        say(f"  - {rule}  for {', '.join(names)}")
    if ask("Apply these to this machine's workers? Type yes: ").strip().lower() != "yes":
        say("nothing applied")
        return 1
    path = applied_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"from": sha, "rules": rules}, indent=2) + "\n")
    path.chmod(0o600)
    say(f"applied; workers started from now on run with them ({path})")
    return 0
