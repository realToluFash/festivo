"""`sq <role> <command>`: the one place the roles read their work from and write to.

Every read prints a slice and goes through the ledger, so a role is never shown twice what
it already has. Every write is checked against what the role may do before it is sent."""

import argparse
import datetime
import os
import pathlib
import shutil
import subprocess
import sys
import time

from . import (actions, agents, dashboard, digests, github, launchd, machine, payloads,
               permissions, roles, runlog, runner, shared, store, sync, systemd, update, work)
from . import text as T
from . import views as V
from .ledger import Printer
from .shortcut import Shortcut

HERE = pathlib.Path(__file__).resolve().parent
CHECKS_POLL = 30
NO_CHECKS_POLLS = 4
OWNER_ONLY = ("run", "start", "stop", "pause", "resume", "agents", "web")
ADMIN = ("status", "sync", "install", "run", "worker", "worker-ended", "worker-supervise",
         "start", "stop", "pause",
         "resume", "cost", "agents", "web")


def home():
    if os.environ.get("SQ_HOME"):
        return pathlib.Path(os.environ["SQ_HOME"])
    if HERE.parent.parent.name == "soirely-roles":
        return HERE.parent.parent
    common = subprocess.run(["git", "rev-parse", "--git-common-dir"], capture_output=True,
                            text=True, check=True).stdout.strip()
    path = pathlib.Path(common).resolve() / "soirely-roles"
    path.mkdir(parents=True, exist_ok=True)
    return path


def open_db():
    return store.connect(str(home() / "queue.db"))


def refresh_work(db, now):
    # A role's own pick or sweep does not make it busy, or the next refresh would retire it.
    busy = {row["roles"] for row in db.execute(
        "select roles from work where status in ('open', 'claimed') "
        "and kind not in ('pick', 'sweep')")}
    busy_roles = {role for roles_ in busy for role in roles_.split(",")}
    last_runs = {row["role"]: row["last_done"] for row in db.execute("select * from runs")}
    last_sweeps = {row["pool"]: row["at"] for row in db.execute(
        "select pool, max(done_at) as at from work where kind = 'sweep' and status = 'done' "
        "group by pool")}
    items = work.derive(store.stories(db), store.prs(db), store.get_meta(db, "main_run"),
                        last_runs, busy_roles, now, store.handled(db), store.moves(db),
                        store.get_meta(db, "machine_checks"), store.get_meta(db, "epics"),
                        store.worked_on(db, "l10n"),
                        [row for row in store.waiting(db, "l10n") if row["kind"] == "unblocked"],
                        last_sweeps)
    store.record(db, items, now)
    return items


def baseline(db):
    """Counts every tagged comment already on a story as dealt with, so the first tick
    starts from what arrives next rather than from years of answered threads."""
    for item in work.inbox_items(store.stories(db)):
        store.mark_handled(db, item["roles"][0], item["comments"])
    for role in roles.ROLES:
        store.mark_run(db, role)
    refresh_work(db, time.time())
    db.execute("update work set status = 'done', note = 'already waiting at install' "
               "where status = 'open' and kind in ('story', 'unblocked')")
    store.set_meta(db, "baselined_at", time.time())


def brief(row, role):
    sq = f"sq {role}"
    scope = [f"This is {row['pool']}: work only on this machine (disk, Docker, the role "
             "stacks, the manager). Shared duties belong to whichever machine holds the ops "
             "lease."] if row["kind"] == "machine" else []
    draw = [f"This run has no Artifact tool, so it cannot draw: for a story that needs "
            f"screens, list it with `{sq} to-draw` and do everything else it needs."] \
        if role == "ux" else []
    return "\n".join(scope + draw + [
        f"Run `{roles.invoke(role)}` as an unattended routine run "
        "(.claude/skills/role-routine, section 3).",
        f"Your work is item {row['id']}: {row['reason']}.",
        f"Start with `{sq} next`. It prints what this work needs and the commands to act with. "
        f"Read and write only through `{sq}` (`{sq} help`), never the Shortcut tools or gh. "
        "Nobody is watching: never wait for an answer.",
        f"As your last step run `{sq} done {row['id']} --note \"<one line>\"`, "
        "even when you could not finish; the note says why.",
        "Then report in at most ten lines.",
    ])


class Session:
    """One command's database, ledger and caches."""

    def __init__(self, role, again=False):
        self.role = role
        self.db = open_db()
        self.cache = home() / "cache"
        self.printer = Printer(self.db, role, again)

    def story(self, ref):
        story_id = actions.story_number(ref)
        found = store.story(self.db, story_id)
        if not found:
            found = sync.refresh_story(self.db, Shortcut(), story_id)
        return found

    def done(self):
        self.printer.save()
        out = self.printer.text()
        if out:
            print(out)


def synced(db, now):
    errors = sync.sync(db, now)
    if errors and not store.get_meta(db, "synced_ok_at"):
        sys.exit(f"error: {'; '.join(errors)}")
    refresh_work(db, now)


# Work


def this_worker():
    """The worker this command runs in, so it touches only that worker's item; a run by hand
    is any of the role's."""
    return os.environ.get("SOIRELY_WORKER")


def cmd_tick(s, a):
    now = time.time()
    synced(s.db, now)
    if this_worker():
        return own_item(s, now, lambda row: print("busy"))
    if store.held_by(s.db, s.role, now):
        return print("busy")
    row = store.claim(s.db, s.role, now)
    if not row:
        return print("idle")
    print(f"wake: {row['reason']}\n---\n{brief(row, s.role)}")


def cmd_next(s, a):
    now = time.time()
    synced(s.db, now)
    if this_worker():
        return own_item(s, now, lambda row: render(s, row))
    row = store.held_by(s.db, s.role, now) or store.claim(s.db, s.role, now)
    if not row:
        return print("idle")
    render(s, row)


def own_item(s, now, show):
    """Inside a worker, the item the runner launched it on; it never claims another, since
    the runner would not know the claim was its worker's and would wait out the lease."""
    row = store.held_by(s.db, s.role, now, this_worker())
    if not row:
        return print(f"{this_worker()}'s item is finished: end this run")
    show(row)


def render(s, row):
    s.printer.run = f"work:{row['id']}"
    payloads.render(s.printer, s.db, row, s.cache)
    s.done()


def cmd_done(s, a):
    row = store.item(s.db, int(a.id)) if a.id else \
        store.held_by(s.db, s.role, worker=this_worker())
    if row:
        store.finish(s.db, row["id"], a.note)
    else:
        store.mark_run(s.db, s.role)
    print("done")


def cmd_release(s, a):
    row = store.held_by(s.db, s.role, worker=this_worker())
    if row:
        store.release(s.db, row["id"])
    print("released")


def cmd_queue(s, a):
    digests.render(s.printer, s.db)
    s.done()


def cmd_drawings(s, a):
    found = store.drawings(s.db)
    if not found:
        print("nothing to draw")
    busy = (store.get_meta(s.db, "drawing") or {}).get("story_id")
    for drawing in found:
        now = "  (sq is drawing it now: leave it)" if drawing["story_id"] == busy else ""
        print(f"sc-{drawing['story_id']}  {drawing['name']}{now}")
        print("\n".join("    " + line for line in drawing["prompt"].splitlines()))


# Reads


def cmd_story(s, a):
    story = s.story(a.story)
    p = s.printer
    if a.headings:
        p.add(*V.header(story), "", "Sections: " + "; ".join(
            h for h, _, _ in T.sections(story["description"])))
        return s.done()
    if a.section:
        found = T.find(story["description"], a.section)
        if not found:
            sys.exit(f"sc-{story['id']} has no section {a.section!r}; "
                     f"`sq {s.role} story sc-{story['id']} --headings` lists them")
        heading, level, body = found
        p.block(f"story:{story['id']}:section:{heading}", T.digest(body),
                [f"sc-{story['id']} · {heading}", body], f"sc-{story['id']} · {heading}")
        return s.done()
    payloads.story_for(p, s.db, story, s.role)
    s.done()


def cmd_comments(s, a):
    story = s.story(a.story)
    s.printer.add(*V.header(story))
    mode = "all" if a.all else "open" if a.open else "involving"
    V.comments(s.printer, story, mode=mode, author=getattr(a, "from"), since=a.since)
    s.done()


def cmd_pr(s, a):
    pr = store.pr(s.db, a.pr)
    if not pr:
        sys.exit(f"PR #{a.pr} is neither open nor recently merged")
    if a.section:
        V.pr_section(s.printer, pr, a.section)
    else:
        V.pr_status(s.printer, pr)
        found = [h for h, _, _ in T.sections(pr["body"])]
        s.printer.add("", f"Body sections: {'; '.join(found)} (`--section <name>`)")
    s.done()


def cmd_diff(s, a):
    pr = store.pr(s.db, a.pr)
    if not pr:
        sys.exit(f"PR #{a.pr} is neither open nor recently merged")
    files = V.diff_files(payloads.cached_diff(s.cache, pr))
    p = s.printer
    if not a.paths and not a.all:
        p.add(f"PR #{a.pr} at {pr['head_sha'][:7]}, {len(files)} files:", *V.diff_stat(files))
        return s.done()
    wanted = files if a.all else {path: body for path, body in files.items()
                                  if any(path == x or x in path for x in a.paths)}
    if not wanted:
        sys.exit("no file in the diff matches; `sq <role> diff <n>` lists them")
    for path, body in wanted.items():
        p.block(f"diff:{a.pr}:{path}", T.digest(body), [body, ""], path)
    s.done()


def cmd_checks(s, a):
    head, found = read_checks(a.pr, a.head)
    empty = 0
    if a.wait:
        deadline = time.monotonic() + a.timeout * 60
        while head is None or not found or any(c.get("bucket") == "pending" for c in found):
            # Straight after a push the head has no checks yet; a conflicting head never will.
            empty = empty + 1 if head is not None and not found else 0
            if empty > NO_CHECKS_POLLS:
                break
            if time.monotonic() >= deadline:
                waiting = (f"for the head to reach {a.head[:7]}" if head is None else
                           "with no checks on the head" if not found else
                           "with checks still pending")
                print(f"PR #{a.pr}: timed out after {a.timeout} minutes {waiting}")
                break
            time.sleep(CHECKS_POLL)
            head, found = read_checks(a.pr, a.head)
    if head is None:
        sys.exit(f"PR #{a.pr}: the head is not {a.head[:7]} yet")
    if not found:
        sha = head["headRefOid"][:7]
        if head["mergeable"] == "CONFLICTING":
            print(f"PR #{a.pr}: no checks on head {sha}, which conflicts with main; "
                  "a conflicting head runs none, so merge origin/main and push")
        elif a.wait:
            print(f"PR #{a.pr}: no checks appeared on head {sha} after "
                  f"{NO_CHECKS_POLLS * CHECKS_POLL // 60} minutes")
        else:
            print(f"PR #{a.pr}: no checks on head {sha} yet")
        sys.exit(1 if a.wait else 0)
    failed = [c for c in found if c.get("bucket") == "fail"]
    cancelled = [c for c in found if c.get("bucket") == "cancel"]
    pending = [c for c in found if c.get("bucket") == "pending"]
    summary = f"PR #{a.pr} at {head['headRefOid'][:7]}: {len(found)} checks, {len(failed)} failed"
    print(summary + "".join(f", {len(group)} {word}" for group, word in
                            ((cancelled, "cancelled"), (pending, "pending")) if group))
    for check in failed:
        print(f"\n{check['workflow']} / {check['name']} {check['link']}")
        if not a.names:
            log = github.failed_log(check["link"], tail=a.tail)
            print("\n".join("  " + line for line in log.splitlines()))
    for check in cancelled:
        print(f"  cancelled: {check['workflow']} / {check['name']} {check['link']}")
    for check in pending:
        print(f"  pending: {check['workflow']} / {check['name']}")
    if a.wait and any(c.get("bucket") not in ("pass", "skipping") for c in found):
        sys.exit(1)


def read_checks(number, want=None):
    """The live head and its checks, or no head while the pull request has not reached `want`."""
    head = github.live(number)
    if want and not head["headRefOid"].startswith(want):
        return None, []
    return head, github.pr_checks(number)


def cmd_runs(s, a):
    for run in store.get_meta(s.db, "main_runs") or []:
        print(f"{run['databaseId']} {run['headSha'][:7]} {run['workflowName']} "
              f"{run['conclusion'] or run['status']} · {run['displayTitle']}")


def cmd_find(s, a):
    hits = Shortcut().search(a.query, pages=2)
    for hit in hits[: a.limit]:
        stored = store.story(s.db, hit["id"])
        state = stored["state"] if stored else "-"
        print(f"sc-{hit['id']} [{state}] {hit['name']}")
    if len(hits) > a.limit:
        print(f"… {len(hits) - a.limit} more (--limit)")


def cmd_epics(s, a):
    for epic_id, epic in sorted((store.get_meta(s.db, "epics") or {}).items(),
                                key=lambda e: int(e[0])):
        if a.all or epic.get("state") != "done":
            print(f"{epic_id} [{epic.get('state')}] {epic['name']}")


def cmd_epic(s, a):
    epic = Shortcut().epic(a.epic)
    p = s.printer
    p.add(f"Epic {epic['id']} {epic['name']} [{epic.get('state')}] {epic.get('app_url')}")
    for heading, level, body in T.sections(epic.get("description")):
        p.block(f"epic:{epic['id']}:section:{heading}", T.digest(body),
                ["", f"## {heading}", body], f"## {heading}")
    stories = [x for x in store.stories(s.db) if x["epic_id"] == epic["id"] and not x["done"]]
    if stories:
        p.add("", "Open stories:", *V.queue_lines(stories))
    s.done()


def cmd_states(s, a):
    shortcut = Shortcut()
    folder = pathlib.Path(a.body) if a.body else None
    if folder:
        folder.mkdir(parents=True, exist_ok=True)
    for ref in a.stories:
        try:
            story = sync.refresh_story(s.db, shortcut, actions.story_number(ref))
        except actions.Refused as refusal:
            print(f"{ref}: {refusal}")
            continue
        except RuntimeError as error:
            print(f"{ref}: not found ({error})" if " 404 " in str(error) else f"{ref}: {error}")
            continue
        print(f"sc-{story['id']} [{story['state']}] {story['epic'] or 'no epic'} · "
              f"{story['name']}")
        if folder:
            (folder / f"sc-{story['id']}.md").write_text(story["description"])


def cmd_history(s, a):
    story_id = actions.story_number(a.story)
    states = store.get_meta(s.db, "states") or {}
    for entry in Shortcut().history(story_id)[-a.limit:]:
        moves = []
        for action in entry.get("actions", []):
            change = (action.get("changes") or {}).get("workflow_state_id")
            if change:
                moves.append(f"{states.get(str(change.get('old')), '?')} → "
                             f"{states.get(str(change.get('new')), '?')}")
        if moves:
            print(f"{entry['changed_at'][:16].replace('T', ' ')} {'; '.join(moves)}")


# Writes


TAKES_BODY = {actions.comment, actions.note, actions.to_draw, actions.report, actions.edit, actions.new_story,
              actions.new_epic, actions.review, actions.pr_reply, actions.pr_create,
              actions.pr_close, actions.pr_edit, actions.unclaim}


def write(fn):
    def run(s, a):
        if fn in TAKES_BODY and a.text is None and getattr(a, "replace", None) is None:
            a.text = sys.stdin.read()
            if not a.text.strip():
                sys.exit("nothing to send: pass --text or pipe the body in")
        out = fn(actions.Context(s.db, s.role, s.cache), a)
        if fn is actions.claim:
            story = store.story(s.db, actions.story_number(a.story))
            s.printer.add(f"Claimed sc-{story['id']}; it is {story['state']}.", "")
            payloads.story_for(s.printer, s.db, story, s.role)
            return s.done()
        print(out)
    return run


def body(parser):
    parser.add_argument("--text", help="the body; otherwise read from stdin")


READS = [
    ("next", cmd_next, "claim your next work and print what it needs", None),
    ("tick", cmd_tick, "the routine's check: idle, busy, or wake with a brief", None),
    ("done", cmd_done, "finish the work you hold, with a note for your next run",
     lambda p: (p.add_argument("id", nargs="?"), p.add_argument("--note"))),
    ("release", cmd_release, "give back the work you hold, unfinished", None),
    ("queue", cmd_queue, "your queue or sweep list, one line per story", None),
    ("drawings", cmd_drawings, "the stories listed to draw, oldest first, each with its "
     "prompt", None),
    ("story", cmd_story, "a story as you work on it; --section or --headings for a slice",
     lambda p: (p.add_argument("story"), p.add_argument("--section"),
                p.add_argument("--headings", action="store_true"))),
    ("comments", cmd_comments, "a story's threads that involve you; --open, --all, --from",
     lambda p: (p.add_argument("story"), p.add_argument("--open", action="store_true"),
                p.add_argument("--all", action="store_true"), p.add_argument("--from"),
                p.add_argument("--since", type=int, help="only comments after this id"))),
    ("pr", cmd_pr, "a pull request's status and open threads, or one body --section",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("--section"))),
    ("diff", cmd_diff, "a pull request's files, or the diff of the paths you name",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("paths", nargs="*"),
                p.add_argument("--all", action="store_true"))),
    ("checks", cmd_checks, "a pull request's checks and failed logs; --wait for them",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("--names", action="store_true"),
                p.add_argument("--tail", type=int, default=40),
                p.add_argument("--wait", action="store_true",
                               help="return once no check is pending; exit 1 unless all passed"),
                p.add_argument("--head", help="with --wait, first wait for the head to be this sha"),
                p.add_argument("--timeout", type=int, default=20,
                               help="minutes --wait gives up after, exiting 1"))),
    ("runs", cmd_runs, "the last runs on main", None),
    ("find", cmd_find, "Shortcut search, one line per story",
     lambda p: (p.add_argument("query"), p.add_argument("--limit", type=int, default=20))),
    ("epics", cmd_epics, "epics, one line each",
     lambda p: p.add_argument("--all", action="store_true")),
    ("epic", cmd_epic, "an epic's description and open stories",
     lambda p: p.add_argument("epic", type=int)),
    ("states", cmd_states, "many stories, one line each: state, epic, name; --body DIR "
     "saves each description",
     lambda p: (p.add_argument("stories", nargs="+"), p.add_argument("--body", metavar="DIR"))),
    ("history", cmd_history, "a story's state changes",
     lambda p: (p.add_argument("story"), p.add_argument("--limit", type=int, default=30))),
]

DETAILS = {
    "move": "Move a story to a state your role moves it to, from the states it moves it "
            "from. The product manager moves any story from any state to any other.",
    "edit": "Replace one section (--section), add a dated one (--dated), or change one "
            "exact piece of text with --replace OLD --with NEW. --replace takes several "
            "targets, refuses unless OLD appears exactly once in every one of them, and then "
            "changes all or none; --dry says which would change.",
    "relate": "Link two stories. A link that already exists answers \"already linked\". "
              "--remove deletes the link as it was made, subject and object in order; a "
              "relates to link is removed from either end. With no such link it changes "
              "nothing and answers \"not linked\", naming the link the other way round if "
              "that is the one there.",
    "permission-ask": "Ask for a command your permission rules refused. It posts on sc-4992 "
                      "in the owner's format, and refuses a rule already asked, with the "
                      "answer if there is one. Never wait for the answer: only the owner "
                      "grants, by merging tools/queue/permissions.json and applying it.",
    "to-draw": "List a story whose screens this run cannot draw. The body is the prompt the "
               "owner pastes into a /soirely-designer session, so it stands on its own: the "
               "epic's artifact URL, the screens and layouts to draw, the states each needs, "
               "and the decisions already made. Listing the story again replaces its prompt.",
    "drawn": "Take a story off the list to draw, once its artboard is linked on the story.",
    "comment": "Post a tagged comment. --to takes roles, dev, and the language tags en, es, "
               "fr and pt, which reach the linguist.",
}

WRITES = [
    ("comment", actions.comment, "post a tagged comment; --reply-to answers one",
     lambda p: (p.add_argument("story"), p.add_argument("--to"),
                p.add_argument("--reply-to", type=int),
                p.add_argument("--files", nargs="+", help="uploaded to the story first"),
                p.add_argument("--untagged", action="store_true",
                               help="no addressee: a record, or with --reply-to a reply "
                                    "that only confirms; wakes nobody"), body(p))),
    ("note", actions.note, "a private note your next run on this story sees",
     lambda p: (p.add_argument("story"), body(p))),
    ("permission-ask", actions.permission_ask, "ask the owner for a command you were refused, "
     "on sc-4992",
     lambda p: (p.add_argument("--rule", required=True, help="e.g. Bash(xcrun simctl boot:*)"),
                p.add_argument("--for", dest="for_", required=True,
                               help="what it is for, and the command you were refused"),
                p.add_argument("--without", required=True,
                               help="what cannot happen without it"))),
    ("claim", actions.claim, "take a story from your queue, then print it",
     lambda p: p.add_argument("story")),
    ("move", actions.move, "move a story to a state you may move it to",
     lambda p: (p.add_argument("story"), p.add_argument("state"))),
    ("label", actions.label, "add or remove labels; the rest are kept",
     lambda p: (p.add_argument("story"), p.add_argument("--add", nargs="+"),
                p.add_argument("--remove", nargs="+"))),
    ("report", actions.report, "QA report: upload files, comment, move to the result",
     lambda p: (p.add_argument("story"), p.add_argument("result", choices=["passed", "failed"]),
                p.add_argument("--files", nargs="+"), body(p))),
    ("unclaim", actions.unclaim, "give back to Ready For QA a story you hold but cannot test",
     lambda p: (p.add_argument("story"), body(p))),
    ("edit", actions.edit, "replace a section, add a dated one, or --replace one line, "
     "on sc-<n> or epic-<n>",
     lambda p: (p.add_argument("targets", nargs="+", metavar="target"),
                p.add_argument("--section"), p.add_argument("--dated"),
                p.add_argument("--replace", metavar="OLD",
                               help="text found exactly once in each target"),
                p.add_argument("--with", dest="with_", metavar="NEW"),
                p.add_argument("--dry", action="store_true",
                               help="say which targets would change, change none"),
                body(p))),
    ("new-story", actions.new_story, "create a story, in Backlog unless you are the PM",
     lambda p: (p.add_argument("--name", required=True),
                p.add_argument("--epic", type=int, required=True,
                               help="the epic it belongs to: sq <role> epics; none suits, "
                                    "new-epic"),
                p.add_argument("--state"), p.add_argument("--label", nargs="+"),
                p.add_argument("--type", choices=["feature", "bug", "chore"]),
                p.add_argument("--estimate", type=int, choices=[0, 1, 2, 4, 8]), body(p))),
    ("new-epic", actions.new_epic, "create an epic",
     lambda p: (p.add_argument("--name", required=True), body(p))),
    ("task", actions.task, "add a task, or mark one --done / --undo",
     lambda p: (p.add_argument("story"), p.add_argument("--add"),
                p.add_argument("--done", type=int), p.add_argument("--undo", type=int))),
    ("relate", actions.relate, "link two stories",
     lambda p: (p.add_argument("story"), p.add_argument("other"),
                p.add_argument("--verb", default="relates to",
                               choices=["relates to", "blocks", "duplicates"]),
                p.add_argument("--remove", action="store_true",
                               help="delete the link instead of adding it"))),
    ("archive", actions.archive, "archive a story", lambda p: p.add_argument("story")),
    ("to-draw", actions.to_draw, "list a story you cannot draw here, with the prompt that "
     "draws it", lambda p: (p.add_argument("story"), body(p))),
    ("drawn", actions.drawn, "take a story off the list to draw once its screens exist",
     lambda p: p.add_argument("story")),
    ("pr-create", actions.pr_create, "open a pull request from a pushed branch",
     lambda p: (p.add_argument("--head", required=True), p.add_argument("--title", required=True),
                p.add_argument("--draft", action="store_true"), body(p))),
    ("review", actions.review, "post the review: summary on stdin, inline --findings file",
     lambda p: (p.add_argument("pr", type=int),
                p.add_argument("--pass", dest="verdict", action="store_const", const="pass"),
                p.add_argument("--back", dest="verdict", action="store_const", const="back"),
                p.add_argument("--findings", help="`## path:line blocking|should|nit` blocks"),
                p.add_argument("--qa", help="on a pass, what QA should look at hard"),
                body(p))),
    ("pr-reply", actions.pr_reply, "reply in the review thread holding a comment",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("comment", type=int), body(p))),
    ("resolve", actions.resolve, "reply in a thread (optional --text), then resolve it",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("comment", type=int),
                p.add_argument("--text"))),
    ("merge", actions.merge, "merge a pull request once every condition holds",
     lambda p: (p.add_argument("pr", type=int),
                p.add_argument("--text", help="anything QA should know"))),
    ("pr-close", actions.pr_close, "close a pull request unmerged, saying why on it",
     lambda p: (p.add_argument("pr", type=int), body(p))),
    ("pr-edit", actions.pr_edit, "replace one section of a pull request's body",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("--section", required=True),
                body(p))),
    ("to-qa", actions.to_qa, "hand a merged story to QA, naming the merge commit",
     lambda p: (p.add_argument("story"), p.add_argument("--text"))),
    ("rerun", actions.rerun, "rerun a pull request's failed jobs, or a --run",
     lambda p: (p.add_argument("pr", type=int, nargs="?"), p.add_argument("--run", type=int))),
]


def role_parser(role):
    p = argparse.ArgumentParser(prog=f"sq {role}", add_help=False,
                                description=f"What {role} reads and writes. Reads print "
                                "each thing once; --again prints it in full anyway.")
    p.add_argument("--again", action="store_true", help=argparse.SUPPRESS)
    sub = p.add_subparsers(dest="command", metavar="<command>")
    sub.add_parser("help", help="this list, or one command's: help <command>").add_argument(
        "topic", nargs="?")

    def add(name, fn, help_, args):
        s = sub.add_parser(name, help=help_, description=DETAILS.get(name, help_))
        s.add_argument("--again", action="store_true", help="print in full what you have read")
        s.set_defaults(fn=fn)
        if args:
            args(s)

    for name, fn, help_, args in READS:
        add(name, fn, help_, args)
    for name, fn, help_, args in WRITES:
        if roles.may(role, name):
            add(name, write(fn), help_, args)
    p.commands = sub.choices
    return p


def ago(seconds):
    seconds = max(int(seconds), 0)
    for size, unit in ((365 * 86400, "y"), (86400, "d"), (3600, "h"), (60, "m")):
        if seconds >= size:
            return f"{seconds // size}{unit} ago"
    return f"{seconds}s ago"


def clip(line, width):
    return line if len(line) <= width else line[:width - 1] + "…"


def status(db, platform, now):
    width = max(shutil.get_terminal_size((120, 20)).columns, 60)
    view = dashboard.snapshot(db, platform, now, home())

    def say(line=""):
        print(clip(line, width))

    synced = f"synced {ago(view['synced_ago'])}" if view["synced_ago"] is not None \
        else "never synced"
    if view["machine"]:
        say(" · ".join([view["machine"],
                        f"manager {'running' if view['manager'] else 'stopped'}"]
                       + ([f"paused since {view['paused']}"] if view["paused"] else [])
                       + [f"{view['free_gb']} GB free", synced]))
    else:
        say(synced)
    for error in view["errors"]:
        say(f"error: {error}")
    for warning in view["warnings"]:
        say(f"warning: {warning}")
    if view["machines"]:
        say()
        say("other machines")
        name_width = max(len(m["name"]) for m in view["machines"])
        for other in view["machines"]:
            say(f"  {other['name']:{name_width}}  seen {ago(other['seen']):8}  "
                f"{', '.join(other['started']) or 'no role'}")
    rows = []
    for role in view["roles"]:
        if role["state"] == "refused":
            rows.append((role["role"], f"refused: {role['detail']}", "", "", "", "", []))
            continue
        state = {"busy": f"busy, item {(role['held'] or {}).get('id')}",
                 "running": f"running {role.get('running')} of {role.get('workers')}"
                 if (role.get("workers") or 1) > 1 else "running",
                 "elsewhere": "on {machine}, seen {ago}".format(
                     machine=(role["detail"] or {}).get("machine"),
                     ago=ago((role["detail"] or {}).get("seen", 0)))}.get(role["state"],
                                                                          role["state"])
        model = f"{role['model'].removeprefix('claude-')} {role['effort']}"
        last = role["last"]
        ran = f"{time.strftime('%d %b %H:%M', time.localtime(last['at']))} " \
              f"${last['cost']:.2f}" if last else "never"
        details = [f"last: {last['report'] or '-'}"] if last else []
        if role["held"]:
            details.append(f"now:  {role['held']['reason']}")
        if role["next"]:
            details.append(f"next: {role['next'][0]['reason']}")
        if role["note"]:
            details.append(f"note: {role['note']}")
        if role["owner"]:
            details.append(f"waiting on the owner: {role['owner']}")
        rows.append((role["role"], state, model, role["account"] or "not logged in", ran,
                     str(role["waiting"]), details))
    if rows:
        heads = ("role", "state", "model", "account", "last run", "waiting")
        sizes = [max([len(heads[i])] + [len(row[i]) for row in rows if row[2] or i < 2])
                 for i in range(6)]
        sizes[1] = min(sizes[1], 28)
        say()
        say("roles here")
        say("  " + "  ".join(f"{h:{n}}" if i < 5 else f"{h:>{n}}"
                             for i, (h, n) in enumerate(zip(heads, sizes))))
        for role, state, model, account, ran, count, details in rows:
            if not model:
                say(f"  {role:{sizes[0]}}  {state}")
                continue
            say("  " + "  ".join([f"{role:{sizes[0]}}", f"{clip(state, sizes[1]):{sizes[1]}}",
                                  f"{model:{sizes[2]}}", f"{account:{sizes[3]}}",
                                  f"{ran:{sizes[4]}}", f"{count:>{sizes[5]}}"]))
            for detail in details:
                say(f"  {'':{sizes[0]}}  {detail}")
    if view["drawings"]:
        say()
        say("to draw, prompts on sq web")
        for drawing in view["drawings"]:
            say(f"  sc-{drawing['story_id']}  {drawing['name']}")
    if view["elsewhere"]:
        say()
        say("roles not run here")
        count_width = max(len(str(r["waiting"])) for r in view["elsewhere"])
        for role in view["elsewhere"]:
            what = f"working on {role['held']['reason']}" if role["held"] else \
                f"next: {role['next'][0]['reason']}"
            say(f"  {role['role']:5} {role['waiting']:>{count_width}} waiting  {what}")


def cost(days):
    today = datetime.date.today()
    total = 0
    for back in range(days):
        on = today - datetime.timedelta(days=back)
        spent = {r: v for r, v in runlog.spent(home(), roles.ROLES, on).items() if v}
        total += sum(spent.values())
        print(f"{on.isoformat()}: ${sum(spent.values()):.2f}"
              + ("  " + ", ".join(f"{r} ${v:.2f}" for r, v in
                                  sorted(spent.items(), key=lambda x: -x[1])) if spent else ""))
    if days > 1:
        print(f"total: ${total:.2f}")


def this_platform():
    return launchd.Mac(home()) if sys.platform == "darwin" else systemd.platform()


def admin(argv):
    p = argparse.ArgumentParser(prog="sq", description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="what every role holds and has waiting, and this machine's "
                                  "manager")
    web = sub.add_parser("web", help="the same as status, as a live page on this machine")
    web.add_argument("--port", type=int, default=8765)
    web.add_argument("--no-open", action="store_true", help="print the address, open nothing")
    sub.add_parser("sync", help="sync now").add_argument("--full", action="store_true")
    sub.add_parser("install", help="copy sq where no branch switch removes it")
    sub.add_parser("run", help="the timer's minute: sync, then tick each started role") \
        .add_argument("--dry-run", action="store_true", help="say what would wake, start nothing")
    for name in ("worker", "worker-ended", "worker-supervise"):
        worker = sub.add_parser(name, help=argparse.SUPPRESS)
        worker.add_argument("role")
        worker.add_argument("item", type=int)
        if name == "worker-supervise":
            worker.add_argument("--minutes", type=int, required=True)
            worker.add_argument("--memory")
    for name, help_ in (("start", "start roles on this machine"),
                        ("stop", "stop roles on this machine")):
        sp = sub.add_parser(name, help=help_)
        sp.add_argument("roles", nargs="*")
        sp.add_argument("--all", action="store_true")
    for name, help_ in (("pause", "no role ticks until sq resume"), ("resume", "end a pause")):
        sub.add_parser(name, help=help_).add_argument(
            "--everywhere", action="store_true", help="every machine, through GitHub")
    sub.add_parser("cost", help="what the workers cost, per day and role") \
        .add_argument("--days", type=int, default=1)
    ag = sub.add_parser("agents", help="setup, up, down or permissions: the whole machine")
    ag.add_argument("action", choices=["setup", "up", "down", "permissions"])
    ag.add_argument("step", nargs="?", choices=["apply"],
                    help="permissions: apply what main grants, at your own keyboard")
    ag.add_argument("--now", action="store_true", help="down: stop running workers at once")
    ag.add_argument("--workspace", help="setup: the workspace, without asking")
    a = p.parse_args(argv)
    # A guard against a worker that reads "stop the routine" in a thread, not a boundary.
    if a.command in OWNER_ONLY and os.environ.get("SOIRELY_WORKER"):
        print(f"error: sq {a.command} is the owner's, and this is "
              f"{os.environ['SOIRELY_WORKER']}'s worker; say what you need in your report")
        return sys.exit(1)
    machine.load_env()
    db = open_db()
    platform = this_platform()
    sq_path = home() / "sq" / "sq"
    if a.command == "status":
        status(db, platform, time.time())
    elif a.command == "web":
        dashboard.serve(lambda now: dashboard.snapshot(db, platform, now, home()), a.port,
                        open_page=not a.no_open)
    elif a.command == "run":
        try:
            runner.run(db, home(), platform, sq_path, sys.executable, dry_run=a.dry_run)
        finally:
            platform.after_run()
    elif a.command == "worker":
        runner.worker(db, home(), platform, a.role, a.item)
    elif a.command == "worker-ended":
        runner.worker_ended(home(), platform, a.role, a.item)
    elif a.command == "worker-supervise":
        result, exit_status = launchd.supervise(
            [sys.executable, str(sq_path), "worker", a.role, str(a.item)], a.minutes * 60,
            launchd.size_bytes(a.memory))
        os.environ.update(SERVICE_RESULT=result, EXIT_STATUS=str(exit_status))
        runner.worker_ended(home(), platform, a.role, a.item)
        pidfile = platform.pidfile(a.role)
        if pidfile.exists() and pidfile.read_text().strip() == str(os.getpid()):
            pidfile.unlink()
    elif a.command in ("start", "stop"):
        names = list(machine.load().get("roles") or {}) if a.all else a.roles
        if a.command == "start":
            return sys.exit(agents.start(db, home(), platform, names))
        return sys.exit(agents.stop(db, names))
    elif a.command == "pause" and a.everywhere:
        name = machine.load().get("machine") or "machine"
        done = shared.pause_everywhere(shared.GitHubRefs(), name)
        print("paused every machine: no role ticks anywhere, running workers finish their "
              "item" if done else "every machine was already paused")
    elif a.command == "resume" and a.everywhere:
        shared.resume_everywhere(shared.GitHubRefs())
        print("resumed every machine; a machine paused on its own stays paused")
    elif a.command == "pause":
        store.set_meta(db, "paused", time.strftime("%d %b %H:%M"))
        print("paused: no role ticks, running workers finish their item")
    elif a.command == "resume":
        store.set_meta(db, "paused", None)
        pause = (store.get_meta(db, "shared_view") or {}).get("paused")
        print("resumed" + (f"; every machine is still paused by {pause.get('machine')}: "
                           "sq resume --everywhere" if pause else ""))
    elif a.command == "cost":
        cost(a.days)
    elif a.command == "agents":
        if a.action == "setup":
            sys.exit(agents.setup(home(), platform, workspace=a.workspace))
        if a.action == "up":
            sys.exit(agents.up(db, home(), platform))
        if a.action == "permissions":
            if a.step == "apply":
                sys.exit(permissions.apply(home()))
            lines = permissions.pending(home())
            print("\n".join(["main grants what this machine has not applied; run "
                             "just agents permissions apply:"] + lines) if lines
                  else "this machine has applied everything main grants")
            return None
        sys.exit(agents.down(db, home(), platform, now=a.now))
    elif a.command == "sync":
        errors = sync.sync(db, force=True, full=a.full)
        refresh_work(db, time.time())
        print("error: " + "; ".join(errors) if errors else "synced")
    else:
        target = home() / "sq"
        tree = subprocess.run(["git", "rev-parse", "HEAD:tools/queue"], cwd=HERE.parent,
                              capture_output=True, text=True).stdout.strip() or "local"
        update.copy(HERE.parent, home(), tree)
        if not store.get_meta(db, "baselined_at"):
            errors = sync.sync(db, force=True, full=True)
            if errors:
                return print(f"error: {'; '.join(errors)}")
            baseline(db)
        print(f"installed: {target / 'sq'}")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv or argv[0] in ("-h", "--help", "help"):
        return print(f"usage: sq <role> <command> …   (sq <role> help lists your commands)\n"
                     f"       sq status | sync [--full] | install | cost [--days N]\n"
                     f"       sq start | stop [roles | --all] | pause | resume | run [--dry-run]\n"
                     f"       sq agents setup | up | down [--now]\n"
                     f"roles: {', '.join(roles.ROLES)}")
    try:
        if argv[0] in ADMIN:
            return admin(argv)
        role = argv[0]
        if role in roles.FORMER:
            print(f"error: the {role} linguist is now {roles.FORMER[role]}. Stop this routine "
                  f"(CronDelete) and run /soirely-linguist once.")
            sys.exit(2)
        if role not in roles.ROLES:
            sys.exit(f"unknown role {role}: one of {', '.join(roles.ROLES)}")
        parser = role_parser(role)
        a = parser.parse_args(argv[1:])
        if a.command in (None, "help"):
            topic = getattr(a, "topic", None)
            if topic in parser.commands:
                return parser.commands[topic].print_help()
            if topic:
                sys.exit(f"no command {topic} for {role}; `sq {role} help` lists them")
            return parser.print_help()
        a.fn(Session(role, a.again), a)
    except actions.Refused as refusal:
        print(f"refused: {refusal}")
        sys.exit(2)
    except (RuntimeError, OSError) as error:
        print(f"error: {error}")
        sys.exit(1)
