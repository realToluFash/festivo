"""What an agent reads. Every view prints one slice, through the ledger, so nothing a role
already has is printed again."""

from . import roles as R
from . import store
from . import text as T
from . import work as W

SQ = "sq"


def header(story):
    labels = ", ".join(story["labels"]) or "no labels"
    return [f"sc-{story['id']} {story['name']}",
            f"  {story['state']} · {labels} · {story['epic'] or 'no epic'} · {story['url']}"]


def notes(p, story):
    rows = store.notes(p.db, p.role, story["id"])
    if rows:
        p.add("", "Your notes from earlier runs:")
        for row in rows:
            p.add(f"  - {row['note']}")


def description(p, story, always=(), only=None, outline_rest=False):
    """Sections in full, or a reference when the role has them. `always` names the sections
    the work needs in full every time; `only` limits what is printed; `outline_rest` lists
    the other headings without their text."""
    rest = []
    for heading, level, body in T.sections(story["description"]):
        wanted = only is None or any(f(heading) for f in only)
        if not wanted:
            rest.append(heading)
            continue
        must = any(f(heading) for f in always)
        p.block(f"story:{story['id']}:section:{heading}", T.digest(body),
                ["", f"{'#' * max(level, 1)} {heading}", body], f"## {heading}", always=must)
    if outline_rest and rest:
        p.add("", f"Other sections: {'; '.join(rest)} "
                  f"(`{SQ} {p.role} story sc-{story['id']} --section <name>`)")


def comment_lines(comment, reply):
    lead = "  ↳ " if reply else ""
    indent = "      " if reply else "    "
    lines = [f"{lead}#{comment['id']} {comment['at'][:16].replace('T', ' ')}"]
    lines += [indent + line if line else "" for line in comment["text"].strip().splitlines()]
    return lines


def thread(p, story, items, open_ids, always_ids=()):
    for index, comment in enumerate(items):
        must = comment["id"] in open_ids or comment["id"] in always_ids
        full = comment_lines(comment, index > 0)
        if comment["id"] in open_ids:
            full[0] += "  ← open for you"
        ref = f"{'  ↳ ' if index else ''}#{comment['id']} {T.first_line(comment['text'], 80)}"
        p.block(f"comment:{comment['id']}", T.digest(comment["text"]), full, ref, always=must)


def comments(p, story, mode="involving", author=None, since=None, always_ids=()):
    """`involving`: threads with a comment to or from the role in full, the rest as one
    line each. `open`: only threads with a comment open for the role. `all`: every thread."""
    handled = store.handled(p.db)
    open_ids = {c["id"] for c in W.open_for(p.role, story, handled)}
    shown, others = 0, []
    for items in W.threads(story):
        if since:
            items = [c for c in items if c["id"] > since] or []
            if not items:
                continue
        if author:
            # `--from qa` means any tester, since all three report.
            authors = R.TESTERS if author == "qa" else (author,)
            if not any(R.author(c["text"]) in authors for c in items):
                continue
        # A tester tests what the lead told any tester to look at.
        peers = R.TESTERS if p.role in R.TESTERS else (p.role,)
        involved = any(W.involves(peer, items, story["labels"]) for peer in peers)
        if mode == "open" and not any(c["id"] in open_ids for c in items):
            continue
        if mode == "involving" and not involved and not author \
                and not any(c["id"] in always_ids for c in items):
            others.append(items)
            continue
        if not shown:
            p.add("", "Comments:")
        shown += 1
        thread(p, story, items, open_ids, always_ids)
    if others:
        p.add("", f"{len(others)} other threads, not involving you "
                  f"(`{SQ} {p.role} comments sc-{story['id']} --all`):")
        for items in others[-6:]:
            tag = R.header(items[0]["text"])
            who = f"(from {tag['from']}) to {' '.join(tag['to']) or '-'}" if tag else ""
            more = f" +{len(items) - 1}" if len(items) > 1 else ""
            p.add(f"  #{items[0]['id']} {who}: {T.first_line(items[0]['text'], 70)}{more}")
    if not shown and mode == "open":
        p.add("", "No comment is open for you on this story.")


def latest_qa_report(story):
    reports = [c for c in story["comments"] if T.is_qa_report(c["text"])]
    return reports[-1] if reports else None


def pr_status(p, pr, compact=False):
    verdict = W.latest_verdict(pr)
    if verdict:
        covers = "at the head" if W.covers(verdict, pr["head_sha"]) else "NOT at the head"
        said = f"{verdict['verdict']} at {(verdict['sha'] or '?')[:7]}, {covers}"
    else:
        said = "no lead review"
    unresolved = W.open_threads(pr)
    p.add("", f"PR #{pr['number']} {pr['title']}",
          f"  {pr['state']} · head {pr['head_sha']} · checks {pr['checks']} · "
          f"{pr['mergeable']} · lead: {said} · open threads {len(unresolved)} · {pr['url']}")
    if pr.get("merge_sha"):
        p.add(f"  merged as {pr['merge_sha']}")
    if compact:
        return
    for t in unresolved:
        first = t["comments"][0] if t["comments"] else None
        if not first:
            continue
        lines = [f"  Thread {t['id']} · reply to {first['id']} · "
                 f"{t['path']}:{t['line'] or 'outdated'}"]
        for c in t["comments"]:
            lines += ["      " + line for line in c["text"].strip().splitlines()] + ["      --"]
        p.block(f"thread:{t['id']}", str(len(t["comments"])), lines,
                f"  Thread {t['id']} {t['path']}:{t['line'] or '-'} "
                f"{T.first_line(first['text'], 70)}")


def lead_threads(p, pr):
    resolved = [t for t in pr["threads"] if t["resolved"] and t["comments"]]
    if resolved:
        p.add(f"  Resolved threads ({len(resolved)}):")
        for t in resolved:
            p.add(f"    {t['path']}:{t['line'] or '-'} {T.first_line(t['comments'][0]['text'], 80)}")


def pr_section(p, pr, name, always=False):
    found = T.find(pr["body"], name)
    if not found:
        p.add("", f"PR #{pr['number']} has no {name} section.")
        return
    heading, _, body = found
    p.block(f"pr:{pr['number']}:section:{heading}", T.digest(body),
            ["", f"PR #{pr['number']} · {heading}", body], f"PR #{pr['number']} · {heading}",
            always=always)


def diff_files(diff):
    """{path: text} from a unified diff."""
    files, current, lines = {}, None, []
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            if current:
                files[current] = "\n".join(lines)
            current = line.split(" b/", 1)[-1]
            lines = [line]
        elif current:
            lines.append(line)
    if current:
        files[current] = "\n".join(lines)
    return files


def diff_stat(files):
    out = []
    for path, body in files.items():
        added = sum(1 for line in body.splitlines()
                    if line.startswith("+") and not line.startswith("+++"))
        removed = sum(1 for line in body.splitlines()
                      if line.startswith("-") and not line.startswith("---"))
        out.append(f"  {path} +{added} -{removed}")
    return out


def queue_lines(stories):
    order = {"Failed QA": 0, "In Progress": 1, "In Review": 2, "Ready For QA": 3, "In QA": 4,
             "To Do": 5, "Backlog": 6}
    out = []
    for story in sorted(stories, key=lambda s: (order.get(s["state"], 9), s["position"] or 0)):
        out.append(f"  sc-{story['id']} [{story['state']}] {story['name']}"
                   f" · {story['epic'] or 'no epic'} · {', '.join(story['labels']) or '-'}")
    return out
