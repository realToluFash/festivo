"""A worker run as a background session (`claude --bg`) rather than `claude -p`. Only a
background session has the Artifact tool, and the developers and the lead read the design in
an Artifact, Soirely — Redesign.

The session runs under the account's Claude daemon, not under the worker, so its limits are
kept here by polling, as the Mac supervisor keeps them: the run's time, its memory, and its
budget. Claude writes no result for a background session, so the run log's entry is read
from its transcript, and its cost reckoned from `models.json`."""

import json
import pathlib
import re
import shlex
import subprocess
import sys
import time

from . import launchd, machine, runner, sessions

POLL_SECONDS = 5
# A background session in one of these has ended its turn: it will do nothing more unasked.
ENDED = ("idle", "done", "completed", "stopped", "exited", "failed", "error")
STARTED = re.compile(r"backgrounded · (\w+)")
# The daemon can take a few polls to list a session it has just started, and one listing can
# fail; neither is the session gone.
FIRST_POLLS = 6
GUARD = pathlib.Path(__file__).with_name("artifact_guard.py")
# Cache reads are billed at a tenth of input; writes at 1.25 times for five minutes, twice
# for an hour.
CACHE_READ, CACHE_WRITE_5M, CACHE_WRITE_1H = 0.1, 1.25, 2.0
# A session sometimes starts without the Artifact tools (seen once, 1 Nov, sc-25203): it is
# started once more, then reported. Artifact itself is not deferred; these two come with it.
ARTIFACT_TOOLS = ("ArtifactComments", "ArtifactData")
TOOLS_WAIT_SECONDS = 120
TRIES = 2


class NotStarted(RuntimeError):
    pass


class NoArtifactTools(NotStarted):
    def __init__(self, short):
        super().__init__(f"the session started twice without the Artifact tools (last "
                         f"{short}); see sc-25203")
        self.short = short


def read_only_settings(python=None):
    """Settings whose PreToolUse hook refuses any Artifact call that does not only read."""
    hook = f"{shlex.quote(python or sys.executable)} {shlex.quote(str(GUARD))}"
    return json.dumps({"hooks": {"PreToolUse": [
        {"matcher": "Artifact.*", "hooks": [{"type": "command", "command": hook}]}]}})


def command(values, folder, name, prompt, allowed=(), denied=(), extra=None, read_only=True):
    """`read_only` is every worker's but the drawing's: their Artifact calls only read."""
    argv = ["claude", "--bg", "--name", name, "--model", values["model"],
            "--effort", values["effort"], "--permission-mode", "auto"]
    if read_only:
        argv += ["--settings", read_only_settings()]
    if allowed:
        argv += ["--allowedTools", *allowed]
    if denied:
        argv += ["--disallowedTools", *denied]
    # The tool lists take every word after them, so `--` keeps the prompt out of the last one.
    argv += ["--", prompt]
    env = runner.account_env(folder)
    env.update(extra or {})
    return argv, env


def start(argv, cwd, env, run=subprocess.run):
    """Starts the session and returns its short id, as `claude agents` lists it."""
    done = run(argv, capture_output=True, text=True, cwd=cwd, env=env)
    found = STARTED.search(done.stdout or "")
    if not found:
        said = (done.stdout or done.stderr or "no output").strip()
        if "not trusted" in said:
            said += (" Run `claude` once in the main checkout, the repository every role "
                     "checkout is a worktree of, with CLAUDE_CONFIG_DIR="
                     f"{env.get('CLAUDE_CONFIG_DIR', '~/.claude')} and accept the trust prompt; "
                     "trusting a folder above it does not count.")
        raise NotStarted(said[:400])
    return found.group(1)


def listed(env, run=subprocess.run):
    """Every background session the account's daemon knows, ended ones too, by short id, or
    None when `claude agents` could not say."""
    out = run(["claude", "agents", "--json", "--all"], capture_output=True, text=True, env=env)
    try:
        return {s["id"]: s for s in json.loads(out.stdout) if s.get("kind") == "background"}
    except (ValueError, KeyError, TypeError):
        return None


def stop(short, env, run=subprocess.run):
    """Ends the session but keeps it, so `claude attach` can still show what it did."""
    run(["claude", "stop", short], capture_output=True, env=env)


def tree_rss(pid, table=None):
    """Bytes resident in the session's process and everything it started."""
    if not pid:
        return 0
    found = [pid, *runner.descendants(pid, (table or runner.process_table)())]
    out = subprocess.run(["ps", "-o", "rss=", "-p", ",".join(map(str, found))],
                         capture_output=True, text=True).stdout
    return sum(int(n) * 1024 for n in out.split() if n.isdigit())


def cost(usage, model, known=None):
    prices = (known or machine.models()).get(model, {}).get("usdPerMillion")
    if not prices:
        return None
    given, made = prices["input"] / 1e6, prices["output"] / 1e6
    written = usage.get("cache_creation") or {}
    hour = written.get("ephemeral_1h_input_tokens") or 0
    five = (usage.get("cache_creation_input_tokens") or 0) - hour
    return round((usage.get("input_tokens") or 0) * given
                 + (usage.get("output_tokens") or 0) * made
                 + (usage.get("cache_read_input_tokens") or 0) * given * CACHE_READ
                 + five * given * CACHE_WRITE_5M + hour * given * CACHE_WRITE_1H, 6)


def summary(lines, model, known=None):
    """What `claude -p` would have written as its result, read from the transcript: the
    last thing the agent said, the turns, the time it worked, the usage and the cost."""
    usage, report, worked = {}, None, 0
    for line in lines:
        if line.get("isSidechain"):
            continue
        message = line.get("message") or {}
        if line.get("type") == "assistant":
            if message.get("id") and message.get("usage"):
                usage[message["id"]] = message["usage"]
            text = sessions.output_text(message.get("content")).strip()
            if text:
                report = text
        elif line.get("type") == "system" and line.get("subtype") == "turn_duration":
            worked += line.get("durationMs") or 0
    total = {}
    for each in usage.values():
        for field in ("input_tokens", "output_tokens", "cache_read_input_tokens",
                      "cache_creation_input_tokens"):
            total[field] = total.get(field, 0) + (each.get(field) or 0)
        hour = (each.get("cache_creation") or {}).get("ephemeral_1h_input_tokens") or 0
        made = total.setdefault("cache_creation", {"ephemeral_1h_input_tokens": 0})
        made["ephemeral_1h_input_tokens"] += hour
    return {"result": report, "usage": total, "num_turns": len(usage),
            "duration_ms": worked or None, "total_cost_usd": cost(total, model, known),
            "is_error": report is None}


def watch(short, env, folder, finished, values, clock=time.monotonic, sleep=time.sleep,
          ls=listed, rss=tree_rss, lines_of=None, poll=POLL_SECONDS, on_session=None):
    """Waits for the session's turn to end, or for its item to be done and settled, or for a
    limit. Returns `(why it stopped, the session as last listed)`: `ended`, `settled`,
    `timeout`, `oom-kill`, `budget`, or `gone` when the daemon no longer lists it. An empty
    or failed listing in the first polls is not yet gone. `on_session` hears the full session
    id from the first listing that has one."""
    limit = machine.minutes(values["maxRuntime"]) * 60 if values.get("maxRuntime") else None
    memory = launchd.size_bytes(values.get("memoryMax"))
    budget = values.get("maxBudgetUsd")
    lines_of = lines_of or (lambda session: transcript_lines(folder, session))
    began, settled, seen, polls, told = clock(), None, {}, 0, False
    while True:
        polls += 1
        sessions_now = ls(env)
        seen = (sessions_now or {}).get(short) or seen
        state = seen.get("state") or seen.get("status")
        if not seen:
            if polls <= FIRST_POLLS:
                sleep(poll)
                continue
            return "gone", seen
        if on_session and not told and seen.get("sessionId"):
            told = True
            on_session(seen["sessionId"])
        if limit and clock() - began > limit:
            return "timeout", seen
        if memory and rss(seen.get("pid")) > memory:
            return "oom-kill", seen
        if budget and seen.get("sessionId"):
            spent = summary(lines_of(seen["sessionId"]), values["model"])["total_cost_usd"]
            if spent and spent >= float(budget):
                return "budget", seen
        if state in ENDED:
            return "ended", seen
        if settled is None and finished():
            settled = clock()
        if settled is not None and clock() - settled >= runner.SETTLE_SECONDS:
            return "settled", seen
        sleep(poll)


def transcript_lines(folder, session_id):
    path = sessions.transcript(folder, session_id)
    return sessions.read(path) if path else []


def has_artifact_tools(lines):
    """Whether the session was given the Artifact tools, or None before its first reply,
    when its tool list is not all written yet."""
    named = set()
    for line in lines:
        if line.get("type") == "assistant":
            return any(tool in named for tool in ARTIFACT_TOOLS)
        attachment = line.get("attachment") or {}
        if attachment.get("type") == "deferred_tools_delta":
            named.update(attachment.get("addedNames") or [])
    return None


def refused_read(lines):
    """The first Artifact read or list the session was refused, as the tool answered it, or
    None. A refused read is most often an artifact not shared with the account."""
    asked = {}
    for line in lines:
        for part in (line.get("message") or {}).get("content") or []:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "tool_use" and part.get("name") == "Artifact" \
                    and (part.get("input") or {}).get("action", "read") in ("read", "list"):
                asked[part.get("id")] = part
            elif part.get("type") == "tool_result" and part.get("is_error") \
                    and part.get("tool_use_id") in asked:
                return sessions.output_text(part.get("content")).strip()[:200] or "refused"
    return None


def tools_given(short, env, lines_of, clock=time.monotonic, sleep=time.sleep, ls=listed,
                poll=POLL_SECONDS, **_):
    """Waits for the session's first reply and says whether it has the Artifact tools. A
    session that ends first, or is still quiet at the wait's end, is given the benefit."""
    began = clock()
    while clock() - began < TOOLS_WAIT_SECONDS:
        seen = (ls(env) or {}).get(short) or {}
        given = has_artifact_tools(lines_of(seen["sessionId"])) if seen.get("sessionId") \
            else None
        if given is not None:
            return given
        if (seen.get("state") or seen.get("status")) in ENDED:
            return True
        sleep(poll)
    return True


def run(values, folder, name, prompt, cwd, finished, allowed=(), denied=(), extra=None,
        on_start=None, daemon=None, run_command=subprocess.run, **watching):
    """Runs one worker's item as a background session. Returns `(result, exit status, why it
    stopped, the full session id)`, the result shaped as `claude -p` writes one. `daemon`
    makes sure the account's daemon runs somewhere the worker's end will not take it down."""
    argv, env = command(values, folder, name, prompt, allowed, denied, extra)
    if daemon:
        daemon(env)
    lines_of = watching.get("lines_of") or (lambda s: transcript_lines(folder, s))
    for _ in range(TRIES):
        short = start(argv, cwd, env, run_command)
        first = None
        if on_start:
            first = ((watching.get("ls") or listed)(env) or {}).get(short, {}).get("sessionId")
            on_start(short, first)
        if tools_given(short, env, **dict(watching, lines_of=lines_of)):
            break
        stop(short, env, run_command)
    else:
        raise NoArtifactTools(short)
    on_session = (lambda session: on_start(short, session)) if on_start and not first \
        else None
    why, seen = watch(short, env, folder, finished, values, on_session=on_session, **watching)
    if why != "ended":
        stop(short, env, run_command)
    session = seen.get("sessionId")
    lines = lines_of(session) if session else []
    result = summary(lines, values["model"])
    result["artifact_refused"] = refused_read(lines)
    code = 0 if why in ("ended", "settled") and not result["is_error"] else 1
    return result, code, why, session
