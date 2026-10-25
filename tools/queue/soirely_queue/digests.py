"""What a pick or a sweep starts from: one line per candidate, never whole stories. The role
opens the one it chooses with `sq <role> story sc-<n>`."""

import time

from . import store
from . import roles as R
from . import text as T
from . import views as V
from . import work as W

SQ = V.SQ
RECENT_DAYS = 14


def open_stories(db):
    return [s for s in store.stories(db) if not s["done"]]


def ordered(stories):
    return sorted(stories, key=lambda s: s["position"] or 0)


def line(story, extra=""):
    return (f"  sc-{story['id']} [{story['state']}] {story['name']} · "
            f"{story['epic'] or 'no epic'}{' · ' + extra if extra else ''}")


def recent(at, days=RECENT_DAYS):
    when = T.epoch(at)
    return when is not None and time.time() - when < days * 86400


def section_names(story):
    return [h for h, _, _ in T.sections(story["description"])]


def qa_outstanding(stories):
    """Outstanding items from the latest QA report on each recently tested story."""
    found = []
    for story in stories:
        report = V.latest_qa_report(story)
        if report and recent(report["at"]):
            items = T.outstanding_items(report["text"])
            if items:
                found.append((story, report, items))
    return found


def untaken(db, role, stories):
    """Stories no other role has claimed from the state they are in now."""
    held = {row["key"]: row["role"] for row in db.execute("select key, role from claims")}
    return [s for s in stories
            if held.get(f"{s['id']}:{s['state']}:{s['moved_at']}", role) == role]


def developer(p, db, stories):
    epics = store.get_meta(db, "epics")
    mine = untaken(db, p.role, W.queued(p.role, stories, epics))
    order = {state: i for i, state in enumerate(R.BUILD_QUEUE)}
    # Rework longest-waiting first; the rest epic by epic, as `work.epic_order` ranks them.
    rework = ("Failed Code Review", "Failed QA")
    by_epic = W.epic_order(epics)
    mine.sort(key=lambda s: (order[s["state"]], s["moved_at"] or "" if s["state"] in rework
                             else "", by_epic(s)))
    p.add(f"Your queue ({len(mine)}), in the order the skill picks:")
    p.add(*[line(s, ", ".join(s["labels"]) or "-") for s in mine[:12]])
    if mine:
        top = mine[0]
        todo = [s for s in mine if s["state"] == "Ready For Dev"]
        own = [s for s in todo if R.OWN_LABELS[p.role] & set(s["labels"])]
        # Developer N takes the Nth shared story, so developers reaching Ready For Dev
        # together part; a story labelled for this developer alone comes before them all.
        shared = [s for s in todo if not set(R.DEVELOPERS.values()) & set(s["labels"])]
        nth = R.number(p.role)
        if top["state"] == "Ready For Dev":
            top = own[0] if own else shared[nth - 1] if len(shared) >= nth else top
        verb = "story" if R.OWN_LABELS[p.role] & set(top["labels"]) else "claim"
        p.add("", "Next:", f"  {SQ} {p.role} {verb} sc-{top['id']}")


def tester(p, db, stories):
    ready = sorted(untaken(db, p.role, W.queued(p.role, stories)), key=lambda s: s["updated_at"] or "")
    stuck = [s for s in stories if s["state"] == "In QA" and not s["done"]]
    p.add(f"Ready For QA ({len(ready)}), oldest first:")
    p.add(*[line(s) for s in ready])
    if stuck:
        p.add("", "In QA:")
        for story in stuck:
            claim = R.last_claim(story)
            p.add(line(story, claim["text"] + " at " + claim["at"][11:16] if claim else "no claim"))
    if ready:
        number = R.number(p.role)
        pick = ready[number - 1] if len(ready) >= number else ready[0]
        p.add("", "Next:", f"  {SQ} {p.role} claim sc-{pick['id']}")


def designer(p, db, stories):
    waiting = [s for s in ordered(stories) if s["state"] == "Needs Design"
               and "translation" not in s["labels"]]
    p.add(f"Needs Design ({len(waiting)}): draw each, link it, then move it to Ready For Dev:")
    p.add(*[line(s) for s in waiting])
    candidates = [s for s in ordered(stories) if s["state"] in ("To Do", "Backlog")
                  and "translation" not in s["labels"]
                  and not any(T.is_design(h) for h in section_names(s))]
    p.add("", f"Not yet in Needs Design, with no Design section ({len(candidates)}), first 12:")
    p.add(*[line(s) for s in candidates[:12]])
    changed = []
    for story in ordered(stories):
        if story["state"] not in ("Ready For Dev", "In Progress") \
                or "translation" in story["labels"]:
            continue
        design = T.find(story["description"], "design")
        ac = T.find(story["description"], "ac")
        if design and ac:
            key = f"story:{story['id']}:section:{ac[0]}"
            seen = db.execute("select version from seen where role = ? and key = ?",
                              (p.role, key)).fetchone()
            if seen and seen["version"] != T.digest(ac[2]):
                changed.append(story)
    if changed:
        p.add("", "AC changed since you designed them:", *[line(s) for s in changed])


def product_manager(p, db, stories):
    todo = ordered([s for s in stories if s["state"] == "To Do"
                    and "translation" not in s["labels"]])
    p.add(f"To Do ({len(todo)}), next 10: give each its AC, then move it to Needs Design, "
          "or to Ready For Dev when it needs no new screens:")
    for story in todo[:10]:
        flags = [] if any(T.is_ac(h) for h in section_names(story)) else ["no AC"]
        p.add(line(story, ", ".join(flags)))
    outstanding = qa_outstanding(stories)
    if outstanding:
        p.add("", "Outstanding items from QA reports:")
        for story, report, items in outstanding:
            p.add(f"  sc-{story['id']} #{report['id']}: "
                  + "; ".join(T.first_line(i, 90) for i in items[:3]))
    ideas = [s for s in stories if "idea" in s["labels"] and s["state"] == "Backlog"]
    if ideas:
        p.add("", "Ideas waiting on a decision:", *[line(s) for s in ideas])
    owner = [s for s in ordered(stories) if s["state"] == R.WAITING]
    if owner:
        p.add("", f"{R.WAITING} ({len(owner)}):", *[line(s) for s in owner])
    backlog = sorted([s for s in stories if s["state"] == "Backlog"
                      and not {"translation", "idea"} & set(s["labels"])],
                     key=W.epic_order(store.get_meta(db, "epics")))
    p.add("", f"Backlog ({len(backlog)}), next 10: take it up into To Do, or archive it "
          f"(`{SQ} pm find state:Backlog` for all):")
    for story in backlog[:10]:
        flags = [] if any(T.is_ac(h) for h in section_names(story)) else ["no AC"]
        p.add(line(story, ", ".join(flags)))
    epics = store.get_meta(db, "epics") or {}
    started = [f"{e['name']} ({i})" for i, e in epics.items() if e.get("state") == "in progress"]
    if started:
        p.add("", "Epics in progress: " + "; ".join(started))


def business_manager(p, db, stories):
    decisions = [s for s in ordered(stories) if s["state"] == "Backlog"
                 and ("owner decision" in s["description"].lower() or "decision" in s["labels"])]
    p.add(f"Backlog stories awaiting an owner decision ({len(decisions)}):",
          *[line(s) for s in decisions])
    billing = [s for s in ordered(stories) if s["state"] in ("To Do", "Needs Design",
                                                             "Ready For Dev")
               and any(word in (s["epic"] or "").lower()
                       for word in ("billing", "enterprise", "pricing", "plan"))]
    if billing:
        p.add("", "Coming up in billing epics:", *[line(s) for s in billing])


def creative(p, db, stories):
    ideas = [s for s in stories if "idea" in s["labels"]]
    p.add(f"Your open ideas ({len(ideas)}, at most 3):", *[line(s) for s in ideas])
    friction = qa_outstanding(stories)
    if friction:
        p.add("", "Friction QA reported:")
        for story, report, items in friction[:8]:
            p.add(f"  sc-{story['id']} #{report['id']}: "
                  + "; ".join(T.first_line(i, 90) for i in items[:3]))


def linguist(p, db, stories):
    tickets = ordered([s for s in stories if "translation" in s["labels"]])
    merged = {pr["story_id"] for pr in store.prs(db) if pr["state"] == "merged"}
    p.add(f"Translation tickets ({len(tickets)}):")
    for story in tickets:
        tasks = ", ".join(f"{'✓' if t['done'] else '·'} {t['text']}" for t in story["tasks"])
        waiting = [f"sc-{c}" for c in W.covered(story) if c not in merged]
        extra = tasks or "no tasks yet"
        if waiting:
            extra += f" · waits on {', '.join(waiting)}"
        p.add(line(story, extra))


def ops(p, db, stories):
    p.add("main, newest first:")
    for run in store.get_meta(db, "main_runs") or []:
        p.add(f"  {run['headSha'][:7]} {run['workflowName']} {run['conclusion'] or run['status']}"
              f" · {run['displayTitle']}")
    drafts = [pr for pr in store.prs(db) if pr["draft"]]
    if drafts:
        p.add("", "Draft PRs:", *[f"  #{pr['number']} {pr['title']}" for pr in drafts])


DIGESTS = {"pm": product_manager, "ux": designer, "bm": business_manager, "cd": creative,
           "ops": ops, **{d: developer for d in R.DEVS}, **{t: tester for t in R.TESTERS},
           **{lang: linguist for lang in R.LINGUISTS}}


def render(p, db, row=None):
    stories = open_stories(db)
    DIGESTS.get(p.role, lambda *_: p.add("Nothing to sweep for this role."))(p, db, stories)
    if row and row["kind"] == "pick" and p.role in R.LINGUISTS:
        p.add("", "This is a pick, not a sweep: take the first ticket above that waits on "
                  "nothing and do it (your skill's section 4), or hand one whose work is done "
                  "to QA (section 5). One ticket this run; file nothing new.")
    if row:
        p.add("", f"Finish with `{SQ} {p.role} done {row['id']} --note \"<one line>\"`.")
