"""Keeps the installed `sq` on merged `main`, and only on a commit CI passed: a broken `sq`
on `main` would otherwise stop every role on every machine at once."""

import pathlib
import shutil
import subprocess
import tempfile

from . import store

EVERY_SECONDS = 10 * 60
IGNORED = shutil.ignore_patterns("tests", "__pycache__", "*.md")


def git(home, *args):
    return subprocess.run(["git", f"--git-dir={home.parent}", *args], capture_output=True,
                          text=True, check=True).stdout.strip()


def tree_file(home):
    return home / "sq" / ".tree"


def installed(home):
    path = tree_file(home)
    return path.read_text().strip() if path.exists() else None


def green(db, sha):
    """CI's word on `sha` from main's last runs: True, False, or None when they do not
    name it."""
    runs = [r for r in store.get_meta(db, "main_runs") or [] if r.get("headSha") == sha]
    if not runs:
        return None
    return all(r.get("conclusion") in ("success", "skipped") for r in runs)


def copy(source, home, tree):
    target = home / "sq"
    staging = home / "sq.new"
    if staging.exists():
        shutil.rmtree(staging)
    shutil.copytree(source, staging, ignore=IGNORED)
    (staging / ".tree").write_text(tree + "\n")
    if target.exists():
        shutil.rmtree(target)
    staging.rename(target)


def install_from_main(home, sha, tree):
    with tempfile.TemporaryDirectory() as folder:
        archive = subprocess.run(["git", f"--git-dir={home.parent}", "archive", sha,
                                  "tools/queue"], capture_output=True, check=True).stdout
        subprocess.run(["tar", "-x", "-C", folder], input=archive, check=True)
        copy(pathlib.Path(folder) / "tools" / "queue", home, tree)


def check(db, home, now, say, force=False, fetch=True):
    """Updates `sq` when `main` changed it and CI passed. Returns True when it did."""
    if not force and now - store.get_meta(db, "update_checked_at", 0) < EVERY_SECONDS:
        return False
    store.set_meta(db, "update_checked_at", now)
    try:
        if fetch:
            git(home, "fetch", "--quiet", "origin", "main")
        sha = git(home, "rev-parse", "origin/main")
        tree = git(home, "rev-parse", "origin/main:tools/queue")
    except subprocess.CalledProcessError as error:
        say(f"warning: could not check main for a newer sq ({error.stderr.strip()[:200]}); "
            "running the installed one")
        return False
    if installed(home) == tree:
        return False
    verdict = green(db, sha)
    if not verdict:
        say(f"warning: main at {sha[:7]} changes sq, but CI has "
            f"{'not passed it' if verdict is False else 'no result for it yet'}; "
            "running the installed one")
        return False
    install_from_main(home, sha, tree)
    say(f"updated sq to main at {sha[:7]}")
    return True
