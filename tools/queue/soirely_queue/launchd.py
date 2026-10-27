"""The Mac runner: one launchd agent for every role, each worker a supervised process of its
own.

launchd kills what is left in a job's process group when the job exits, so a worker starts
in a session of its own and outlives the tick. A Mac has no systemd to cap a worker, so
`sq worker-supervise` runs it, stops it at its time or memory limit, and records the ending
as systemd's `ExecStopPost` does on Linux."""

import os
import pathlib
import plistlib
import re
import shutil
import signal
import subprocess
import time

from . import machine

LABEL = "com.soirely.routine"
LOG_LIMIT_BYTES = 10 * 1024 * 1024
POLL_SECONDS = 5
GRACE_SECONDS = 10
SIZE = re.compile(r"^(\d+(?:\.\d+)?)([KMGT]?)$", re.I)
UNITS = {"": 1, "k": 1024, "m": 1024 ** 2, "g": 1024 ** 3, "t": 1024 ** 4}


def agent_path():
    return pathlib.Path("~/Library/LaunchAgents").expanduser() / f"{LABEL}.plist"


def log_dir():
    return pathlib.Path("~/Library/Logs/soirely").expanduser()


def domain():
    return f"gui/{os.getuid()}"


def search_path():
    """The PATH the agent runs with: launchd starts with a short default, which finds
    neither Homebrew's tools nor a version manager's node."""
    found = [str(pathlib.Path(shutil.which(tool)).parent)
             for tool in ("claude", "gh", "git", "docker", "python3") if shutil.which(tool)]
    return ":".join(dict.fromkeys(machine.tool_folders() + found + [
        "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]))


def stable_python(python):
    """The `python3` on the agent's PATH when it is this interpreter: a versioned path such as
    Homebrew's python3.14 disappears at the next upgrade, and the agent with it."""
    found = shutil.which("python3", path=search_path())
    if found and os.path.realpath(found) == os.path.realpath(python):
        return found
    return str(python)


def agent(sq, python):
    log = str(log_dir() / "routine.log")
    return {
        "Label": LABEL,
        "ProgramArguments": [stable_python(python), str(sq), "run"],
        "StartInterval": 60,
        "RunAtLoad": True,
        # The token is read from the env file by sq itself, never written here.
        "EnvironmentVariables": {"PATH": search_path(), "SOIRELY_TICK": "1"},
        "StandardOutPath": log,
        "StandardErrorPath": log,
    }


def size_bytes(size):
    """`3G` and the like, as systemd reads `MemoryMax`, in bytes."""
    match = SIZE.match(str(size or "").strip())
    return int(float(match.group(1)) * UNITS[match.group(2).lower()]) if match else None


def group_rss(pgid):
    """Bytes resident in every process of a process group."""
    out = subprocess.run(["ps", "-A", "-o", "pgid=,rss="], capture_output=True,
                         text=True).stdout
    total = 0
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0] == str(pgid):
            total += int(parts[1]) * 1024
    return total


def stop_group(child, sleep=time.sleep):
    """Asks the worker's whole group to stop, waits for the worker, then kills whatever it
    left behind."""
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    for _ in range(GRACE_SECONDS * 10):
        if child.poll() is not None:
            break
        sleep(0.1)
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def supervise(command, runtime_seconds, memory_bytes, cwd=None, env=None, poll=POLL_SECONDS,
              clock=time.monotonic, sleep=time.sleep, rss=group_rss):
    """Runs the worker in a process group of its own and waits for it. Returns
    `(result, exit status)`, with systemd's names for a result: success, exit-code,
    timeout, oom-kill, or stopped when the supervisor itself was told to stop."""
    child = subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True,
                             stdin=subprocess.DEVNULL)
    told = []
    previous = signal.signal(signal.SIGTERM, lambda *_: told.append("stopped"))
    started, result = clock(), None
    try:
        while child.poll() is None:
            if told:
                result = "stopped"
            elif clock() - started > runtime_seconds:
                result = "timeout"
            elif memory_bytes and rss(child.pid) > memory_bytes:
                result = "oom-kill"
            if result:
                stop_group(child, sleep)
                child.wait()
                break
            sleep(poll)
    finally:
        signal.signal(signal.SIGTERM, previous)
    status = child.returncode
    return result or ("success" if status == 0 else "exit-code"), status


class Mac:
    name = "launchd"
    search_path = staticmethod(search_path)

    def __init__(self, home):
        self.home = pathlib.Path(home)
        self.reload_due = None

    def pidfile(self, role):
        return self.home / "workers" / f"{role}.pid"

    def launchctl(self, *args, check=False):
        return subprocess.run(["launchctl", *args], capture_output=True, text=True, check=check)

    def loaded(self):
        return self.launchctl("print", f"{domain()}/{LABEL}").returncode == 0

    def install(self, sq, env_file, python):
        """Writes the agent when it differs, and says whether anything changed."""
        log_dir().mkdir(parents=True, exist_ok=True)
        for log in log_dir().glob("*.log"):
            if log.stat().st_size > LOG_LIMIT_BYTES:
                log.replace(log.with_suffix(".log.1"))
        target = agent_path()
        text = plistlib.dumps(agent(sq, python))
        if target.exists() and target.read_bytes() == text:
            return False
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text)
        if self.loaded():
            if os.environ.get("SOIRELY_TICK"):
                # The tick is the agent itself: unloading it now would stop this very run.
                self.reload_due = target
            else:
                self.reload(target)
        return True

    def reload(self, target, detached=False):
        steps = f"launchctl bootout {domain()}/{LABEL}; launchctl bootstrap {domain()} '{target}'"
        if detached:
            subprocess.Popen(["/bin/sh", "-c", f"sleep 5; {steps}"], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.run(["/bin/sh", "-c", steps], capture_output=True)

    def after_run(self):
        """Reloads a changed agent once the tick has done everything else, from a process of
        its own that the unload does not take down."""
        if self.reload_due:
            self.reload(self.reload_due, detached=True)
            self.reload_due = None

    def enable(self):
        self.launchctl("enable", f"{domain()}/{LABEL}")
        if not self.loaded():
            self.launchctl("bootstrap", domain(), str(agent_path()), check=True)

    def disable(self):
        # Disabled, so it stays off at the next login too, as `systemctl disable` does.
        self.launchctl("bootout", f"{domain()}/{LABEL}")
        self.launchctl("disable", f"{domain()}/{LABEL}")

    def timer_active(self):
        return self.loaded()

    def worker_pid(self, role):
        try:
            pid = int(self.pidfile(role).read_text().strip())
            os.kill(pid, 0)
        except (OSError, ValueError):
            return None
        command = subprocess.run(["ps", "-p", str(pid), "-o", "command="], capture_output=True,
                                 text=True).stdout
        return pid if "worker-supervise" in command else None

    def worker_active(self, role):
        return self.worker_pid(role) is not None

    def launch(self, role, item_id, values, sq, python, cwd, env_file):
        log_dir().mkdir(parents=True, exist_ok=True)
        self.pidfile(role).parent.mkdir(parents=True, exist_ok=True)
        env = dict(os.environ, PATH=search_path(), SOIRELY_WORKER=role)
        env.pop("SOIRELY_TICK", None)
        command = [str(python), str(sq), "worker-supervise", role, str(item_id),
                   "--minutes", str(values["maxRuntimeMinutes"])]
        if values.get("memoryMax"):
            command += ["--memory", str(values["memoryMax"])]
        with open(log_dir() / f"worker-{role}.log", "a") as log:
            child = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                     stdout=log, stderr=log, start_new_session=True)
        self.pidfile(role).write_text(str(child.pid))

    def stop_workers(self, wait=60, sleep=time.sleep):
        """Tells each supervisor to stop its worker, and waits for them, as `systemctl stop`
        does, so their items can be given back."""
        roles = [path.stem for path in (self.home / "workers").glob("*.pid")]
        for role in roles:
            pid = self.worker_pid(role)
            if pid:
                os.kill(pid, signal.SIGTERM)
        for _ in range(wait):
            if not any(self.worker_active(role) for role in roles):
                return
            sleep(1)

    def notify(self, title, body):
        script = ["-e", "on run argv", "-e",
                  "display notification (item 2 of argv) with title (item 1 of argv)",
                  "-e", "end run"]
        subprocess.run(["osascript", *script, title, body], capture_output=True, check=False)
