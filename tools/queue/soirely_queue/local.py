"""ops@<machine>: the work only this machine can see. Every machine runs it, whichever
machine holds ops' shared duties, and it never touches another computer.

The checks run in the minute, with no model. Each finding becomes an ops work item of kind
`machine`, which this machine's ops takes even while another machine holds the ops lease."""

import json
import re
import subprocess
import time
import urllib.error
import urllib.request

from . import machine, store

DOCKER_EVERY_SECONDS = 30 * 60
BUILD_CACHE_GB = 20
SWEEP_SECONDS = 24 * 60 * 60
STACK_SECONDS = 30
SIZE = re.compile(r"([\d.]+)\s*([kMGT]?B)", re.I)
UNITS = {"b": 1e-9, "kb": 1e-6, "mb": 1e-3, "gb": 1, "tb": 1e3}


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


def checks(db, config, now=None, cache=None, free=None):
    """What needs this machine's ops now, kept for the work it becomes."""
    now = now or time.time()
    cache, free = cache or build_cache_gb, free or machine.free_gb
    name = config.get("machine") or "machine"
    found = []
    floor = config.get("minFreeGb", 15)
    left = free(config)
    if floor and left < floor:
        found.append({"key": "disk", "urgent": True, "period": int(now // SWEEP_SECONDS),
                      "reason": f"only {left:.0f} GB free on {name}, under minFreeGb {floor}: "
                                "free space before workers can start again"})
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
