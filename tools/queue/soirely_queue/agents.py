"""`just agents setup | up | down`: everything after `git clone`, and everything before
switching the computer off."""

import pathlib
import re
import shutil
import socket
import stat
import subprocess
import sys
import time

from . import checkout, machine, permissions, runner, store, update

WAIT_SECONDS = 10 * 60
REPO = pathlib.Path(__file__).resolve().parents[3]


def prerequisites(env_file=None):
    env_file = env_file or machine.env_file()
    missing = []
    for tool in ("claude", "gh", "git", "docker"):
        if not shutil.which(tool):
            missing.append(f"{tool} is not installed")
    if shutil.which("gh") and subprocess.run(["gh", "auth", "status"], capture_output=True) \
            .returncode:
        missing.append("gh is not signed in: gh auth login")
    if sys.version_info < (3, 11):
        missing.append(f"Python 3.11 or newer is needed; this is {sys.version.split()[0]}")
    if not env_file.exists():
        missing.append(f"no {env_file}: write SHORTCUT_API_TOKEN=<your token> there, mode 600")
    else:
        if stat.S_IMODE(env_file.stat().st_mode) & 0o077:
            missing.append(f"{env_file} can be read by others: chmod 600 {env_file}")
        if "SHORTCUT_API_TOKEN=" not in env_file.read_text():
            missing.append(f"{env_file} has no SHORTCUT_API_TOKEN line")
    return missing


def compose_project(path):
    env = path / ".env"
    if not env.exists():
        return None
    for line in env.read_text().splitlines():
        if line.startswith("COMPOSE_PROJECT_NAME="):
            return line.split("=", 1)[1].strip()
    return None


def role_stacks():
    """The roles `scripts/dev-env.mjs` makes a stack for, from its STACKS table."""
    found = re.search(r"export const STACKS = \{([^}]*)\}",
                      (REPO / "scripts" / "dev-env.mjs").read_text())
    return re.findall(r"^\s*([a-z0-9]+):", found.group(1), re.MULTILINE) if found else []


def make_checkout(config, role, say, home):
    path = machine.checkout(config, role)
    if path.exists():
        return
    if role == "dev":
        say(f"  {role}: no main checkout at {path}; clone the repository there, or set "
            "mainCheckout")
        return
    say(f"  {role}: creating {path}")
    subprocess.run(["git", f"--git-dir={home.parent}", "fetch", "--quiet", "origin"],
                   check=True)
    try:
        checkout.ensure(home.parent, path)
    except checkout.Unprepared as refused:
        say(f"  {role}: could not create {path}: {refused}")


def stack_running(project):
    found = subprocess.run(["docker", "compose", "-p", project, "ps", "-q"],
                           capture_output=True, text=True)
    return found.returncode == 0 and bool(found.stdout.strip())


def stack_setup(role):
    """The command that makes a role's stack: dev-env for a role in its STACKS table, qa-env
    for a tester. None for a role that has no stack of its own."""
    if role in role_stacks():
        return ["node", "scripts/dev-env.mjs", "setup", "--role", role]
    tester = re.fullmatch(r"qa(\d*)", role)
    if tester:
        return ["node", "scripts/qa-env.mjs", "setup", "--tester", tester.group(1) or "1"]
    return None


def make_stack(config, role, say):
    """Brings up a role's stack whenever it is not running, not only when its checkout is
    new, so a setup that stopped part way is finished by the next one."""
    path, command = machine.checkout(config, role), stack_setup(role)
    if not command or not path.exists():
        return
    if path.parent != REPO.parent:
        say(f"  {role}: its stack is not set up; see CONTRIBUTING.md (dev-env, qa-env)")
        return
    project = compose_project(path)
    if project and stack_running(project):
        return
    say(f"  {role}: bringing up its stack")
    made = subprocess.run(command, cwd=REPO)
    if made.returncode:
        say(f"  {role}: its stack did not come up (exit {made.returncode}); the lines above "
            f"say why, and `{' '.join(command)}` tries again")


def accounts(config, say):
    """Each Claude config folder the roles use: made if missing, given the default folder's
    settings, told apart when its settings have drifted from them, and checked for a login."""
    default = machine.expand(config.get("claudeConfigDir") or str(machine.CLAUDE_DEFAULT))
    folders = {}
    for role in config.get("roles") or {}:
        folders.setdefault(machine.claude_dir(config, role), []).append(role)
    for folder, names in folders.items():
        if not folder.exists():
            folder.mkdir(parents=True)
            say(f"made {folder} for {', '.join(names)}")
        source, own = default / "settings.json", folder / "settings.json"
        if folder != default and source.exists():
            if not own.exists():
                shutil.copy2(source, own)
                say(f"copied the settings of {default} into {folder}")
            elif own.read_bytes() != source.read_bytes():
                say(f"  {own} differs from {source}, so {', '.join(names)} may run under "
                    "other rules. Bring the two in line")
        email = machine.account(folder)
        login = "claude" if machine.is_claude_default(folder) else \
            f"CLAUDE_CONFIG_DIR={folder} claude"
        say(f"  {folder}: {email} for {', '.join(names)}" if email else
            f"  {folder}: not logged in. Run {login}, then /login with the account for "
            f"{', '.join(names)}")
    return folders


def setup(home, platform, say=print, ask=input, workspace=None):
    try:
        config = machine.load()
    except machine.ConfigError:
        config = machine.from_example()
        config["machine"] = socket.gethostname()
        say(f"Wrote {machine.path()} from agents.example.json; it lists the roles this "
            "machine runs.")
        machine.save(config)
    if workspace:
        config["workspace"] = workspace
        machine.save(config)
    elif not config.get("workspace"):
        say(f"No workspace is set in {machine.path()}.")
        config = machine.ask_workspace(config, ask, say)
    if not config.get("claudeVersion"):
        config["claudeVersion"] = runner.installed_claude()
        machine.save(config)
        say(f"Pinned claude {config['claudeVersion']}; a different version is reported.")
    missing = prerequisites()
    for line in missing:
        say(f"missing: {line}")
    if missing:
        return 1
    say("Checkouts:")
    for role in config.get("roles") or {}:
        make_checkout(config, role, say, home)
        make_stack(config, role, say)
    accounts(config, say)
    tree = subprocess.run(["git", "rev-parse", "HEAD:tools/queue"], cwd=REPO, capture_output=True,
                          text=True).stdout.strip() or "local"
    update.copy(REPO / "tools" / "queue", home, tree)
    platform.install(home / "sq" / "sq", machine.env_file(), sys.executable)
    say(f"Installed sq in {home / 'sq'} and the {platform.name} units.")
    if sys.stdin.isatty():
        say("Permissions the owner has granted the workers, from main:")
        permissions.apply(home, say, ask)
    else:
        say("Run `just agents permissions apply` in your own terminal to grant the workers "
            "what main's permissions.json holds.")
    say("`just agents up` starts the roles.")
    return 0


def start_stacks(config, names, say):
    """Starts again each stack `down` stopped. A stack never made is setup's, not up's."""
    for role in names:
        path = machine.checkout(config, role)
        project = compose_project(path) if path.exists() else None
        if not project or stack_running(project):
            continue
        started = subprocess.run(["docker", "compose", "-p", project, "up", "-d"], cwd=path,
                                 capture_output=True, text=True)
        say(f"started stack {project}" if started.returncode == 0 else
            f"  {role}: stack {project} did not start: {started.stderr.strip()[-300:]}")


def up(db, home, platform, say=print, only=None):
    config = machine.load()
    errors, refused, ready = machine.check(config)
    for error in errors:
        say(f"error: {error}")
    if errors:
        return 1
    for role, why in refused.items():
        say(f"refused {role}: {why}")
    update.check(db, home, time.time(), say, force=True)
    platform.install(home / "sq" / "sq", machine.env_file(), sys.executable)
    names = [r for r in (only or ready) if r in ready]
    runner.set_started(db, names, True)
    store.set_meta(db, "paused", None)
    for role in names:
        note = machine.price_note(role, ready[role]["model"], config)
        if note:
            say(f"note: {note}")
    start_stacks(config, names, say)
    platform.enable()
    say(f"started {', '.join(names) or 'no role'}; the first tick is within a minute")
    return 1 if only and set(only) - set(names) else 0


def start(db, home, platform, names, say=print):
    listed = list(machine.load().get("roles") or {})
    unlisted = [name for name in names if name not in listed]
    if unlisted:
        say(f"error: {', '.join(unlisted)} not in {machine.path()}, so not started here; "
            "which roles a machine runs is the owner's choice")
        return 1
    return up(db, home, platform, say, only=names or None)


def stop(db, names, say=print):
    listed = list(machine.load().get("roles") or {})
    unlisted = [name for name in names if name not in listed]
    if unlisted:
        say(f"error: {', '.join(unlisted)} not in {machine.path()}; nothing stopped")
        return 1
    runner.set_started(db, names, False)
    say(f"stopped {', '.join(names) or 'no role'}; a running worker finishes its item")
    return 0


def down(db, home, platform, say=print, now=False, sleep=time.sleep, wait=WAIT_SECONDS):
    config = machine.load()
    listed = list(config.get("roles") or {})
    workers = [name for role in listed for name in
               machine.worker_names(role, machine.settings(config, role).get("workers"))]
    platform.disable()
    runner.set_started(db, listed, False)
    say("Stopped the manager: nothing new is claimed.")
    if now:
        platform.stop_workers()
    else:
        waited = 0
        while waited < wait and any(platform.worker_active(w) for w in workers):
            active = [w for w in workers if platform.worker_active(w)]
            if waited % 60 == 0:
                say(f"waiting for {', '.join(active)} to finish ({waited // 60} of "
                    f"{wait // 60} minutes)")
            sleep(10)
            waited += 10
        platform.stop_workers()
    for name in workers:
        held = store.held_by(db, machine.worker_role(name), worker=name)
        if held and not platform.worker_active(name):
            store.release(db, held["id"])
            say(f"{name}: gave back item {held['id']}")
    for role in listed:
        path = machine.checkout(config, role)
        project = compose_project(path) if path and path.exists() else None
        if not project:
            continue
        if role == "dev":
            say(f"{role} shares the owner's own stack, {project}; stopping it")
        subprocess.run(["docker", "compose", "-p", project, "down"], cwd=path,
                       capture_output=True, check=False)
        say(f"stopped stack {project} (volumes kept)")
    return 0
