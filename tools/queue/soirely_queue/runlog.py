"""One JSON line per worker run, in `<sq home>/runs/<role>.jsonl`: what it cost and what it
reported. The owner reads it through `sq status` and `sq cost`."""

import datetime
import json
import re

OWNER = re.compile(r"waiting on (?:the )?owner|owner'?s? (?:decision|call|go-ahead)|"
                   r"needs the owner|for the owner to", re.IGNORECASE)

PARSED = {}


def folder(home):
    path = home / "runs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def append(home, role, entry):
    with (folder(home) / f"{role}.jsonl").open("a") as out:
        out.write(json.dumps(entry) + "\n")


def entries(home, role):
    """Every run of the role, oldest first. A log is parsed once for as long as it is
    unchanged: a week of spend alone reads each role's seven times, and a log runs to
    thousands of lines."""
    path = folder(home) / f"{role}.jsonl"
    try:
        seen = path.stat()
    except FileNotFoundError:
        return []
    stamp = (seen.st_mtime_ns, seen.st_size)
    kept = PARSED.get(path)
    if not kept or kept[0] != stamp:
        found = []
        for line in path.read_text().splitlines():
            try:
                found.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        kept = PARSED[path] = (stamp, found)
    return list(kept[1])


def last(home, role):
    found = entries(home, role)
    return found[-1] if found else None


def day(at):
    return datetime.datetime.fromtimestamp(at).date()


def spent(home, roles, on=None):
    """Dollars per role for one local day, today unless `on` names another."""
    on = on or datetime.date.today()
    return {role: sum(e.get("cost_usd") or 0 for e in entries(home, role)
                      if e.get("at") and day(e["at"]) == on) for role in roles}


def waits_on_owner(report):
    return [line.strip() for line in (report or "").splitlines() if OWNER.search(line)]


def from_result(result, exit_code):
    """The parts of a `claude -p` result worth keeping."""
    return {"exit": exit_code, "cost_usd": result.get("total_cost_usd"),
            "usage": result.get("usage"), "turns": result.get("num_turns"),
            "duration_ms": result.get("duration_ms"), "is_error": result.get("is_error"),
            "report": result.get("result")}
