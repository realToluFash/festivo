"""A worker's Claude session, as `sq web` shows it: the run sq started it for, and the
transcript Claude writes as it goes, under the account folder it runs as
(`<folder>/projects/<checkout>/<session>.jsonl`)."""

import datetime
import json
import re
import shlex
import uuid

from . import machine, roles, runlog, store

ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
OUTPUT_CHARS = 4000
TEXT_CHARS = 20000
INPUT_CHARS = 2000
# The file tools are shown by the path they touch, the rest by the one input that says most.
SHOWN_BY = {"Bash": "command", "Read": "file_path", "Write": "file_path", "Edit": "file_path",
            "MultiEdit": "file_path", "NotebookEdit": "notebook_path", "Grep": "pattern",
            "Glob": "pattern", "Skill": "skill", "Agent": "description", "WebFetch": "url",
            "WebSearch": "query"}


def new_id():
    return str(uuid.uuid4())


def key(name):
    return f"session:{name}"


def begin(db, name, run):
    """What a worker is running now, kept until its next run replaces it."""
    store.set_meta(db, key(name), run)


def current(db, name):
    return store.get_meta(db, key(name))


def recorded(db, home, session_id):
    """The run that started `session_id` on this machine, or None: a worker's current
    session, then the run log."""
    for row in db.execute("select value from meta where key like 'session:%'"):
        run = json.loads(row["value"])
        if run.get("session") == session_id:
            return run
    for role in roles.ROLES:
        for entry in reversed(runlog.entries(home, role)):
            if entry.get("session") == session_id:
                return entry
    return None


def ended(home, run):
    """The run log's entry for `run`, once its worker has written one."""
    for entry in reversed(runlog.entries(home, run.get("role"))):
        if entry.get("session") == run.get("session"):
            return entry
    return None


def transcript(folder, session_id):
    found = sorted(machine.expand(folder).glob(f"projects/*/{session_id}.jsonl"))
    return found[0] if found else None


def cut(text, limit):
    text = text or ""
    if len(text) <= limit:
        return text, 0
    return text[:limit], len(text) - limit


def output_text(content):
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if block.get("type") == "text":
            parts.append(block.get("text") or "")
        elif block.get("type") == "image":
            parts.append("[an image]")
    return "\n".join(parts)


def shown(name, given):
    field = SHOWN_BY.get(name)
    if field and isinstance(given, dict) and given.get(field):
        return str(given[field])
    return json.dumps(given, ensure_ascii=False)


def when(line):
    stamp = line.get("timestamp")
    try:
        return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError):
        return None


def steps(lines):
    """The transcript in the order it happened: the prompt, what the agent wrote and
    thought, and each tool call with its output. Context Claude adds (a skill's text, the
    environment) is left out, and every long text is cut."""
    found, calls, usage = [], {}, {}
    for line in lines:
        kind, at = line.get("type"), when(line)
        message = line.get("message") or {}
        content = message.get("content")
        if line.get("isSidechain"):
            continue
        if kind == "user" and not line.get("isMeta"):
            if isinstance(content, str):
                text, more = cut(content, TEXT_CHARS)
                found.append({"kind": "prompt" if not found else "user", "at": at,
                              "text": text, "cut": more})
                continue
            for block in content or []:
                if block.get("type") == "tool_result" and block.get("tool_use_id") in calls:
                    text, more = cut(output_text(block.get("content")), OUTPUT_CHARS)
                    calls[block["tool_use_id"]].update(
                        output=text, output_cut=more, error=bool(block.get("is_error")),
                        done_at=at)
                elif block.get("type") == "text":
                    text, more = cut(block.get("text"), TEXT_CHARS)
                    found.append({"kind": "user", "at": at, "text": text, "cut": more})
        elif kind == "assistant":
            if message.get("id") and message.get("usage"):
                usage[message["id"]] = message["usage"]
            for block in content or []:
                if block.get("type") == "text" and (block.get("text") or "").strip():
                    text, more = cut(block["text"], TEXT_CHARS)
                    found.append({"kind": "text", "at": at, "text": text, "cut": more})
                elif block.get("type") == "thinking" and (block.get("thinking") or "").strip():
                    text, more = cut(block["thinking"], TEXT_CHARS)
                    found.append({"kind": "thinking", "at": at, "text": text, "cut": more})
                elif block.get("type") == "tool_use":
                    given, more = cut(json.dumps(block.get("input"), ensure_ascii=False,
                                                 indent=1), INPUT_CHARS)
                    call = {"kind": "tool", "at": at, "name": block.get("name"),
                            "shown": cut(shown(block.get("name"), block.get("input")),
                                         INPUT_CHARS)[0],
                            "input": given, "input_cut": more, "output": None}
                    calls[block.get("id")] = call
                    found.append(call)
        elif kind == "system" and isinstance(line.get("content"), str):
            text, more = cut(line["content"], TEXT_CHARS)
            found.append({"kind": "system", "at": at, "text": text, "cut": more})
    return found, tokens(list(usage.values()))


def tokens(usage):
    """Output so far, and the context the latest turn read: input, cache written and read."""
    context = 0
    if usage:
        last = usage[-1]
        context = sum(last.get(k) or 0 for k in ("input_tokens", "cache_creation_input_tokens",
                                                  "cache_read_input_tokens"))
    return {"output": sum(u.get("output_tokens") or 0 for u in usage), "context": context}


def read(path):
    lines = []
    for text in path.read_text(errors="replace").splitlines():
        try:
            line = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(line, dict):
            lines.append(line)
    return lines


def resume(run):
    folder = machine.expand(run["folder"])
    command = f"claude --resume {run['session']}"
    if not machine.is_claude_default(folder):
        command = f"CLAUDE_CONFIG_DIR={shlex.quote(str(folder))} {command}"
    return f"cd {shlex.quote(run['cwd'])} && {command}"


def story_view(db, story_id):
    story = store.story(db, story_id) if story_id else None
    if not story:
        return None
    return {"id": story["id"], "name": story.get("name"), "state": story.get("state"),
            "url": story.get("url")}


def pr_view(db, number, story_id):
    found = [store.pr(db, number)] if number else store.prs_for_story(db, story_id) \
        if story_id else []
    return [{"number": pr["number"], "title": pr.get("title"), "url": pr.get("url"),
             "state": pr.get("state")} for pr in found if pr]


def view(db, home, platform, session_id, load=machine.load):
    """Everything `sq web` shows for one session, or None for an id no run here started."""
    if not ID.match(session_id or ""):
        return None
    run = recorded(db, home, session_id)
    if not run:
        return None
    entry = ended(home, run)
    name = run.get("worker") or run.get("role")
    live = entry is None and platform.worker_active(name) and \
        (current(db, name) or {}).get("session") == session_id
    try:
        runtime = machine.settings(load(), run.get("role")).get("maxRuntime")
    except machine.ConfigError:
        runtime = None
    item = store.item(db, run["item"]) if run.get("item") else None
    shown = {"session": session_id, "worker": name, "role": run.get("role"),
             "live": bool(live), "at": run.get("at"),
             "max_minutes": machine.minutes(runtime) if runtime else None,
             "model": run.get("model"), "effort": run.get("effort"),
             "account": run.get("account"), "item": run.get("item"),
             "reason": item["reason"] if item else None, "cwd": run.get("cwd"),
             "main": run.get("main"),
             "story": story_view(db, run.get("story")),
             "prs": pr_view(db, item["pr"] if item else None, run.get("story")),
             "resume": resume(run) if run.get("folder") and run.get("cwd") else None,
             "ended": None, "steps": [], "tokens": None, "transcript": None}
    if entry:
        shown["ended"] = {"cost": entry.get("cost_usd"), "report": entry.get("report"),
                          "seconds": (entry.get("duration_ms") or 0) // 1000 or None,
                          "exit": entry.get("exit"), "stopped": entry.get("stopped")}
    path = transcript(run["folder"], session_id) if run.get("folder") else None
    if path is None:
        shown["missing"] = "Claude's transcript of this session is not on this machine."
        return shown
    shown["transcript"] = str(path)
    shown["steps"], shown["tokens"] = steps(read(path))
    shown["last_at"] = path.stat().st_mtime
    return shown
