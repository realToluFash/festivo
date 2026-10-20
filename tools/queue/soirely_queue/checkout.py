"""Brings a role's checkout up to the latest `main` before its worker starts. Plain git, no
model: it costs nothing, and it never throws away work."""

import re
import subprocess

BUILDING = ("To Do", "Ready For Dev", "In Progress", "Failed QA", "Failed Code Review")
BRANCH_HOLDERS = ("dev", "dev2", "l10n")


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


def prepare(path, role, story=None):
    """Returns `(main_sha, note)`; the note is what the worker is told, or None."""
    git(path, "fetch", "--quiet", "--prune", "origin")
    main = git(path, "rev-parse", "origin/main").stdout.strip()
    branch = git(path, "symbolic-ref", "--quiet", "--short", "HEAD", check=False).stdout.strip()
    dirty = bool(git(path, "status", "--porcelain", "--untracked-files=no").stdout.strip())
    action = decide(role, branch or None, dirty, story)
    if action == "leave-dirty":
        return main, ("Your checkout has changes nobody committed, so it was not brought up to "
                      "main. Look at them first: they may be an earlier run's work.")
    if action == "move-to-main":
        git(path, "checkout", "--quiet", "--detach", "origin/main")
    elif action == "fast-forward":
        if git(path, "merge", "--ff-only", "--quiet", "origin/main", check=False).returncode:
            return main, "Your local main has commits origin/main does not; it was left alone."
    elif action == "merge-main":
        merged = git(path, "merge", "--no-edit", "--quiet", "origin/main", check=False)
        if merged.returncode:
            git(path, "merge", "--abort", check=False)
            return main, (f"Merging origin/main into {branch} conflicts, so it was undone. "
                          "Merge it and resolve the conflict before anything else.")
    return main, None
