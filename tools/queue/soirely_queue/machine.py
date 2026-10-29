"""What this machine runs: `agents.json`, read every minute, and checked before it is used.

Nothing here guesses. A role whose settings fail a check is refused with a reason, and the
roles beside it keep running."""

import functools
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys

from . import roles

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLE = HERE.parent / "agents.example.json"
MODELS = HERE.parent / "models.json"
SETTINGS = ("model", "effort", "inboxEffort", "inboxBatch", "memoryMax", "maxRuntime",
            "maxBudgetUsd", "wakeEvery", "workers")
SIZE = re.compile(r"^\d+[KMG]$")
RUNTIME = re.compile(r"^(\d+)(m|h)$")
# Claude Code's own default folder, which keeps its account file beside it, not inside.
CLAUDE_DEFAULT = pathlib.Path("~/.claude").expanduser()
# Under everything in agents.json: a worker is never left without a time limit.
BUILT_IN = {"maxRuntime": "90m", "wakeEvery": "3m", "workers": 1}
# What every worker on the machine may use between them, the systemd slice's MemoryMax.
SLICE_MEMORY = "16G"


@functools.cache
def has_xcode():
    if not shutil.which("xcrun"):
        return False
    try:
        return subprocess.run(["xcrun", "simctl", "help"], capture_output=True,
                              timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


class ConfigError(RuntimeError):
    pass


def machine_name(config):
    return config.get("machine") or socket.gethostname()


def config_dir():
    return pathlib.Path(os.environ.get("SOIRELY_CONFIG", "~/.config/soirely")).expanduser()


def path():
    return config_dir() / "agents.json"


def env_file():
    return config_dir() / "env"


def load_env(path=None):
    """Sets each variable the env file holds and the environment lacks. systemd reads the
    file into the units; launchd has no such thing, so on a Mac sq reads it itself."""
    path = path or env_file()
    try:
        lines = path.read_text().splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.removeprefix("export ").split("=", 1)
        value = value.strip()
        if len(value) > 1 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def models():
    return json.loads(MODELS.read_text())


def load(at=None):
    at = at or path()
    if not at.exists():
        raise ConfigError(f"no {at}; run just agents setup")
    try:
        return json.loads(at.read_text())
    except json.JSONDecodeError as error:
        raise ConfigError(f"{at} is not valid JSON: {error}") from error


def save(config, at=None):
    at = at or path()
    at.parent.mkdir(parents=True, exist_ok=True)
    at.write_text(json.dumps(config, indent=2) + "\n")


def from_example():
    return json.loads(EXAMPLE.read_text())


def expand(value):
    return pathlib.Path(value).expanduser() if value else None


def nvm_node():
    """The bin folder of nvm's `default` node, or None. Read from nvm's files, since neither
    the manager nor launchd ever sources nvm, so its PATH holds no node to go by."""
    folder = pathlib.Path(os.environ.get("NVM_DIR") or "~/.nvm").expanduser()
    try:
        installed = [found.name for found in (folder / "versions" / "node").iterdir()
                     if (found / "bin" / "node").exists()]
    except OSError:
        return None
    wanted = "default"
    # An alias may name another (default -> lts/jod -> v22.x), as nvm's own lookup follows.
    for _ in range(5):
        alias = folder / "alias" / wanted
        if not alias.is_file():
            break
        wanted = alias.read_text().strip()
    if wanted == "default" or not wanted:
        return None
    wanted = "" if wanted in ("node", "stable") else wanted.lstrip("v")
    matching = [name for name in installed if not wanted or name.lstrip("v") == wanted
                or name.lstrip("v").startswith(wanted + ".")]
    if not matching:
        return None
    newest = max(matching, key=version_key)
    return folder / "versions" / "node" / newest / "bin"


def version_key(name):
    return tuple(int(part) if part.isdigit() else 0 for part in name.lstrip("v").split("."))


def wanted_node(config):
    """The node the main checkout's `.nvmrc` asks for, when it names a version number."""
    main = checkout(config, "dev")
    try:
        wanted = (main / ".nvmrc").read_text().strip().lstrip("v")
    except (OSError, TypeError):
        return None
    return wanted if re.fullmatch(r"\d+(\.\d+)*", wanted) else None


def node_version(node):
    try:
        stamp = pathlib.Path(node).resolve().stat().st_mtime
    except OSError:
        return None
    return _node_version(str(node), stamp)


@functools.lru_cache(maxsize=8)
def _node_version(node, stamp):
    try:
        said = subprocess.run([node, "--version"], capture_output=True, text=True,
                              timeout=10).stdout.strip().lstrip("v")
    except (OSError, subprocess.SubprocessError):
        return None
    return said if re.fullmatch(r"\d+(\.\d+)*", said) else None


def node_behind(config, node):
    """A warning when the node a worker runs is older than the main checkout's `.nvmrc`."""
    wanted = wanted_node(config)
    found = node_version(node) if wanted else None
    if not found or version_key(found) >= version_key(wanted):
        return None
    return (f"workers run node {found}, older than the {wanted} that .nvmrc asks for: "
            f"nvm install {wanted} && nvm alias default {wanted}")


def tool_folders():
    """What a worker's PATH carries ahead of the tools found by name: nvm's default node,
    first so that no other node shadows it, and Maestro, which only a shell profile adds."""
    found = [nvm_node(), pathlib.Path("~/.maestro/bin").expanduser()]
    return [str(folder) for folder in found if folder and folder.is_dir()]


def workspace(config):
    return expand(config.get("workspace"))


def checkout(config, role, worker=None):
    """The role's checkout; a second worker and on works in one of its own beside it."""
    own = (config.get("roles", {}).get(role) or {}).get("checkout")
    root = workspace(config)
    if own:
        path = expand(own)
    elif not root:
        return None
    else:
        path = root / (config.get("mainCheckout") or "soirely") if role == "dev" \
            else root / f"soirely-{role}"
    if worker and worker != role:
        return path.with_name(f"{path.name}-{worker_number(worker)}")
    return path


def worker_names(role, count):
    """`pm`, then `pm-2`, `pm-3`: the first keeps the role's own name, unit and checkout."""
    return [role] + [f"{role}-{n}" for n in range(2, (count or 1) + 1)]


def worker_role(name):
    return name.split("-")[0]


def worker_number(name):
    return int(name.split("-")[1]) if "-" in name else 1


def claude_dir(config, role):
    """The Claude config folder a role's workers run under, and so the account: the role's
    own `claudeConfigDir`, then the machine's. `check` refuses a file with neither."""
    own = (config.get("roles", {}).get(role) or {}).get("claudeConfigDir")
    return expand(own or config.get("claudeConfigDir"))


def is_claude_default(folder):
    return folder.expanduser().resolve() == CLAUDE_DEFAULT.resolve()


def account_file(folder):
    return folder.parent / ".claude.json" if is_claude_default(folder) else folder / ".claude.json"


def account(folder):
    """The email of the account logged in under `folder`, or None. No token is read."""
    try:
        data = json.loads(account_file(folder).read_text())
    except (OSError, json.JSONDecodeError):
        return None
    email = (data.get("oauthAccount") or {}).get("emailAddress")
    # On Linux the login itself is a file beside it; a Mac keeps it in the Keychain.
    if not email or (sys.platform != "darwin" and not (folder / ".credentials.json").exists()):
        return None
    return email


def settings(config, role):
    """The built-in floor, then `defaults`, then the role's own starting values in `ROLES`
    (the testers' larger memory), then the role's entry in the file. A null is not set,
    at every level, so it never removes the floor."""
    merged = {key: BUILT_IN.get(key) for key in SETTINGS}
    merged.update({key: value for key, value in (config.get("defaults") or {}).items()
                   if key in SETTINGS and value is not None})
    merged.update({key: value for key, value in (roles.ROLES.get(role) or {}).items()
                   if key in SETTINGS})
    merged.update({key: value for key, value in (config.get("roles", {}).get(role) or {}).items()
                   if key in SETTINGS and value is not None})
    return merged


def effort_for(values, kind):
    """A comment run takes `inboxEffort` where it is set, and the role's `effort` where it is
    not. Every other kind of work takes `effort`."""
    if kind != "inbox":
        return values["effort"]
    return values.get("inboxEffort") or values["effort"]


def inbox_batch(values):
    """How many `inbox` items one run claims: `inboxBatch`, or one where it is unset."""
    return values.get("inboxBatch") or 1


def slice_memory(config):
    """`sliceMemoryMax`, or 16G when it is unset or not a size, which `check` reports."""
    value = config.get("sliceMemoryMax")
    return str(value) if value is not None and SIZE.match(str(value)) else SLICE_MEMORY


def minutes(runtime):
    number, unit = RUNTIME.match(runtime).groups()
    return int(number) * (60 if unit == "h" else 1)


def manual_testers(config):
    """The people who test, by `@mention name`: each with the machine that holds their stack
    and their Shortcut member id."""
    found = (config or {}).get("manualTesters")
    return found if isinstance(found, dict) else {}


# The people's stack: QA tester 4 in scripts/qa-env.mjs, served on this machine's address.
PERSON_STACK = "soirely-qa4"


def person_stack(config):
    return (workspace(config) or pathlib.Path("~/Projects").expanduser()) / PERSON_STACK


def manual_problems(config):
    found = (config or {}).get("manualTesters")
    if found is None:
        return []
    if not isinstance(found, dict):
        return [f"manualTesters in {path()} is not an object of @name: {{machine, member}}"]
    problems = []
    for name, entry in found.items():
        if not roles.person(name) or not re.fullmatch(roles.NAME, name):
            problems.append(f"manualTesters: {name!r} is not an @ and a Shortcut mention name")
        elif not isinstance(entry, dict) or not entry.get("machine"):
            problems.append(f"manualTesters: {name} names no machine for their stack")
        elif entry.get("member") is not None and not isinstance(entry["member"], str):
            problems.append(f"manualTesters: {name}'s member is not a Shortcut member id")
    return problems


def setting_problems(values, known, where):
    problems = []
    model, effort = values.get("model"), values.get("effort")
    if not model:
        problems.append(f"{where}: no model; the default belongs in defaults.model")
    elif model not in known:
        problems.append(f"{where}: model {model!r} is not one sq accepts: "
                        f"{', '.join(known)} (tools/queue/models.json)")
    if not effort:
        problems.append(f"{where}: no effort; the default belongs in defaults.effort")
    elif model in known and effort not in known[model]["efforts"]:
        problems.append(f"{where}: effort {effort!r} is not one {model} takes: "
                        f"{', '.join(known[model]['efforts'])}")
    inbox = values.get("inboxEffort")
    if inbox is not None and model in known and inbox not in known[model]["efforts"]:
        problems.append(f"{where}: inboxEffort {inbox!r} is not one {model} takes: "
                        f"{', '.join(known[model]['efforts'])}")
    memory = values.get("memoryMax")
    if memory is not None and not SIZE.match(str(memory)):
        problems.append(f"{where}: memoryMax {memory!r} is not a size such as 3G")
    runtime = values.get("maxRuntime")
    if runtime is not None and not RUNTIME.match(str(runtime)):
        problems.append(f"{where}: maxRuntime {runtime!r} is not a time such as 90m")
    every = values.get("wakeEvery")
    if every is not None and (not RUNTIME.match(str(every)) or not minutes(str(every))):
        problems.append(f"{where}: wakeEvery {every!r} is not a time such as 3m or 1h")
    workers = values.get("workers")
    if workers is not None and (isinstance(workers, bool) or not isinstance(workers, int)
                                or workers < 1):
        problems.append(f"{where}: workers {workers!r} is not a whole number from 1")
    batch = values.get("inboxBatch")
    if batch is not None and (isinstance(batch, bool) or not isinstance(batch, int) or batch < 1):
        problems.append(f"{where}: inboxBatch {batch!r} is not a whole number from 1")
    budget = values.get("maxBudgetUsd")
    if budget is not None and (isinstance(budget, bool) or not isinstance(budget, (int, float))
                               or budget <= 0):
        problems.append(f"{where}: maxBudgetUsd {budget!r} is not a positive number")
    return problems


def check(config, known=None, logged_in=account):
    """`(errors, refused, ready)`: errors stop every role, refused names each role that
    cannot run and why, ready holds each runnable role's merged settings."""
    known = known or models()
    errors, refused, ready = [], {}, {}
    if not workspace(config):
        errors.append(f"no workspace in {path()}; run just agents setup")
    listed = config.get("roles") or {}
    unknown = [role for role in listed if role not in roles.ROLES]
    if unknown:
        errors.append(f"unknown role {', '.join(unknown)} in {path()}: "
                      f"one of {', '.join(roles.ROLES)}")
    if "ops" not in listed:
        # A refusal, not an error: an older file must not stop the self-update that fixes it.
        refused["ops"] = (f"not listed in {path()}: every machine runs ops, for its own disk, "
                          f"Docker, stacks and manager (ops@{machine_name(config)})")
    defaults = config.get("defaults") or {}
    if not config.get("claudeConfigDir"):
        errors.append(f"no claudeConfigDir in {path()}: the Claude config folder the workers "
                      "use, ~/.claude (Claude's own) unless this machine keeps them apart")
    missing = [key for key in ("model", "effort") if not defaults.get(key)]
    if missing:
        errors.append(f"no default {' or '.join(missing)} in {path()}: defaults.model and "
                      "defaults.effort, claude-opus-5-5 and medium unless the owner chose "
                      "otherwise")
    if config.get("onVersionDrift") not in (None, "warn", "stop"):
        errors.append(f"onVersionDrift is {config['onVersionDrift']!r} in {path()}: "
                      "warn or stop")
    for name in ("dailyBudgetUsd", "minFreeGb"):
        value = config.get(name)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))
                                  or value < 0):
            errors.append(f"{name} is {value!r} in {path()}: a number, or null")
    limit = config.get("sliceMemoryMax")
    if limit is not None and not SIZE.match(str(limit)):
        errors.append(f"sliceMemoryMax is {limit!r} in {path()}: a size such as 28G, or null")
    for role in listed:
        if role in unknown:
            continue
        values = settings(config, role)
        problems = setting_problems(values, known, role)
        if problems:
            refused[role] = "; ".join(problems)
            continue
        if (values.get("workers") or 1) > 1 and role not in roles.PARALLEL:
            refused[role] = (f"workers is {values['workers']}, but {role} keeps one stack, so "
                             f"runs one worker; only {', '.join(roles.PARALLEL)} run more")
            continue
        place = checkout(config, role)
        if place and not place.exists():
            refused[role] = f"no checkout at {place}"
            continue
        folder = claude_dir(config, role)
        if folder and not logged_in(folder):
            login = "claude" if is_claude_default(folder) else f"CLAUDE_CONFIG_DIR={folder} claude"
            refused[role] = (f"no Claude login in {folder}: run {login}, then /login with the "
                             "account this role should use")
            continue
        ready[role] = values
    return errors, refused, ready


def price_note(role, model, config, known=None):
    """A line when a role runs dearer than the default, so the choice is always deliberate."""
    known = known or models()
    default = (config.get("defaults") or {}).get("model")
    if model == default or model not in known or default not in known:
        return None
    ratio = known[model]["usdPerMillion"]["output"] / known[default]["usdPerMillion"]["output"]
    if ratio <= 1:
        return None
    return f"{role} runs {model}, {ratio:g}× the default per token"


def free_gb(config):
    root = workspace(config)
    while root and not root.exists():
        root = root.parent
    return shutil.disk_usage(root or pathlib.Path.home()).free / 1e9


def suggested_workspace():
    projects = pathlib.Path("~/Projects").expanduser()
    return "~/Projects" if projects.exists() else "~/soirely"


def ask_workspace(config, ask=input, say=print):
    """Asks once, checks the answer, and saves it. Only for a command the owner runs."""
    count = max(len(config.get("roles") or {}), 1)
    while True:
        default = suggested_workspace()
        answer = ask(f"Where should the agents' checkouts live? [{default}]: ").strip() or default
        place = expand(answer)
        if not place.exists():
            if ask(f"  {place} does not exist. Create it? [Y/n] ").strip().lower() in ("n", "no"):
                continue
            place.mkdir(parents=True)
        if not os.access(place, os.W_OK):
            say(f"  {place} cannot be written to; choose another.")
            continue
        free = shutil.disk_usage(place).free / 1e9
        say(f"  Role checkouts will be created here as soirely-<role>, for the {count} roles "
            f"in this file (about 1 GB each, {free:.0f} GB free).")
        if free < count:
            say(f"  That is not enough room for {count} checkouts; choose another.")
            continue
        if ask(f'  Save "workspace": "{answer}" and continue? [Y/n] ').strip().lower() \
                in ("n", "no"):
            continue
        config["workspace"] = answer
        save(config)
        return config
