"""Keeps a tester's copy of the QA harness on `main`, on `sq`'s own green rule. The copy lives
outside git so that checking out an old commit keeps it; only this brings it forward."""

import os
import subprocess

from . import update

COPY = ".qa/bin/qa-env.mjs"
SOURCE = "scripts/qa-env.mjs"


def refresh(db, path, main):
    """Replaces the copy with main's harness at the start of a tester's run. Returns the line
    the worker is told, or None when the copy is missing or already main's."""
    copy = path / COPY
    try:
        copy.stat()
    except FileNotFoundError:
        return None
    except OSError as error:
        return f"Your QA harness ({COPY}) was kept: it could not be read ({error})."
    short = main[:7]
    shown = subprocess.run(["git", "-C", str(path), "show", f"{main}:{SOURCE}"],
                           capture_output=True, check=False)
    if shown.returncode:
        reason = shown.stderr.decode(errors="replace").strip()[:200]
        return f"Your QA harness ({COPY}) was kept: main at {short} could not be read ({reason})."
    try:
        if copy.read_bytes() == shown.stdout:
            return None
    except OSError as error:
        return f"Your QA harness ({COPY}) was kept: it could not be read ({error})."
    verdict = update.green(db, main)
    if not verdict:
        return (f"Your QA harness ({COPY}) was kept: main at {short} changes it, but CI has "
                f"{'not passed it' if verdict is False else 'no result for it yet'}.")
    staged = copy.with_name(copy.name + ".new")
    try:
        staged.write_bytes(shown.stdout)
        os.chmod(staged, copy.stat().st_mode & 0o7777)
        os.replace(staged, copy)
    except OSError as error:
        staged.unlink(missing_ok=True)
        return f"Your QA harness ({COPY}) was kept: it could not be replaced ({error})."
    return f"Your QA harness ({COPY}) was updated to main at {short}."
