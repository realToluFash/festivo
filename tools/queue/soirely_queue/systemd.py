"""The Linux runner: one user timer for every role, each worker a transient unit of its own.

A worker cannot be a child of the tick: when a oneshot service exits, systemd stops what is
left in its control group (systemd.kill(5)), so the worker would die with the tick."""

import os
import pathlib
import shutil
import subprocess

from . import machine, remote

TIMER = "soirely-routine"
WEB = "soirely-web"
SLICE = "soirely.slice"
# What a notification needs to reach the desktop from a unit.
DESKTOP = ("DBUS_SESSION_BUS_ADDRESS", "DISPLAY", "WAYLAND_DISPLAY")


def unit_dir():
    return pathlib.Path(os.environ.get("XDG_CONFIG_HOME", "~/.config")).expanduser() / \
        "systemd" / "user"


def worker_unit(role):
    return f"soirely-worker-{role}"


def search_path():
    """The PATH the units run with: a user unit starts with systemd's short default, which
    finds neither claude nor a version manager's node."""
    found = [str(pathlib.Path(shutil.which(tool)).parent)
             for tool in ("claude", "gh", "git", "docker", "python3") if shutil.which(tool)]
    return ":".join(dict.fromkeys(machine.tool_folders() + found +
                                  ["/usr/local/bin", "/usr/bin", "/bin"]))


def units(sq, env_file, python="/usr/bin/python3", slice_memory=machine.SLICE_MEMORY):
    return {
        f"{TIMER}.service": "\n".join([
            "[Unit]",
            "Description=Soirely agents: sync once, then tick each started role",
            "",
            "[Service]",
            "Type=oneshot",
            f"EnvironmentFile=-{env_file}",
            f"Environment=PATH={search_path()}",
            *[f"Environment={key}={os.environ[key]}" for key in DESKTOP if key in os.environ],
            f"ExecStart={python} {sq} run",
            "",
        ]),
        f"{TIMER}.timer": "\n".join([
            "[Unit]",
            "Description=Soirely agents, every minute",
            "",
            "[Timer]",
            "OnCalendar=minutely",
            "AccuracySec=1s",
            "",
            "[Install]",
            "WantedBy=timers.target",
            "",
        ]),
        SLICE: "\n".join([
            "[Unit]",
            "Description=Soirely agent workers, capped together",
            "",
            "[Slice]",
            f"MemoryMax={slice_memory}",
            "",
        ]),
    }


def web_unit(sq, env_file, python, listen):
    """`sq web`, kept running so the other machines can read this one."""
    host, port = listen
    return "\n".join([
        "[Unit]",
        "Description=Soirely agents' page, for this machine and the others on its network",
        "",
        "[Service]",
        "Type=simple",
        f"EnvironmentFile=-{env_file}",
        f"Environment=PATH={search_path()}",
        f"ExecStart={python} {sq} web --no-open --listen {host} --port {port}",
        "Restart=always",
        "RestartSec=5",
        "",
        "[Install]",
        "WantedBy=default.target",
        "",
    ])


def systemctl(*args, check=True):
    return subprocess.run(["systemctl", "--user", *args], capture_output=True, text=True,
                          check=check)


class Linux:
    name = "systemd"
    search_path = staticmethod(search_path)

    def install(self, sq, env_file, python):
        """Writes the units when they differ, and says whether anything changed."""
        folder = unit_dir()
        folder.mkdir(parents=True, exist_ok=True)
        changed = False
        try:
            limit = machine.slice_memory(machine.load())
        except machine.ConfigError:
            limit = machine.SLICE_MEMORY
        for name, text in units(sq, env_file, python, limit).items():
            target = folder / name
            if not target.exists() or target.read_text() != text:
                target.write_text(text)
                changed = True
        if changed:
            systemctl("daemon-reload")
        return self.install_web(sq, env_file, python, remote.web(remote.config())) or changed

    def install_web(self, sq, env_file, python, listen):
        """Keeps the web service running while agents.json has `web`, and takes it away once
        it has not. Says whether anything changed."""
        target = unit_dir() / f"{WEB}.service"
        if not listen:
            if not target.exists():
                return False
            systemctl("disable", "--now", f"{WEB}.service", check=False)
            target.unlink()
            systemctl("daemon-reload")
            return True
        text = web_unit(sq, env_file, python, listen)
        changed = not target.exists() or target.read_text() != text
        if changed:
            target.write_text(text)
            systemctl("daemon-reload")
            systemctl("enable", f"{WEB}.service", check=False)
            systemctl("restart", f"{WEB}.service", check=False)
        elif systemctl("is-active", f"{WEB}.service", check=False).stdout.strip() != "active":
            systemctl("start", f"{WEB}.service", check=False)
        return changed

    def enable(self):
        systemctl("enable", "--now", f"{TIMER}.timer")

    def disable(self):
        systemctl("disable", "--now", f"{TIMER}.timer", check=False)

    def after_run(self):
        """A changed timer is reloaded by `install` itself: systemd's reload leaves the
        running tick alone."""

    def timer_active(self):
        return systemctl("is-active", f"{TIMER}.timer", check=False).stdout.strip() == "active"

    def worker_active(self, role):
        state = systemctl("is-active", f"{worker_unit(role)}.service", check=False).stdout.strip()
        return state in ("active", "activating", "deactivating", "reloading")

    def launch(self, role, item_id, values, sq, python, cwd, env_file):
        ended = f"{python} {sq} worker-ended {role} {item_id}"
        command = [
            "systemd-run", "--user", "--quiet", "--collect",
            f"--unit={worker_unit(role)}", f"--slice={SLICE}",
            f"--working-directory={cwd}",
            f"--property=EnvironmentFile=-{env_file}",
            f"--setenv=PATH={search_path()}",
            f"--setenv=SOIRELY_WORKER={role}",
            *[f"--setenv={key}={os.environ[key]}" for key in DESKTOP if key in os.environ],
            f"--property=RuntimeMaxSec={values['maxRuntimeMinutes']}min",
            f"--property=ExecStopPost={ended}",
        ]
        if values.get("memoryMax"):
            command.append(f"--property=MemoryMax={values['memoryMax']}")
        subprocess.run(command + ["--", python, str(sq), "worker", role, str(item_id)],
                       capture_output=True, text=True, check=True)

    def stop_workers(self):
        systemctl("stop", "soirely-worker-*.service", check=False)

    def notify(self, title, body):
        if shutil.which("notify-send"):
            subprocess.run(["notify-send", "--app-name=Soirely agents", title, body],
                           capture_output=True, check=False)


def platform():
    return Linux()
