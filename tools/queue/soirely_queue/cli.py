"""`sq <role> <command>`: the one place the roles read their work from and write to.

Every read prints a slice and goes through the ledger, so a role is never shown twice what
it already has. Every write is checked against what the role may do before it is sent."""

import argparse
import os
import pathlib
import shutil
import subprocess
import sys
import time

from . import actions, digests, github, payloads, roles, store, sync, work
from . import text as T
from . import views as V
from .ledger import Printer
from .shortcut import Shortcut

HERE = pathlib.Path(__file__).resolve().parent
ADMIN = ("status", "sync", "install")


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
    items = work.derive(store.stories(db), store.prs(db), store.get_meta(db, "main_run"),
                        last_runs, busy_roles, now, store.handled(db), store.moves(db))
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
               "where status = 'open' and kind = 'story'")
    store.set_meta(db, "baselined_at", time.time())


def brief(row, role):
    sq = f"sq {role}"
    return "\n".join([
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


def cmd_tick(s, a):
    now = time.time()
    synced(s.db, now)
    if store.held_by(s.db, s.role, now):
        return print("busy")
    row = store.claim(s.db, s.role, now)
    if not row:
        return print("idle")
    print(f"wake: {row['reason']}\n---\n{brief(row, s.role)}")


def cmd_next(s, a):
    now = time.time()
    synced(s.db, now)
    row = store.held_by(s.db, s.role, now) or store.claim(s.db, s.role, now)
    if not row:
        return print("idle")
    s.printer.run = f"work:{row['id']}"
    payloads.render(s.printer, s.db, row, s.cache)
    s.done()


def cmd_done(s, a):
    row = store.item(s.db, int(a.id)) if a.id else store.held_by(s.db, s.role)
    if row:
        store.finish(s.db, row["id"], a.note)
    else:
        store.mark_run(s.db, s.role)
    print("done")


def cmd_release(s, a):
    row = store.held_by(s.db, s.role)
    if row:
        store.release(s.db, row["id"])
    print("released")


def cmd_queue(s, a):
    digests.render(s.printer, s.db)
    s.done()


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
    found = github.pr_checks(a.pr)
    failed = [c for c in found if c.get("bucket") == "fail"]
    pending = [c for c in found if c.get("bucket") == "pending"]
    print(f"PR #{a.pr}: {len(found)} checks, {len(failed)} failed, {len(pending)} pending")
    for check in failed:
        print(f"\n{check['workflow']} / {check['name']} {check['link']}")
        if not a.names:
            log = github.failed_log(check["link"], tail=a.tail)
            print("\n".join("  " + line for line in log.splitlines()))
    for check in pending:
        print(f"  pending: {check['workflow']} / {check['name']}")


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


TAKES_BODY = {actions.comment, actions.note, actions.report, actions.edit, actions.new_story,
              actions.new_epic, actions.review, actions.pr_reply, actions.pr_create}


def write(fn):
    def run(s, a):
        if fn in TAKES_BODY and a.text is None:
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
    ("checks", cmd_checks, "a pull request's checks, with the failed logs' last lines",
     lambda p: (p.add_argument("pr", type=int), p.add_argument("--names", action="store_true"),
                p.add_argument("--tail", type=int, default=40))),
    ("runs", cmd_runs, "the last runs on main", None),
    ("find", cmd_find, "Shortcut search, one line per story",
     lambda p: (p.add_argument("query"), p.add_argument("--limit", type=int, default=20))),
    ("epics", cmd_epics, "epics, one line each",
     lambda p: p.add_argument("--all", action="store_true")),
    ("epic", cmd_epic, "an epic's description and open stories",
     lambda p: p.add_argument("epic", type=int)),
    ("history", cmd_history, "a story's state changes",
     lambda p: (p.add_argument("story"), p.add_argument("--limit", type=int, default=30))),
]

WRITES = [
    ("comment", actions.comment, "post a tagged comment; --reply-to answers one",
     lambda p: (p.add_argument("story"), p.add_argument("--to"),
                p.add_argument("--reply-to", type=int),
                p.add_argument("--untagged", action="store_true",
                               help="no addressee: a record, or with --reply-to a reply "
                                    "that only confirms; wakes nobody"), body(p))),
    ("note", actions.note, "a private note your next run on this story sees",
     lambda p: (p.add_argument("story"), body(p))),
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
    ("edit", actions.edit, "replace a section, or add a dated one, on sc-<n> or epic-<n>",
     lambda p: (p.add_argument("target"), p.add_argument("--section"),
                p.add_argument("--dated"), body(p))),
    ("new-story", actions.new_story, "create a story, in Backlog unless you are the PM",
     lambda p: (p.add_argument("--name", required=True), p.add_argument("--epic", type=int),
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
                               choices=["relates to", "blocks", "duplicates"]))),
    ("archive", actions.archive, "archive a story", lambda p: p.add_argument("story")),
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
    sub.add_parser("help", help="this list")

    def add(name, fn, help_, args):
        s = sub.add_parser(name, help=help_)
        s.add_argument("--again", action="store_true", help="print in full what you have read")
        s.set_defaults(fn=fn)
        if args:
            args(s)

    for name, fn, help_, args in READS:
        add(name, fn, help_, args)
    for name, fn, help_, args in WRITES:
        if roles.may(role, name):
            add(name, write(fn), help_, args)
    return p


def admin(argv):
    p = argparse.ArgumentParser(prog="sq", description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="what every role holds and has waiting")
    sub.add_parser("sync", help="sync now").add_argument("--full", action="store_true")
    sub.add_parser("install", help="copy sq where no branch switch removes it")
    a = p.parse_args(argv)
    db = open_db()
    if a.command == "status":
        now = time.time()
        synced_at = store.get_meta(db, "synced_ok_at")
        errors = store.get_meta(db, "sync_errors") or []
        print(f"synced {int(now - synced_at)}s ago" if synced_at else "never synced",
              f"· last errors: {'; '.join(errors)}" if errors else "")
        for role in roles.ROLES:
            held, waiting = store.held_by(db, role, now), store.waiting(db, role)
            if held or waiting:
                line = f"{role:5} " + (f"working on {held['id']} ({held['reason']}); "
                                       if held else "")
                line += f"{len(waiting)} waiting"
                if waiting:
                    line += ": " + "; ".join(f"{w['id']} {w['reason']}" for w in waiting[:4])
                print(line)
    elif a.command == "sync":
        errors = sync.sync(db, force=True, full=a.full)
        refresh_work(db, time.time())
        print("error: " + "; ".join(errors) if errors else "synced")
    else:
        target = home() / "sq"
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(HERE.parent, target,
                        ignore=shutil.ignore_patterns("tests", "__pycache__", "*.md"))
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
                     f"       sq status | sync [--full] | install\n"
                     f"roles: {', '.join(roles.ROLES)}")
    try:
        if argv[0] in ADMIN:
            return admin(argv)
        role = argv[0]
        if role not in roles.ROLES:
            sys.exit(f"unknown role {role}: one of {', '.join(roles.ROLES)}")
        parser = role_parser(role)
        a = parser.parse_args(argv[1:])
        if a.command in (None, "help"):
            return parser.print_help()
        a.fn(Session(role, a.again), a)
    except actions.Refused as refusal:
        print(f"refused: {refusal}")
        sys.exit(2)
    except (RuntimeError, OSError) as error:
        print(f"error: {error}")
        sys.exit(1)
