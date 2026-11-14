"""Story descriptions as sections, so a role reads or edits one part rather than all of it."""

import datetime
import hashlib
import re

HEADING = re.compile(r"^(#{1,3})\s+(.+?)\s*$")
DEEPER = re.compile(r"^(#{4,})\s+(.+?)\s*$")
TOP = "(top)"


def digest(text):
    return hashlib.sha1((text or "").encode()).hexdigest()[:12]


def epoch(stamp):
    """Seconds since the epoch for one of Shortcut's or GitHub's ISO stamps, or None."""
    try:
        return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError):
        return None


def sections(markdown, heading=HEADING):
    """[(heading, level, body)] in order. Text before the first heading is `(top)`."""
    found = [[TOP, 0, []]]
    fence = False
    for line in (markdown or "").splitlines():
        if line.lstrip().startswith("```"):
            fence = not fence
        match = None if fence else heading.match(line)
        if match:
            found.append([match.group(2), len(match.group(1)), []])
        else:
            found[-1][2].append(line)
    return [(h, level, "\n".join(body).strip("\n")) for h, level, body in found
            if h != TOP or "\n".join(body).strip()]


def find(markdown, name):
    """The section whose heading matches the name: exact first, then by prefix."""
    found = matching(markdown, name)
    return next((s for s in sections(markdown) if s[0] == found[0]), None) if found else None


def matching(markdown, name):
    """Every heading the name matches: the exact ones, or failing those, the ones it begins."""
    wanted = name.strip().lower()
    headings = [h for h, _, _ in sections(markdown)]
    exact = [h for h in headings if h.lower() == wanted]
    if exact:
        return exact
    prefixes = {"ac": ("ac", "acceptance")}.get(wanted, (wanted,))
    return [h for h in headings if h.lower().startswith(prefixes)]


def swap(markdown, heading, body):
    """The text with one section's own text replaced and every other byte as it was: the
    blank lines around the old text, and the line endings, stay."""
    lines = markdown.splitlines(keepends=True)
    marks, fence = [], False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            fence = not fence
        elif not fence and HEADING.match(line):
            marks.append(i)
    start = next(i for i in marks if HEADING.match(lines[i]).group(2) == heading)
    end = next((i for i in marks if i > start), len(lines))
    eol = "\r\n" if lines[start].endswith("\r\n") else "\n"
    old = lines[start + 1:end]
    text = [line for line in old if line.strip()]
    if not text:
        tail = eol if end < len(lines) else ""
        middle = [eol, eol.join(body.strip().splitlines()) + eol, tail]
        return "".join(lines[:start + 1] + middle + lines[end:])
    first = next(i for i, line in enumerate(old) if line.strip())
    last = max(i for i, line in enumerate(old) if line.strip())
    ending = old[last][len(old[last].rstrip("\r\n")):]
    new = eol.join(body.strip().splitlines()) + ending
    return "".join(lines[:start + 1] + old[:first] + [new] + old[last + 1:] + lines[end:])


def is_ac(heading):
    return heading.lower().startswith(("ac", "acceptance"))


def is_design(heading):
    return heading.lower().startswith("design")


def replace(markdown, name, body):
    """The description with one section's own text replaced, as `find` reads it: the
    headings under it are other sections and stay. A missing section is added at the end."""
    lines = (markdown or "").splitlines()
    found = find(markdown, name)
    if not found:
        return append_dated(markdown, name, body)
    heading = found[0]
    start = next(i for i, line in enumerate(lines)
                 if (m := HEADING.match(line)) and m.group(2) == heading)
    end = len(lines)
    fence = False
    for i in range(start + 1, len(lines)):
        if lines[i].lstrip().startswith("```"):
            fence = not fence
        if not fence and HEADING.match(lines[i]):
            end = i
            break
    new = lines[:start + 1] + ["", body.strip(), ""] + lines[end:]
    return "\n".join(new).rstrip() + "\n"


def append_dated(markdown, title, body):
    """A section added at the end, at the description's top level so it never lands
    under the last section."""
    levels = [level for heading, level, _ in sections(markdown) if heading != TOP]
    hashes = "#" * (min(levels) if levels else 2)
    return (markdown or "").rstrip() + f"\n\n{hashes} {title}\n\n{body.strip()}\n"


def outstanding_items(text):
    """The lines under a QA report's `Outstanding items:`."""
    lines = (text or "").splitlines()
    for i, line in enumerate(lines):
        if line.strip().lower().startswith("outstanding items"):
            items = []
            for later in lines[i + 1:]:
                if not later.strip():
                    if items:
                        break
                    continue
                items.append(later.strip().lstrip("-* ").strip())
            return items
    return []


def is_qa_report(text):
    return (text or "").lstrip().startswith("Tested on") or "Test results:" in (text or "")


def first_line(text, width=110):
    lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
    from .roles import header
    body = lines[1] if header(text) and len(lines) > 1 else (lines[0] if lines else "")
    return body if len(body) <= width else body[: width - 1] + "…"
