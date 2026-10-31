"""Brings a role's checkout up to the latest `main` before its worker starts. Plain git, no
model: it costs nothing, and it never throws away work."""

import json
import pathlib
import re
import subprocess
import time

from . import roles

BUILDING = ("To Do", "Ready For Dev", "In Progress", "Failed QA", "Failed Code Review")
BRANCH_HOLDERS = (*roles.DEVS, "l10n")


def decide(role, branch, dirty, story=None):
    """What to do with a checkout: `branch` is None when the head is detached."""
    if dirty:
        return "leave-dirty"
    if branch is None:
        return "move-to-main"
    if branch == "main":
        return "fast-forward"
    if role in BRANCH_HOLDERS and story and story["state"] in BUILDING \
            and re.search(rf"sc-{story['id']}\b", branch):
        return "merge-main"
    return "fetch-only"


def git(path, *args, check=True):
    return subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True,
                          check=check)


class Unprepared(RuntimeError):
    """The checkout could not be brought up to main; the message is git's own."""


def fetch(path, tries=3, sleep=time.sleep):
    # Every role checkout is a worktree of one repository, so a fetch can lose a ref lock to
    # another worker's fetch or push. A moment later the lock is free.
    for attempt in range(1, tries + 1):
        done = git(path, "fetch", "--quiet", "--prune", "origin", check=False)
        if not done.returncode:
            return
        if attempt < tries:
            sleep(5 * attempt)
    raise Unprepared(f"git fetch failed {tries} times: {done.stderr.strip()}")


SET_ASIDE = ".sq-untracked"


def clear_way(path, target="origin/main"):
    """An untracked file the target tracks stops git moving onto it. One holding the target's
    content goes, since the move brings it back; any other is set aside, never deleted.
    Returns where each set-aside file went, and what stopped the clearing, or None."""
    folder = pathlib.Path(SET_ASIDE, time.strftime("%Y-%m-%d-%H%M%S"))
    moved = []
    try:
        tracked = set(git(path, "ls-tree", "-r", "-z", "--name-only", target).stdout.split("\0"))
        untracked = git(path, "ls-files", "--others", "--exclude-standard", "-z").stdout
        for name in (name for name in untracked.split("\0") if name and name in tracked):
            file = path / name
            theirs = subprocess.run(["git", "-C", str(path), "show", f"{target}:{name}"],
                                    capture_output=True, check=True).stdout
            if file.read_bytes() == theirs:
                file.unlink()
                continue
            (path / folder / name).parent.mkdir(parents=True, exist_ok=True)
            file.rename(path / folder / name)
            moved.append(f"{name} -> {folder / name}")
    except (OSError, subprocess.CalledProcessError) as error:
        return moved, f"Clearing untracked files out of main's way stopped: {error}"
    return moved, None


def ensure(base, path):
    """A further worker's checkout: a worktree of the role's own, made the first time."""
    if path.exists():
        return
    # A checkout deleted by hand stays registered, and git refuses its path until pruned.
    git(base, "worktree", "prune", check=False)
    made = git(base, "worktree", "add", "--quiet", "--detach", str(path), "origin/main",
               check=False)
    if made.returncode:
        raise Unprepared(f"git worktree add {path} failed: {made.stderr.strip()}")


STALE_STACK = ("Your QA stack still runs the build of {built}, and your checkout is at {head}. "
               "`node .qa/bin/qa-env.mjs checkout <ref>` rebuilds it before you test.")


def stack_build(path):
    """The commit `qa-env checkout` last built the stack from, or None if it never has."""
    try:
        return json.loads((pathlib.Path(path) / ".qa/state.json").read_text()).get("head")
    except (OSError, ValueError):
        return None


def prepare(path, role, story=None, sleep=time.sleep):
    """Returns `(main_sha, note)`; the note is what the worker is told, or None."""
    fetch(path, sleep=sleep)
    main = git(path, "rev-parse", "origin/main").stdout.strip()
    branch = git(path, "symbolic-ref", "--quiet", "--short", "HEAD", check=False).stdout.strip()
    dirty = bool(git(path, "status", "--porcelain", "--untracked-files=no").stdout.strip())
    action = decide(role, branch or None, dirty, story)
    if action == "leave-dirty":
        return main, ("Your checkout has changes nobody committed, so it was not brought up to "
                      "main. Look at them first: they may be an earlier run's work.")
    moved, stopped = clear_way(path) if action != "fetch-only" else ([], None)
    note = None
    if action == "move-to-main":
        moved_on = git(path, "checkout", "--quiet", "--detach", "origin/main", check=False)
        if moved_on.returncode:
            note = (f"Your checkout could not be brought up to main, so it was left as it was. "
                    f"Git said: {moved_on.stderr.strip()}")
    elif action == "fast-forward":
        if git(path, "merge", "--ff-only", "--quiet", "origin/main", check=False).returncode:
            note = "Your local main has commits origin/main does not; it was left alone."
    elif action == "merge-main":
        merged = git(path, "merge", "--no-edit", "--quiet", "origin/main", check=False)
        if merged.returncode:
            git(path, "merge", "--abort", check=False)
            note = (f"Merging origin/main into {branch} conflicts, so it was undone. "
                    "Merge it and resolve the conflict before anything else.")
    if moved:
        outcome = ("so they were moved aside and main's took their place" if note is None
                   else "so they were moved aside, and the checkout stayed where it was")
        note = "\n".join(filter(None, [note, (
            f"These untracked files differed from the copy main now has, {outcome}. Compare "
            "them before you rely on either: " + "; ".join(moved))]))
    built = stack_build(path) if role in roles.TESTERS else None
    head = git(path, "rev-parse", "HEAD").stdout.strip()
    if built and not head.startswith(built):
        stopped = "\n".join(filter(None, [stopped, STALE_STACK.format(built=built, head=head[:7])]))
    note = "\n".join(filter(None, [note, stopped])) or None
    return main, note
