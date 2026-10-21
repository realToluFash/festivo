"""One JSON line per worker run, in `<sq home>/runs/<role>.jsonl`: what it cost and what it
reported. The owner reads it through `sq status` and `sq cost`."""

import datetime
import json
import re

OWNER = re.compile(r"waiting on (?:the )?owner|owner'?s? (?:decision|call|go-ahead)|"
                   r"needs the owner|for the owner to", re.IGNORECASE)


def folder(home):
    path = home / "runs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def append(home, role, entry):
    with (folder(home) / f"{role}.jsonl").open("a") as out:
        out.write(json.dumps(entry) + "\n")


def entries(home, role):
    path = folder(home) / f"{role}.jsonl"
    if not path.exists():
        return []
    found = []
    for line in path.read_text().splitlines():
        try:
            found.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return found


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
    """The parts of `claude -p --output-format json` worth keeping."""
    return {"exit": exit_code, "cost_usd": result.get("total_cost_usd"),
            "usage": result.get("usage"), "turns": result.get("num_turns"),
            "duration_ms": result.get("duration_ms"), "is_error": result.get("is_error"),
            "report": result.get("result")}
