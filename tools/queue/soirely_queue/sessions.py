"""A worker's Claude session, as `sq web` shows it: what sq recorded when it started the run,
and the steps of its transcript. A running worker's record is a file in
`<sq home>/runs/live/`; once the run ends, its run log entry carries the same record."""

import datetime
import json
import re

from . import machine, roles, runlog, store

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
CUT = 4000
FILE_TOOLS = ("Read", "Write", "Edit", "MultiEdit", "NotebookEdit")


def live_folder(home):
    path = runlog.folder(home) / "live"
    path.mkdir(parents=True, exist_ok=True)
    return path


def start(home, name, record):
    (live_folder(home) / f"{name}.json").write_text(json.dumps(record))


def live(home, name):
    try:
        return json.loads((live_folder(home) / f"{name}.json").read_text())
    except (OSError, json.JSONDecodeError):
        return None


def end(home, name):
    (live_folder(home) / f"{name}.json").unlink(missing_ok=True)


def find(home, session_id):
    """`(record, live)` for a session a worker on this machine recorded, or None."""
    if not UUID.match(session_id or ""):
        return None
    for path in live_folder(home).glob("*.json"):
        record = live(home, path.stem)
        if record and record.get("session") == session_id and record.get("config_dir"):
            return record, True
    for role in roles.ROLES:
        for entry in reversed(runlog.entries(home, role)):
            if entry.get("session") == session_id and entry.get("config_dir"):
                return entry, False
    return None


def transcript(record):
    """The transcript file of a recorded session, read only from its account folder."""
    folder = machine.expand(record.get("config_dir"))
    if not folder:
        return None
    found = sorted((folder / "projects").glob(f"*/{record['session']}.jsonl"))
    return found[0] if found else None


def cut(text):
    text = text if isinstance(text, str) else json.dumps(text)
    if len(text) <= CUT:
        return text, 0
    return text[:CUT], len(text) - CUT


def result_text(content):
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if block.get("type") == "text":
            parts.append(block.get("text") or "")
        else:
            parts.append(f"[{block.get('type')}]")
    return "\n".join(parts)


def tool_input(name, given):
    given = given or {}
    if name == "Bash" and "command" in given:
        return given["command"]
    if name in FILE_TOOLS and (given.get("file_path") or given.get("notebook_path")):
        return given.get("file_path") or given.get("notebook_path")
    return json.dumps(given, indent=1)


def steps(lines, prompt=None):
    """The transcript's steps in order, and its tokens so far. A long input or output is
    cut, saying how much, so a session of several MB still loads."""
    found, tools, usage = [], {}, {}
    for line in lines:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict) or event.get("type") not in ("user", "assistant"):
            continue
        message, at = event.get("message") or {}, event.get("timestamp")
        content = message.get("content")
        if event["type"] == "assistant" and message.get("usage"):
            usage[message.get("id") or len(usage)] = message["usage"]
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        for block in content or []:
            kind = block.get("type")
            if kind == "text" and (block.get("text") or "").strip():
                text = block["text"]
                if event["type"] == "user" and text.strip() == (prompt or "").strip():
                    continue
                shown, more = cut(text) if event["type"] == "user" else (text, 0)
                found.append({"at": at, "kind": "context" if event.get("isMeta") else
                              "user" if event["type"] == "user" else "text",
                              "text": shown, "cut": more})
            elif kind == "thinking" and (block.get("thinking") or "").strip():
                found.append({"at": at, "kind": "thinking", "text": block["thinking"]})
            elif kind == "tool_use":
                shown, more = cut(tool_input(block.get("name"), block.get("input")))
                step = {"at": at, "kind": "tool", "name": block.get("name"), "input": shown,
                        "input_cut": more, "output": None}
                tools[block.get("id")] = step
                found.append(step)
            elif kind == "tool_result":
                shown, more = cut(result_text(block.get("content")))
                answer = {"output": shown, "cut": more, "error": bool(block.get("is_error")),
                          "done_at": at}
                step = tools.get(block.get("tool_use_id"))
                if step:
                    step.update(answer)
                else:
                    found.append(dict(answer, at=at, kind="result"))
    tokens = {key: sum(u.get(key) or 0 for u in usage.values())
              for key in ("input_tokens", "output_tokens", "cache_read_input_tokens",
                          "cache_creation_input_tokens")}
    return found, tokens


def resume(record):
    folder = machine.expand(record.get("config_dir"))
    env = "" if not folder or machine.is_claude_default(folder) else f"CLAUDE_CONFIG_DIR={folder} "
    return f"cd {record.get('checkout')} && {env}claude --resume {record['session']}"


def started_at(at):
    return datetime.datetime.fromtimestamp(at).isoformat(timespec="seconds") if at else None


def view(db, home, platform, session_id, now):
    """What the session page shows, or None for a session no worker here recorded."""
    found = find(home, session_id)
    if not found:
        return None
    record, running = found
    name = record.get("worker") or record.get("role")
    running = running and platform.worker_active(name)
    story_id = record.get("story")
    story = store.story(db, story_id) if story_id else None
    item = store.item(db, record["item"]) if record.get("item") else None
    pr_number = record.get("pr") or (item["pr"] if item else None)
    if not pr_number and story_id:
        row = db.execute("select number from prs where story_id = ? order by number desc",
                         (story_id,)).fetchone()
        pr_number = row["number"] if row else None
    pr = store.pr(db, pr_number) if pr_number else None
    page = {
        "session": session_id, "worker": name, "role": record.get("role"), "live": running,
        "at": record.get("at"), "started": started_at(record.get("at")),
        "elapsed": (now - record["at"]) if running and record.get("at") else
        ((record.get("duration_ms") or 0) // 1000 or None),
        "max_runtime_minutes": record.get("max_runtime_minutes"),
        "model": record.get("model"), "effort": record.get("effort"),
        "account": record.get("account"), "config_dir": record.get("config_dir"),
        "item": {"id": record.get("item"),
                 "reason": record.get("reason") or (item["reason"] if item else None)},
        "story": {"id": story_id, "name": (story or {}).get("name") or record.get("story_name"),
                  "state": (story or {}).get("state"),
                  "url": (story or {}).get("url")} if story_id else None,
        "pr": {"number": pr_number, "url": (pr or {}).get("url"),
               "title": (pr or {}).get("title")} if pr_number else None,
        "checkout": record.get("checkout"), "main": record.get("main"),
        "prompt": record.get("prompt"), "resume": resume(record),
        "cost": None if running else record.get("cost_usd"),
        "report": None if running else record.get("report"),
        "exit": record.get("exit"), "stopped": record.get("stopped"),
        "steps": [], "tokens": None, "transcript": None}
    path = transcript(record)
    if not path:
        page["transcript"] = "missing"
        return page
    with path.open(errors="replace") as lines:
        page["steps"], page["tokens"] = steps(lines, record.get("prompt"))
    return page
