"""What an agent reads: one block of plain text with everything a piece of work needs."""

from . import roles as R
from . import work as W

ONE_LINE = 110


def _first(text, width=ONE_LINE):
    lines = [line for line in (text or "").splitlines() if line.strip()]
    body = " ".join(lines[1:2] if R.header(text) else lines[:1])
    return body if len(body) <= width else body[: width - 1] + "…"


def _indent(text, prefix="    "):
    return "\n".join(prefix + line if line else "" for line in (text or "").splitlines())


def story_block(story, with_description=True):
    out = [f"sc-{story['id']} {story['name']}",
           f"  {story['state']} · labels {', '.join(story['labels']) or 'none'}"
           f" · epic {story['epic'] or 'none'} · {story['url']}"]
    if with_description and story["description"].strip():
        out += ["", "Description:", _indent(story["description"].strip())]
    return out


def comments_block(story, role, everything=False, handled=frozenset()):
    """Threads that involve the role in full; the rest as one line each."""
    open_ids = {c["id"] for c in W.open_for(role, story, handled)} if role else set()
    full, rest = [], []
    for thread in W.threads(story):
        if everything or not role or W.involves(role, thread, story["labels"]):
            for index, comment in enumerate(thread):
                mark = "  ← open for you" if comment["id"] in open_ids else ""
                lead = "#" if index == 0 else "  ↳ #"
                full.append(f"{lead}{comment['id']} {comment['at'][:16]}{mark}")
                full.append(_indent(comment["text"].strip(), "      " if index else "    "))
        else:
            root = thread[0]
            tag = R.header(root["text"])
            who = f"(from {tag['from']}) to {' '.join(tag['to']) or '-'}" if tag else ""
            replies = f" +{len(thread) - 1} replies" if len(thread) > 1 else ""
            rest.append(f"  #{root['id']} {who}: {_first(root['text'])}{replies}")
    out = []
    if full:
        out += ["", f"Comments{' for ' + role if role and not everything else ''}:"] + full
    if rest:
        out += ["", f"Other threads ({len(rest)}; `sq show sc-{story['id']} --all` prints them):"]
        out += rest
    return out


def pr_block(pr, role=None):
    verdicts = ", ".join(f"{v['verdict']} at {(v['sha'] or '?')[:7]}"
                         for v in sorted(pr["lead"], key=lambda v: v["at"])) or "none"
    out = ["", f"PR #{pr['number']} {pr['title']}",
           f"  {pr['state']} · head {pr['head_sha'][:7]} ({pr['head_sha']}) · checks "
           f"{pr['checks']} · {pr['mergeable']} · {pr['url']}",
           f"  lead verdicts: {verdicts}"]
    unresolved = W.open_threads(pr)
    resolved = [t for t in pr["threads"] if t["resolved"]]
    if unresolved:
        out.append(f"  Open review threads ({len(unresolved)}):")
        for thread in unresolved:
            first = thread["comments"][0] if thread["comments"] else {"id": "?", "text": ""}
            out.append(f"  - thread {thread['id']} · comment {first['id']} · "
                       f"{thread['path']}:{thread['line'] or 'outdated'}")
            for comment in thread["comments"]:
                out.append(_indent(comment["text"].strip(), "      "))
                out.append("      --")
    if resolved:
        out.append(f"  Resolved threads: {len(resolved)}")
        if role == "lead":
            out += [f"    {t['path']}:{t['line'] or '-'} {_first(t['comments'][0]['text'])}"
                    for t in resolved if t["comments"]]
    return out


def work_block(row, story, prs, role, everything=False, handled=frozenset()):
    out = [f"Work {row['id']} · {row['kind']} · {row['reason']}", ""]
    if story:
        out += story_block(story, with_description=row["kind"] != "inbox" or everything)
        out += comments_block(story, role, everything, handled)
    for pr in prs:
        out += pr_block(pr, role)
    return "\n".join(out)
