"""A lead review runs in a worktree of its own at the pull request's head, so two lead
workers never share a checkout and the lead's own checkout never leaves its commit."""

import os
import shutil

from .checkout import Unprepared, git

ROLES = ("lead",)
MODULES = ("node_modules", "*/node_modules", "*/*/node_modules")
VENDORS = ("vendor", "*/vendor", "*/*/vendor")


def place(path):
    return path.with_name(f"{path.name}-review")


def remove(path):
    """Takes the review worktree beside checkout `path` away, whatever state it is in."""
    if not path:
        return
    tree = place(path)
    if path.exists():
        git(path, "worktree", "remove", "--force", str(tree), check=False)
    if tree.is_symlink():
        tree.unlink()
    elif tree.exists():
        shutil.rmtree(tree)
    if path.exists():
        git(path, "worktree", "prune", check=False)


def make(path, packages, head, pr=None):
    """A fresh worktree beside `path` at `head`, with the installed packages of checkout
    `packages` linked in. Returns its path."""
    remove(path)
    tree = place(path)
    added = git(path, "worktree", "add", "--quiet", "--detach", str(tree), head, check=False)
    if added.returncode and pr:
        # A head pushed after the checkout's fetch is not there yet.
        git(path, "fetch", "--quiet", "origin", f"pull/{pr}/head", check=False)
        added = git(path, "worktree", "add", "--quiet", "--detach", str(tree), head,
                    check=False)
    if added.returncode:
        raise Unprepared(f"git worktree add {tree} {head} failed: {added.stderr.strip()}")
    try:
        link_packages(packages, tree)
    except OSError as error:
        remove(path)
        raise Unprepared(f"linking {packages}'s packages into {tree} failed: {error}") from error
    return tree


def installed(base, patterns, marker=None):
    for pattern in patterns:
        for found in sorted(base.glob(pattern)):
            rel = found.relative_to(base)
            if found.is_dir() and not found.is_symlink() and "node_modules" not in rel.parts[:-1] \
                    and (marker is None or (found.parent / marker).exists()):
                yield rel


def link_packages(base, tree):
    if not base or not base.exists():
        return
    for rel in installed(base, MODULES):
        if (tree / rel).parent.is_dir() and not (tree / rel).exists():
            link_modules(base / rel, tree / rel)
    for rel in installed(base, VENDORS, marker="composer.json"):
        if (tree / rel).parent.is_dir() and not (tree / rel).exists():
            # Composer's autoloader finds the code relative to its own real path, so a link
            # would load the base checkout's classes; hard links keep it in the worktree.
            shutil.copytree(base / rel, tree / rel, symlinks=True, copy_function=hard_link)


def link_modules(source, target):
    """Each package linked to the base checkout's, but a workspace link copied as it is, so
    `@soirely/domain` resolves to the worktree's own package rather than the base's."""
    target.mkdir()
    for entry in os.scandir(source):
        into = target / entry.name
        if entry.is_symlink():
            os.symlink(os.readlink(entry.path), into)
        elif entry.name.startswith("@") and entry.is_dir() and \
                any(child.is_symlink() for child in os.scandir(entry.path)):
            link_modules(entry.path, into)
        else:
            os.symlink(entry.path, into)


def hard_link(source, target):
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def note(tree, head, pr, base):
    what = f"#{pr}'s head {head[:7]}" if pr else f"origin/main {head[:7]}"
    return (f"This review runs in a worktree of its own at {what}, {tree}, removed after the "
            f"run. Run and change code only here; never check out, change or run tests in "
            f"{base}.")
