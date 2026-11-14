"""What a worker's run leaves running once it has ended (sc-28504). Every process a run's
session starts carries `SQ_RUN_DIR`, the run's scratch folder, in its environment, whatever
its parent is now: a `-p` session's background shell reparented to systemd, a `--bg`
session's under the account's daemon, a `bash -c` wrapper whose command line names nothing.
The scratch folder goes when the run ends, so a marked process whose folder is gone has
outlived its run."""

import glob
import os
import pathlib
import re
import signal
import subprocess
import sys
import tempfile
import time

MARK = "SQ_RUN_DIR"
GRACE_SECONDS = 5
# A task's output past this is a loop writing errors, as on 2 Nov, not a build log.
TASK_OUTPUT_LIMIT = 1 << 30
MAC_MARK = re.compile(rf"(?:^|\s){MARK}=(\S+)")
# Servers a run starts on demand that every other run then shares: the adb server, the Gradle
# and Kotlin daemons, the account's Claude daemon. They carry the mark of whichever run started
# them, and are never that run's own.
SHARED = re.compile(r"fork-server|GradleDaemon|KotlinCompileDaemon|claude\s+daemon")


def marked(platform=sys.platform, proc="/proc", run=subprocess.run):
    """`{pid: run folder}` for every process of this user that carries the mark."""
    found = {}
    if platform == "darwin":
        # `ps -E` appends each process's environment to its command, for our own processes.
        out = run(["ps", "-E", "-ww", "-U", str(os.getuid()), "-o", "pid=,command="],
                  capture_output=True, text=True).stdout
        for line in out.splitlines():
            pid, _, rest = line.strip().partition(" ")
            hit = MAC_MARK.search(rest)
            if pid.isdigit() and hit and not SHARED.search(rest):
                found[int(pid)] = hit.group(1)
        return found
    prefix = f"{MARK}=".encode()
    for path in glob.glob(f"{proc}/[0-9]*/environ"):
        try:
            data = pathlib.Path(path).read_bytes()
        except OSError:
            continue
        for pair in data.split(b"\0"):
            if pair.startswith(prefix):
                if shared(path):
                    break
                found[int(path.split("/")[-2])] = pair[len(prefix):].decode(errors="replace")
                break
    return found


def shared(environ_path):
    try:
        command = pathlib.Path(environ_path).with_name("cmdline").read_bytes()
    except OSError:
        return False
    return bool(SHARED.search(command.replace(b"\0", b" ").decode(errors="replace")))


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def signal_all(pids, sig):
    for pid in pids:
        try:
            os.kill(pid, sig)
        except (ProcessLookupError, PermissionError):
            pass


def stop(pids, sleep=time.sleep):
    """TERM, then KILL whatever is still up after the grace. Never this process."""
    pids = [pid for pid in pids if pid != os.getpid()]
    signal_all(pids, signal.SIGTERM)
    for _ in range(GRACE_SECONDS * 10):
        if not any(alive(pid) for pid in pids):
            return pids
        sleep(0.1)
    signal_all([pid for pid in pids if alive(pid)], signal.SIGKILL)
    return pids


def stop_run(run_dir, find=marked, sleep=time.sleep):
    """Ends every process the run started. Returns their pids."""
    return stop([pid for pid, folder in find().items() if folder == str(run_dir)], sleep)


def ages(run=subprocess.run):
    """`{pid: seconds running}`, from `ps` on both Linux and the Mac."""
    out = run(["ps", "-A", "-o", "pid=,etime="], capture_output=True, text=True).stdout
    found = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit():
            days, _, clock = parts[1].rpartition("-")
            seconds = 0
            for part in clock.split(":"):
                seconds = seconds * 60 + int(part)
            found[int(parts[0])] = seconds + int(days or 0) * 86400
    return found


def ended(home, find=marked, age=ages):
    """Every process still running from a run that has ended: `{pid, worker, item, age}`."""
    scratch = pathlib.Path(home) / "scratch"
    left = {pid: pathlib.Path(folder) for pid, folder in find().items()
            if pathlib.Path(folder).parent == scratch and not pathlib.Path(folder).exists()}
    seconds = age() if left else {}
    found = []
    for pid, folder in sorted(left.items()):
        worker, _, item = folder.name.rpartition("-")
        found.append({"pid": pid, "worker": worker, "item": item, "age": seconds.get(pid)})
    return found


def temp_roots():
    """Claude's own temporary folders: `/tmp` on Linux, `$TMPDIR` on the Mac."""
    return sorted({f"/tmp/claude-{os.getuid()}",
                   os.path.join(tempfile.gettempdir(), f"claude-{os.getuid()}")})


def task_folders(session, roots=None):
    return [path for root in roots or temp_roots()
            for path in glob.glob(os.path.join(root, "*", glob.escape(session), "tasks"))]


def oversized(roots=None, limit=TASK_OUTPUT_LIMIT):
    """Every task-output file past the limit: `(path, bytes)`."""
    found = []
    for root in roots or temp_roots():
        for path in glob.glob(os.path.join(root, "*", "*", "tasks", "*")):
            try:
                size = os.path.getsize(path)
            except OSError:
                continue
            if size > limit:
                found.append((path, size))
    return found


def describe(left):
    age = left["age"]
    told = f"{age // 3600}h{age % 3600 // 60:02d}m" if age is not None else "unknown age"
    return f"pid {left['pid']} from {left['worker']} item {left['item']}, running {told}"
