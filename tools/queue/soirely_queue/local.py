"""ops@<machine>: the work only this machine can see. Every machine runs it, whichever
machine holds ops' shared duties, and it never touches another computer.

The checks run in the minute, with no model. Each finding becomes an ops work item of kind
`machine`, which this machine's ops takes even while another machine holds the ops lease."""

import json
import os
import pathlib
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request

from . import machine, roles as R, store

DOCKER_EVERY_SECONDS = 30 * 60
BUILD_CACHE_GB = 20
SWEEP_SECONDS = 24 * 60 * 60
STACK_SECONDS = 30
SIZE = re.compile(r"([\d.]+)\s*([kMGT]?B)", re.I)
UNITS = {"b": 1e-9, "kb": 1e-6, "mb": 1e-3, "gb": 1, "tb": 1e3}
SCRATCH_DAYS = 3
SMALL_DAYS = 14
SMALL_BYTES = 1_000_000
NEVER_SWEPT = "untracked-before-main-"
HARNESS = ("bin", "state.json")
STORY_NUMBER = re.compile(r"\d{4,}")
LARGEST = 5
DU_SECONDS = 300


def gigabytes(text):
    match = SIZE.search(text or "")
    return float(match.group(1)) * UNITS[match.group(2).lower()] if match else 0.0


def build_cache_gb():
    try:
        out = subprocess.run(["docker", "system", "df", "--format", "{{json .}}"],
                             capture_output=True, text=True, timeout=60).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    for line in out.splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get("Type") == "Build Cache":
            return gigabytes(row.get("Size"))
    return None


def stack_problem(role):
    """Why the role's own stack cannot be tested against now, or None once its API answers.
    A role with no checkout on this machine is not checked."""
    try:
        place = machine.checkout(machine.load(), role)
    except machine.ConfigError:
        return None
    if not place or not place.exists():
        return None
    try:
        out = subprocess.run(["docker", "compose", "port", "api", "80"], cwd=place,
                             capture_output=True, text=True, timeout=STACK_SECONDS)
    except FileNotFoundError:
        return "docker is not on PATH"
    except (OSError, subprocess.TimeoutExpired):
        return f"Docker did not answer within {STACK_SECONDS} seconds"
    port = out.stdout.strip().rsplit(":", 1)[-1]
    if out.returncode or not port.isdigit():
        return f"the api service in {place} is not running"
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=10) as reply:
            if reply.status == 200:
                return None
            return f"the API on port {port} answers {reply.status}"
    except urllib.error.HTTPError as error:
        return f"the API on port {port} answers {error.code}"
    except OSError as error:
        return f"the API on port {port} does not answer ({error})"


def footprint(path):
    """The newest change anywhere in an entry, and its size in bytes. Links are not followed."""
    stat = path.lstat()
    newest, size = stat.st_mtime, stat.st_size
    if path.is_dir() and not path.is_symlink():
        for folder, _, files in os.walk(path):
            for name in files:
                try:
                    stat = os.lstat(os.path.join(folder, name))
                except OSError:
                    continue
                newest, size = max(newest, stat.st_mtime), size + stat.st_size
    return newest, size


def held_stories(stories, tester):
    return {str(story["id"]) for story in stories
            if not story.get("done") and story.get("state") == "In QA"
            and R.last_tester(story) == tester}


def scratch_folders(config):
    """Each tester checkout's `.qa/` on this machine, with the tester it belongs to."""
    for tester in R.TESTERS:
        count = machine.settings(config, tester).get("workers")
        for worker in machine.worker_names(tester, count):
            place = machine.checkout(config, tester, worker)
            if place and (place / ".qa").is_dir():
                yield tester, place / ".qa"


def sweep_scratch(db, config, now=None, say=print):
    """Once a day, clears what testers left in `.qa/`: an entry nothing has touched for three
    days, or fourteen for one under a megabyte, unless its story is In QA under that tester."""
    now = now or time.time()
    period = int(now // SWEEP_SECONDS)
    if (store.get_meta(db, "scratch_swept") or {}).get("period") == period:
        return
    store.set_meta(db, "scratch_swept", {"period": period})
    stories = store.stories(db)
    for tester, scratch in scratch_folders(config):
        held, freed, gone = held_stories(stories, tester), 0, 0
        for entry in scratch.iterdir():
            if entry.name.startswith((NEVER_SWEPT, ".")) or entry.name in HARNESS or \
                    set(STORY_NUMBER.findall(entry.name)) & held:
                continue
            try:
                newest, size = footprint(entry)
            except OSError:
                continue
            days = SMALL_DAYS if size < SMALL_BYTES else SCRATCH_DAYS
            if now - newest < days * SWEEP_SECONDS:
                continue
            try:
                if entry.is_dir() and not entry.is_symlink():
                    shutil.rmtree(entry)
                else:
                    entry.unlink()
            except OSError as error:
                say(f"warning: could not sweep {entry}: {error}")
                continue
            freed, gone = freed + size, gone + 1
        if gone:
            say(f"swept {amount(freed)} from {scratch}: {gone} entries untouched for "
                f"{SCRATCH_DAYS} days")


def amount(size):
    return f"{size / 1e9:.1f} GB" if size >= 1e9 else f"{size / 1e6:.0f} MB"


def largest_folders(config):
    """The workspace's five largest folders, then the simulators and the emulators, as
    `name size` for an ops item to name."""
    root = machine.workspace(config)
    inside = sorted(p for p in root.iterdir() if p.is_dir() and not p.is_symlink()) \
        if root and root.is_dir() else []
    devices = [pathlib.Path(p).expanduser() for p in
               ("~/Library/Developer/CoreSimulator/Devices", "~/.android/avd")]
    devices = [p for p in devices if p.exists()]
    try:
        out = subprocess.run(["du", "-sk", *map(str, inside + devices)],
                             capture_output=True, text=True, timeout=DU_SECONDS).stdout
    except (OSError, subprocess.TimeoutExpired):
        return f"du did not finish within {DU_SECONDS} seconds"
    sizes = {}
    for line in out.splitlines():
        kb, _, path = line.partition("\t")
        if kb.isdigit():
            sizes[pathlib.Path(path)] = int(kb) / 1e6
    named = sorted((p for p in inside if p in sizes), key=lambda p: -sizes[p])[:LARGEST]
    return ", ".join(f"{p} {sizes[p]:.1f} GB" for p in named + [d for d in devices
                                                                  if d in sizes])


def checks(db, config, now=None, cache=None, free=None, largest=None):
    """What needs this machine's ops now, kept for the work it becomes."""
    now = now or time.time()
    cache, free = cache or build_cache_gb, free or machine.free_gb
    largest = largest or largest_folders
    name = config.get("machine") or "machine"
    found = []
    floor = config.get("minFreeGb", 15)
    left = free(config)
    if floor and left < floor:
        found.append({"key": "disk", "urgent": True, "period": int(now // SWEEP_SECONDS),
                      "reason": f"only {left:.0f} GB free on {name}, under minFreeGb {floor}: "
                                "free space before workers can start again"})
    elif floor and left < 2 * floor:
        period = int(now // SWEEP_SECONDS)
        seen = store.get_meta(db, "largest_folders") or {}
        if seen.get("period") != period:
            seen = {"period": period, "text": largest(config)}
            store.set_meta(db, "largest_folders", seen)
        found.append({"key": "disk-falling", "urgent": False, "period": period,
                      "reason": f"{left:.0f} GB free on {name}, under twice minFreeGb {floor}; "
                                f"the largest: {seen['text']}"})
    seen = store.get_meta(db, "build_cache") or {}
    if now - seen.get("at", 0) >= DOCKER_EVERY_SECONDS:
        seen = {"at": now, "gb": cache()}
        store.set_meta(db, "build_cache", seen)
    if seen.get("gb") and seen["gb"] > BUILD_CACHE_GB:
        found.append({"key": "build-cache", "urgent": True, "period": int(now // SWEEP_SECONDS),
                      "reason": f"Docker's build cache is {seen['gb']:.0f} GB on {name}: "
                                "`just prune-build-cache`"})
    found.append({"key": "sweep", "urgent": False, "period": int(now // SWEEP_SECONDS),
                  "reason": f"the daily sweep of {name}: disk, Docker, the role stacks and "
                            "the manager"})
    store.set_meta(db, "machine_checks", {"machine": name, "found": found})
    return found
