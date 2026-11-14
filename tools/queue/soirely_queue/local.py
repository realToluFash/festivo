"""ops@<machine>: the work only this machine can see. Every machine runs it, whichever
machine holds ops' shared duties, and it never touches another computer.

The checks run in the minute, with no model. Each finding becomes an ops work item of kind
`machine`, which this machine's ops takes even while another machine holds the ops lease."""

import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

from . import checkout, machine, roles as R, store

DOCKER_EVERY_SECONDS = 30 * 60
# About 8s on a healthy daemon; a hung one is asked again in half an hour, not waited on.
DOCKER_SECONDS = 20
BUILD_CACHE_GB = 20
SWEEP_SECONDS = 24 * 60 * 60
STACK_SECONDS = 30
SIZE = re.compile(r"([\d.]+)\s*([kMGT]?B)", re.I)
UNITS = {"b": 1e-9, "kb": 1e-6, "mb": 1e-3, "gb": 1, "tb": 1e3}
SCRATCH_DAYS = 3
SMALL_DAYS = 14
SMALL_BYTES = 1_000_000
RECENT_SECONDS = 60 * 60
NEVER_SWEPT = "untracked-before-main-"
HARNESS = ("bin", "state.json")
RECORDS = {"release": ("installed",)}
STORY_NUMBER = re.compile(r"\d{4,}")
STORY_REF = re.compile(r"sc-?(\d+)", re.I)
# Evidence is attached on Shortcut by then, so `.qa/sc<N>*` has done its job.
EVIDENCE_DONE = ("Passsed QA", "Done")
# Merged, so the worktree that built it holds nothing a later step needs.
WORKTREE_DONE = ("Ready For QA", "In QA", "Passsed QA", "Done")
GENERATED = ("node_modules", "pnpm-workspace.yaml")
LARGEST = 5
MEASURE_SECONDS = 30 * 60
DEVICES = ("~/Library/Developer/CoreSimulator/Devices", "~/.android/avd")
DOCKER_APP = pathlib.Path("/Applications/Docker.app")
DOCKER_SOCKET = "~/.docker/run/docker.sock"
WAKE_SECONDS = 5 * 60


def gigabytes(text):
    match = SIZE.search(text or "")
    return float(match.group(1)) * UNITS[match.group(2).lower()] if match else 0.0


def build_cache_gb():
    try:
        out = subprocess.run(["docker", "system", "df", "--format", "{{json .}}"],
                             capture_output=True, text=True, timeout=DOCKER_SECONDS).stdout
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


def docker_answers(sock=DOCKER_SOCKET):
    try:
        with socket.socket(socket.AF_UNIX) as conn:
            conn.settimeout(2)
            conn.connect(os.path.expanduser(sock))
        return True
    except OSError:
        return False


def open_docker():
    subprocess.run(["open", "-a", "Docker"], capture_output=True, timeout=30, check=True)


def wake_docker(db, now, say=print, system=None, app=None, answers=None, start=None):
    """Docker Desktop on a Mac, started from this tick when its daemon is gone. A Claude
    run that starts it takes it down again when the run ends (sc-46912)."""
    if (system or sys.platform) != "darwin" or not (app or DOCKER_APP).exists():
        return False
    if (answers or docker_answers)():
        return False
    if now - (store.get_meta(db, "docker_woken") or {}).get("at", 0) < WAKE_SECONDS:
        return False
    store.set_meta(db, "docker_woken", {"at": now})
    try:
        (start or open_docker)()
    except (OSError, subprocess.SubprocessError) as error:
        say(f"Docker is down on this Mac and would not start: {error}")
        return False
    say("Docker was down on this Mac: started Docker Desktop")
    return True


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


def sweepable(scratch):
    """The entries a sweep may clear: a folder holding a record the harness reads back is
    swept entry by entry, around the record."""
    for entry in scratch.iterdir():
        if entry.name in HARNESS:
            continue
        if entry.name in RECORDS and entry.is_dir() and not entry.is_symlink():
            yield from (e for e in entry.iterdir() if e.name not in RECORDS[entry.name])
        else:
            yield entry


def finished(stories, numbers, states):
    """Whether every story named is known and in one of `states`; naming none is not."""
    by_id = {str(story["id"]): story for story in stories}
    known = [by_id.get(n) for n in numbers]
    return bool(known) and all(s and (s.get("state") in states or
                                      "Done" in states and s.get("done")) for s in known)


def sweep_scratch(db, config, now=None, say=print, cwds=None):
    """Once a day, clears what testers left in `.qa/`: an entry whose stories have all passed
    QA or are Done, or one nothing has touched for three days, or fourteen for one under a
    megabyte, unless its story is In QA under that tester. Then the worktrees (sweep_worktrees).
    True when it swept."""
    now = now or time.time()
    period = int(now // SWEEP_SECONDS)
    if (store.get_meta(db, "scratch_swept") or {}).get("period") == period:
        return False
    store.set_meta(db, "scratch_swept", {"period": period})
    stories = store.stories(db)
    for tester, scratch in scratch_folders(config):
        held, freed, gone = held_stories(stories, tester), 0, 0
        for entry in sweepable(scratch):
            numbers = set(STORY_NUMBER.findall(entry.name))
            if entry.name.startswith((NEVER_SWEPT, ".")) or numbers & held:
                continue
            try:
                newest, size = footprint(entry)
            except OSError:
                continue
            days = SMALL_DAYS if size < SMALL_BYTES else SCRATCH_DAYS
            if now - newest < days * SWEEP_SECONDS and \
                    not finished(stories, numbers, EVIDENCE_DONE):
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
            say(f"swept {amount(freed)} from {scratch}: {gone} entries")
    sweep_worktrees(db, config, stories, say, cwds, now)
    return True


def worktree_folders(config):
    """Every `.claude/worktrees/<name>` in a checkout of a role this machine runs."""
    seen = set()
    for role in config.get("roles") or {}:
        count = machine.settings(config, role).get("workers")
        for worker in machine.worker_names(role, count):
            place = machine.checkout(config, role, worker)
            folder = place / ".claude" / "worktrees" if place else None
            if folder and folder.is_dir() and folder.resolve() not in seen:
                seen.add(folder.resolve())
                yield place, folder


def live_cwds(platform=sys.platform, proc="/proc", run=subprocess.run):
    """The working folder of every process of this user: a session in a worktree, or a shell
    it left there, keeps it."""
    if platform == "darwin":
        out = run(["lsof", "-a", "-d", "cwd", "-u", str(os.getuid()), "-Fn"],
                  capture_output=True, text=True).stdout
        return {pathlib.Path(line[1:]) for line in out.splitlines() if line.startswith("n/")}
    found = set()
    for link in pathlib.Path(proc).glob("[0-9]*/cwd"):
        try:
            found.add(pathlib.Path(os.readlink(link)))
        except OSError:
            continue
    return found


def held_folders(cwds):
    """Each working folder and its parents, by device and inode: a folder reached through a
    bind mount or a second mount of the same disk is still the same folder."""
    held, seen = set(), set()
    for cwd in cwds:
        for path in (cwd, *cwd.parents):
            if path in seen:
                break
            seen.add(path)
            try:
                found = path.stat()
            except OSError:
                continue
            held.add((found.st_dev, found.st_ino))
    return held


def last_used(tree):
    """When the worktree last saw a commit, a checkout, a staged change or a file added at its
    top; a session whose shell has exited between commands still leaves these."""
    gitdir = checkout.git(tree, "rev-parse", "--absolute-git-dir", check=False,
                          timeout=120).stdout.strip()
    paths = [tree] + [pathlib.Path(gitdir) / name for name in ("HEAD", "index", "logs/HEAD")
                      if gitdir]
    times = []
    for path in paths:
        try:
            times.append(path.stat().st_mtime)
        except OSError:
            continue
    return max(times, default=0)


def worktree_keeps(tree, stories, held, now):
    """Why a worktree stays, or None when it may go. `changes` and `story unknown` mark the
    ones ops is told about."""
    found = tree.stat()
    if (found.st_dev, found.st_ino) in held:
        return "in use"
    if now - last_used(tree) < RECENT_SECONDS:
        return "used in the last hour"
    branch = checkout.git(tree, "branch", "--show-current", check=False,
                          timeout=120).stdout.strip()
    numbers = set(STORY_REF.findall(f"{tree.name} {branch}"))
    known = {str(story["id"]) for story in stories}
    if numbers and not numbers <= known:
        return "story unknown"
    if not finished(stories, numbers, WORKTREE_DONE):
        return "story not merged"
    status = checkout.git(tree, "--no-optional-locks", "status", "--porcelain", check=False,
                          timeout=120)
    if status.returncode:
        return "git status failed"
    for line in status.stdout.splitlines():
        path = line[3:].rstrip("/")
        if not (line.startswith("??") and path.rsplit("/", 1)[-1] in GENERATED):
            return "changes"
    unpushed = checkout.git(tree, "log", "HEAD", "--not", "--remotes", "--oneline",
                            check=False, timeout=120)
    if unpushed.returncode or unpushed.stdout.strip():
        return "changes"
    return None


def du_bytes(path):
    try:
        out = subprocess.run(["du", "-sk", str(path)], capture_output=True, text=True,
                             timeout=300).stdout
        return int(out.split()[0]) * 1000
    except (OSError, subprocess.TimeoutExpired, ValueError, IndexError):
        return 0


def sweep_worktrees(db, config, stories, say=print, cwds=None, now=None):
    """Removes a worktree whose story has merged, with nothing uncommitted or unpushed, no
    process working in it and nothing done in it for an hour. Its branch stays. One with work
    left on a merged story, or whose story the store does not know, is kept and named for
    ops."""
    held = held_folders(live_cwds() if cwds is None else cwds)
    now = now or time.time()
    left, unknown = [], []
    for place, folder in worktree_folders(config):
        freed, gone = 0, 0
        for tree in sorted(p for p in folder.iterdir() if p.is_dir() and not p.is_symlink()):
            try:
                why = worktree_keeps(tree, stories, held, now)
            except (OSError, subprocess.TimeoutExpired) as error:
                why = f"could not read it ({error})"
            if why == "changes":
                left.append(str(tree))
            if why == "story unknown":
                unknown.append(str(tree))
            if why:
                continue
            size = du_bytes(tree)
            removed = checkout.git(place, "worktree", "remove", "--force", str(tree),
                                   check=False, timeout=120)
            if removed.returncode:
                say(f"warning: could not remove {tree}: {removed.stderr.strip()}")
                continue
            freed, gone = freed + size, gone + 1
        if gone:
            say(f"removed {gone} worktrees from {folder}, {amount(freed)} freed")
    store.set_meta(db, "worktrees_left", left)
    store.set_meta(db, "worktrees_unknown", unknown)


def amount(size):
    return f"{size / 1e9:.1f} GB" if size >= 1e9 else f"{size / 1e6:.0f} MB"


def measured(config):
    """The workspace's folders and the simulators and emulators, which a falling disk names."""
    root = machine.workspace(config)
    inside = sorted(p for p in root.iterdir() if p.is_dir() and not p.is_symlink()) \
        if root and root.is_dir() else []
    devices = [pathlib.Path(d).expanduser() for d in DEVICES]
    return inside, [p for p in devices if p.exists()]


def largest_folders(config, start, out=None):
    """The workspace's five largest folders, then the simulators and the emulators, as
    `name size`. `du` can take minutes, so it runs on its own: `start` begins it and gives
    None, and a later call gives what it found, or None while it is still going."""
    out = out or machine.config_dir() / "largest-folders"
    inside, devices = measured(config)
    if start:
        out.unlink(missing_ok=True)
        try:
            subprocess.Popen(["sh", "-c", 'du -sk "$@" > "$0.part" 2>/dev/null; mv "$0.part" "$0"',
                              str(out), *map(str, inside + devices)],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
        except OSError:
            pass
        return None
    try:
        lines = out.read_text().splitlines()
    except OSError:
        return None
    sizes = {}
    for line in lines:
        kb, _, path = line.partition("\t")
        if kb.isdigit():
            sizes[pathlib.Path(path)] = int(kb) / 1e6
    named = sorted((p for p in inside if p in sizes), key=lambda p: -sizes[p])[:LARGEST]
    return ", ".join(f"{p} {sizes[p]:.1f} GB" for p in named + [d for d in devices
                                                                  if d in sizes])


def measure_litter(config, start, out=None):
    """What the worktrees and the testers' `.qa/` hold together, as `{"worktrees": GB,
    "qa": GB}`, for `sq status` beside free space. Like largest_folders, `start` runs `du` on
    its own and gives None; a later call reads what it found, or None before it has."""
    out = out or machine.config_dir() / "litter-sizes"
    if start:
        folders = [str(f) for _, f in worktree_folders(config)] + \
            [str(f) for _, f in scratch_folders(config)]
        if not folders:
            return None
        try:
            subprocess.Popen(["sh", "-c", 'du -sk "$@" > "$0.part" 2>/dev/null; mv "$0.part" "$0"',
                              str(out), *folders],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
        except OSError:
            pass
        return None
    try:
        lines = out.read_text().splitlines()
    except OSError:
        return None
    sizes = {"worktrees": 0.0, "qa": 0.0}
    for line in lines:
        kb, _, path = line.partition("\t")
        if kb.isdigit():
            sizes["qa" if path.endswith("/.qa") else "worktrees"] += int(kb) / 1e6
    return sizes


def checks(db, config, now=None, cache=None, free=None, largest=None, dry_run=False):
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
        if not dry_run and (seen.get("period") != period or not seen.get("text")):
            start = seen.get("period") != period
            seen = {"period": period, "started": now if start else seen.get("started", now),
                    "text": largest(config, start)}
            store.set_meta(db, "largest_folders", seen)
        text = seen.get("text")
        if not text and seen.get("period") == period \
                and now - seen.get("started", now) >= MEASURE_SECONDS:
            text = f"not measured, du still running after {MEASURE_SECONDS // 60} minutes"
        if text:
            found.append({"key": "disk-falling", "urgent": False, "period": period,
                          "reason": f"{left:.0f} GB free on {name}, under twice minFreeGb "
                                    f"{floor}; the largest: {text}"})
    seen = store.get_meta(db, "build_cache") or {}
    if now - seen.get("at", 0) >= DOCKER_EVERY_SECONDS:
        seen = {"at": now, "gb": cache()}
        store.set_meta(db, "build_cache", seen)
    if seen.get("gb") and seen["gb"] > BUILD_CACHE_GB:
        found.append({"key": "build-cache", "urgent": True, "period": int(now // SWEEP_SECONDS),
                      "reason": f"Docker's build cache is {seen['gb']:.0f} GB on {name}: "
                                "`just prune-build-cache`"})
    left = store.get_meta(db, "worktrees_left") or []
    unknown = store.get_meta(db, "worktrees_unknown") or []
    reasons = []
    if left:
        reasons.append(f"{len(left)} worktrees on {name} hold uncommitted or unpushed work on "
                       "a story already merged, so the sweep kept them: " + ", ".join(left))
    if unknown:
        reasons.append(f"{len(unknown)} worktrees on {name} name a story the store does not "
                       "know (not updated in the last 14 days), so the sweep kept them: "
                       + ", ".join(unknown))
    if reasons:
        found.append({"key": "worktrees-left", "urgent": False,
                      "period": int(now // SWEEP_SECONDS), "reason": "; ".join(reasons)})
    found.append({"key": "sweep", "urgent": False, "period": int(now // SWEEP_SECONDS),
                  "reason": f"the daily sweep of {name}: disk, Docker, the role stacks and "
                            "the manager"})
    store.set_meta(db, "machine_checks", {"machine": name, "found": found})
    return found
