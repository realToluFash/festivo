"""The PreToolUse hook that keeps a worker's Artifact tools to reading. A worker reads the
design; it never publishes, edits or comments in it. The refusal sits here, outside the model,
so a wrong call from an unattended worker is stopped before it runs (sc-25203, OWASP LLM06).
Claude passes the call on stdin; exit 2 refuses it and tells the model why. Anything this
cannot read as a read is refused."""

import json
import sys

READS = ("read", "list")


def refusal(call):
    """Why the call is refused, or None when it only reads."""
    tool = call.get("tool_name") or ""
    if not tool.startswith("Artifact"):
        return None
    action = (call.get("tool_input") or {}).get("action")
    if action in READS:
        return None
    return (f"{tool} with action {action!r} is refused: a worker only reads the design "
            f"({' or '.join(READS)}). Tag [ops] on the story if you need more.")


def main(stdin=sys.stdin, stderr=sys.stderr):
    try:
        call = json.load(stdin)
    except ValueError:
        call = {"tool_name": "Artifact", "tool_input": {}}
    why = refusal(call if isinstance(call, dict) else {"tool_name": "Artifact"})
    if why:
        print(why, file=stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
