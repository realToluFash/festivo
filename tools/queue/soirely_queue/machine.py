"""What this machine runs: `agents.json`, read every minute, and checked before it is used.

Nothing here guesses. A role whose settings fail a check is refused with a reason, and the
roles beside it keep running."""

import json
import os
import pathlib
import re
import shutil
import sys

from . import roles

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLE = HERE.parent / "agents.example.json"
MODELS = HERE.parent / "models.json"
SETTINGS = ("model", "effort", "memoryMax", "maxRuntime", "maxBudgetUsd")
SIZE = re.compile(r"^\d+[KMG]$")
RUNTIME = re.compile(r"^(\d+)(m|h)$")
# Claude Code's own default folder, which keeps its account file beside it, not inside.
CLAUDE_DEFAULT = pathlib.Path("~/.claude").expanduser()
# Under everything in agents.json: a worker is never left without a time limit.
BUILT_IN = {"maxRuntime": "90m"}


class ConfigError(RuntimeError):
    pass


def config_dir():
    return pathlib.Path(os.environ.get("SOIRELY_CONFIG", "~/.config/soirely")).expanduser()


def path():
    return config_dir() / "agents.json"


def env_file():
    return config_dir() / "env"


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


def workspace(config):
    return expand(config.get("workspace"))


def checkout(config, role):
    own = (config.get("roles", {}).get(role) or {}).get("checkout")
    if own:
        return expand(own)
    root = workspace(config)
    if not root:
        return None
    return root / (config.get("mainCheckout") or "soirely") if role == "dev" \
        else root / f"soirely-{role}"


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


def minutes(runtime):
    number, unit = RUNTIME.match(runtime).groups()
    return int(number) * (60 if unit == "h" else 1)


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
    memory = values.get("memoryMax")
    if memory is not None and not SIZE.match(str(memory)):
        problems.append(f"{where}: memoryMax {memory!r} is not a size such as 3G")
    runtime = values.get("maxRuntime")
    if runtime is not None and not RUNTIME.match(str(runtime)):
        problems.append(f"{where}: maxRuntime {runtime!r} is not a time such as 90m")
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
        errors.append(f"ops is not listed in {path()}: every machine runs ops, for its own "
                      "disk, Docker, stacks and manager (ops@<machine>)")
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
    for role in listed:
        if role in unknown:
            continue
        values = settings(config, role)
        problems = setting_problems(values, known, role)
        if problems:
            refused[role] = "; ".join(problems)
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
