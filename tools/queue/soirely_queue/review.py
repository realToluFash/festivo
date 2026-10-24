"""A lead review runs in a worktree of its own at the pull request's head, so two lead
workers never share a checkout and the lead's own checkout never leaves its commit."""

import io
import os
import shutil
import subprocess
import tarfile

from .checkout import Unprepared, git

ROLES = ("lead",)
MODULES = ("node_modules", "*/node_modules", "*/*/node_modules")
VENDORS = ("vendor", "*/vendor", "*/*/vendor")
# What Composer rewrites in place on an install, so copied rather than hard-linked.
REWRITTEN = ("autoload.php", "composer", "bin")


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


def make(path, packages, head, pr=None, rules=None):
    """A fresh worktree beside `path` at `head`, with the installed packages of checkout
    `packages` linked in and the Claude rules of commit `rules` in place of the head's.
    Returns its path."""
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
        if rules:
            put_back_rules(tree, rules)
    except (OSError, tarfile.TarError) as error:
        remove(path)
        raise Unprepared(f"putting {rules[:7]}'s Claude rules into {tree} failed: {error}") \
            from error
    try:
        link_packages(packages, tree)
    except OSError as error:
        remove(path)
        raise Unprepared(f"linking {packages}'s packages into {tree} failed: {error}") from error
    return tree


def is_rule(name):
    parts = name.split("/")
    return ".claude" in parts[:-1] or parts[-1] in ("CLAUDE.md", "CLAUDE.local.md")


def rules_at(tree, commit):
    listed = git(tree, "ls-tree", "-r", "--name-only", "-z", commit).stdout
    return [name for name in listed.split("\0") if name and is_rule(name)]


def put_back_rules(tree, commit):
    """Claude Code takes its skills, CLAUDE.md and settings from the folder it starts in, so
    the head's are swapped for main's: a branch never reviews itself under its own rules."""
    for name in rules_at(tree, "HEAD"):
        (tree / name).unlink(missing_ok=True)
    names = rules_at(tree, commit)
    if not names:
        return
    archive = subprocess.run(["git", "-C", str(tree), "archive", "--format=tar", commit,
                              "--", *names], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(tree, filter="data")


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
            shutil.copytree(base / rel, tree / rel, symlinks=True, copy_function=hard_link,
                            ignore=lambda folder, _: REWRITTEN if folder == str(base / rel)
                            else ())
            for name in REWRITTEN:
                if (base / rel / name).is_dir():
                    shutil.copytree(base / rel / name, tree / rel / name, symlinks=True)
                elif (base / rel / name).exists():
                    shutil.copy2(base / rel / name, tree / rel / name)


def link_modules(source, target):
    """Each package linked to the base checkout's, but a workspace link copied as it is, so
    `@soirely/domain` resolves to the worktree's own package rather than the base's."""
    target.mkdir()
    for entry in os.scandir(source):
        into = target / entry.name
        if entry.is_symlink():
            os.symlink(os.readlink(entry.path), into)
        elif entry.name.startswith("@") and entry.is_dir() and has_link(entry.path):
            link_modules(entry.path, into)
        else:
            os.symlink(entry.path, into)


def has_link(folder):
    with os.scandir(folder) as entries:
        return any(child.is_symlink() for child in entries)


def hard_link(source, target):
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def note(tree, head, pr, base):
    what = f"#{pr}'s head {head[:7]}" if pr else f"origin/main {head[:7]}"
    return (f"This review runs in a worktree of its own at {what}, {tree}, removed after the "
            f"run. Run and change code only here; never check out, change or run tests in "
            f"{base}. Its .claude/ and CLAUDE.md are main's, so read the pull request's own "
            f"with `git show HEAD:<path>`. Its packages are main's installs: install nothing "
            f"here, and if the pull request changes a lockfile, say in the review that its "
            f"tests ran against main's packages.")
