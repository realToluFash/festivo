"""`sq`: the one place the roles read their work from and write their answers to."""

import argparse
import os
import pathlib
import shutil
import subprocess
import sys
import time

from . import github, render, roles, store, sync, work
from .shortcut import Shortcut

HERE = pathlib.Path(__file__).resolve().parent


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


def command():
    return f"python3 {HERE.parent / 'sq'}"


def open_db():
    return store.connect(str(home() / "queue.db"))


def refresh_work(db, now):
    busy = {row["roles"] for row in db.execute(
        "select roles from work where status in ('open', 'claimed')")}
    busy_roles = {role for roles_ in busy for role in roles_.split(",")}
    last_runs = {row["role"]: row["last_done"] for row in db.execute("select * from runs")}
    items = work.derive(store.stories(db), store.prs(db), store.get_meta(db, "main_run"),
                        last_runs, busy_roles, now, store.handled(db))
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
    sq = command()
    return "\n".join([
        f"Run `{roles.invoke(role)}` as an unattended routine run "
        "(.claude/skills/role-routine, section 3).",
        f"Your work is item {row['id']}: {row['reason']}.",
        f"Start with `{sq} show {row['id']}`. It prints the story, its pull requests and every "
        "comment you need, so do not fetch them again from Shortcut or GitHub.",
        f"Write through sq too: `{sq} comment`, `move`, `pr-reply`, `pr-resolve` "
        f"(`{sq} --help`). Nobody is watching: never wait for an answer.",
        f"As your last step run `{sq} done {row['id']} --note \"<one line>\"`.",
        "Then report in at most ten lines.",
    ])


def wanted_role(name):
    if name not in roles.ROLES:
        sys.exit(f"unknown role {name}: one of {', '.join(roles.ROLES)}")
    return name


def text_from(args):
    text = args.text if args.text is not None else sys.stdin.read()
    if not text.strip():
        sys.exit("nothing to post: pass --text or pipe the body in")
    return text.strip()


def cmd_tick(args):
    role = wanted_role(args.role)
    db = open_db()
    now = time.time()
    errors = sync.sync(db, now)
    if errors and not store.get_meta(db, "synced_ok_at"):
        return print(f"error: {'; '.join(errors)}")
    refresh_work(db, now)
    if store.held_by(db, role, now):
        return print("busy")
    row = store.claim(db, role, now)
    if not row:
        return print("idle")
    print(f"wake: {row['reason']}\n---\n{brief(row, role)}")


def cmd_next(args):
    role = wanted_role(args.role)
    db = open_db()
    now = time.time()
    sync.sync(db, now)
    refresh_work(db, now)
    row = store.held_by(db, role, now) or store.claim(db, role, now)
    if not row:
        return print("idle")
    show_work(db, row, role, args.all)


def show_work(db, row, role, everything=False):
    story = store.story(db, row["story_id"]) if row["story_id"] else None
    prs = [store.pr(db, row["pr"])] if row["pr"] else (
        store.prs_for_story(db, row["story_id"]) if row["story_id"] else [])
    print(render.work_block(row, story, [p for p in prs if p], role, everything,
                            store.handled(db)))


def parse_ref(ref):
    ref = ref.strip()
    if ref.startswith("sc-"):
        return "story", int(ref[3:])
    if ref.startswith("#"):
        return "pr", int(ref[1:])
    return "work", int(ref)


def cmd_show(args):
    db = open_db()
    kind, number = parse_ref(args.ref)
    if kind == "work":
        row = store.item(db, number)
        if not row:
            sys.exit(f"no work item {number}")
        role = args.role or row["claimed_by"] or row["roles"].split(",")[0]
        return show_work(db, row, role, args.all)
    if kind == "pr":
        pr = store.pr(db, number)
        if not pr:
            sys.exit(f"PR #{number} is not open or recently merged")
        story = store.story(db, pr["story_id"]) if pr["story_id"] else None
        out = (render.story_block(story)
               + render.comments_block(story, args.role, args.all, store.handled(db))
               if story else [])
        return print("\n".join(out + render.pr_block(pr, args.role)))
    story = store.story(db, number)
    if not story:
        sync.refresh_story(db, Shortcut(), number)
        story = store.story(db, number)
    out = render.story_block(story) + render.comments_block(story, args.role, args.all,
                                                            store.handled(db))
    for pr in store.prs_for_story(db, number):
        out += render.pr_block(pr, args.role)
    print("\n".join(out))


def cmd_done(args):
    db = open_db()
    if args.ref.isdigit():
        row = store.finish(db, int(args.ref), args.note)
        return print("done" if row else f"no work item {args.ref}")
    role = wanted_role(args.ref)
    row = store.held_by(db, role)
    if row:
        store.finish(db, row["id"], args.note)
    else:
        store.mark_run(db, role)
    print("done")


def cmd_release(args):
    store.release(open_db(), int(args.id))
    print("released")


def cmd_status(args):
    db = open_db()
    now = time.time()
    synced = store.get_meta(db, "synced_ok_at")
    errors = store.get_meta(db, "sync_errors") or []
    print(f"synced {int(now - synced)}s ago" if synced else "never synced",
          f"· last errors: {'; '.join(errors)}" if errors else "")
    for role in roles.ROLES:
        held = store.held_by(db, role, now)
        waiting = store.waiting(db, role)
        if not held and not waiting:
            continue
        line = f"{role:5} "
        if held:
            line += f"working on {held['id']} ({held['reason']}); "
        line += f"{len(waiting)} waiting"
        if waiting:
            line += ": " + "; ".join(f"{w['id']} {w['reason']}" for w in waiting[:4])
        print(line)


def cmd_sync(args):
    db = open_db()
    errors = sync.sync(db, force=True, full=args.full)
    refresh_work(db, time.time())
    print("error: " + "; ".join(errors) if errors else "synced")


def cmd_comment(args):
    role = wanted_role(args.as_role)
    kind, story_id = parse_ref(args.story)
    if kind != "story":
        sys.exit("comment takes a story: sc-<n>")
    db = open_db()
    shortcut = Shortcut()
    story = store.story(db, story_id)
    if args.reply_to and not any(c["id"] == args.reply_to for c in (story or {}).get("comments", [])):
        sync.refresh_story(db, shortcut, story_id)
        story = store.story(db, story_id)
    parent = None
    to = [t for t in (args.to or "").replace(",", " ").split() if t]
    if args.reply_to:
        replied = next((c for c in story["comments"] if c["id"] == args.reply_to), None) \
            if story else None
        if not replied:
            sys.exit(f"no comment #{args.reply_to} on sc-{story_id}")
        # Shortcut threads one level deep, so a reply to a reply goes on the thread's root.
        parent = replied["parent"] or replied["id"]
        if not to:
            asker = roles.author(replied["text"])
            to = [asker] if asker else []
    if not to:
        sys.exit("say who it is for: --to pm,ux")
    head = " ".join(f"[{t}]" for t in to) + f" (from {role})"
    posted = shortcut.comment(story_id, f"{head}\n{text_from(args)}", parent)
    sync.refresh_story(db, shortcut, story_id)
    print(f"posted #{posted['id']} on sc-{story_id}")


def cmd_move(args):
    kind, story_id = parse_ref(args.story)
    if kind != "story":
        sys.exit("move takes a story: sc-<n>")
    shortcut = Shortcut()
    raw = shortcut.story(story_id)
    workflow = next(w for w in shortcut.workflows() if w["id"] == raw["workflow_id"])
    state = next((s for s in workflow["states"] if s["name"].lower() == args.state.lower()),
                 None)
    if not state:
        names = ", ".join(s["name"] for s in workflow["states"])
        sys.exit(f"no state {args.state!r}: one of {names}")
    shortcut.move(story_id, state["id"])
    db = open_db()
    sync.refresh_story(db, shortcut, story_id)
    refresh_work(db, time.time())
    print(f"sc-{story_id} is now {state['name']}")


def cmd_pr_reply(args):
    db = open_db()
    owner, name = store.get_meta(db, "repository") or github.repository()
    github.reply(owner, name, args.pr, args.comment, text_from(args))
    sync.sync_github(db)
    print(f"replied on PR #{args.pr}")


def cmd_pr_resolve(args):
    github.resolve(args.thread)
    sync.sync_github(open_db())
    print("resolved")


def cmd_install(args):
    target = home() / "sq"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(HERE.parent, target,
                    ignore=shutil.ignore_patterns("tests", "__pycache__", "*.md"))
    db = open_db()
    if not store.get_meta(db, "baselined_at"):
        errors = sync.sync(db, force=True, full=True)
        if errors:
            return print(f"error: {'; '.join(errors)}")
        baseline(db)
    print(f"installed: python3 {target / 'sq'}")


def parser():
    p = argparse.ArgumentParser(prog="sq", description=__doc__)
    sub = p.add_subparsers(required=True)

    def add(name, fn, help_):
        s = sub.add_parser(name, help=help_)
        s.set_defaults(fn=fn)
        return s

    add("tick", cmd_tick, "the routine's check: idle, busy, or wake with a brief").add_argument(
        "role")
    s = add("next", cmd_next, "claim the role's next work and print it")
    s.add_argument("role")
    s.add_argument("--all", action="store_true", help="every comment thread in full")
    s = add("show", cmd_show, "print a work item, sc-<n> or #<pr>")
    s.add_argument("ref")
    s.add_argument("--role", help="whose comments to print in full")
    s.add_argument("--all", action="store_true", help="every comment thread in full")
    s = add("done", cmd_done, "finish a work item, or whatever a role holds")
    s.add_argument("ref", help="a work item id, or a role")
    s.add_argument("--note")
    add("release", cmd_release, "give a claimed item back unfinished").add_argument("id")
    add("status", cmd_status, "what every role holds and has waiting")
    add("sync", cmd_sync, "sync now").add_argument("--full", action="store_true")
    s = add("comment", cmd_comment, "post a tagged comment on a story")
    s.add_argument("story")
    s.add_argument("--as", dest="as_role", required=True, help="your role")
    s.add_argument("--to", help="addressees, e.g. pm,ux; a reply defaults to the asker")
    s.add_argument("--reply-to", type=int, help="the comment you answer")
    s.add_argument("--text", help="the body; otherwise read from stdin")
    s = add("move", cmd_move, "move a story to a state, by name")
    s.add_argument("story")
    s.add_argument("state")
    s = add("pr-reply", cmd_pr_reply, "reply in a pull request's review thread")
    s.add_argument("pr", type=int)
    s.add_argument("comment", type=int, help="the thread's first comment id")
    s.add_argument("--text")
    add("pr-resolve", cmd_pr_resolve, "resolve a review thread").add_argument("thread")
    add("install", cmd_install, "copy sq where no branch switch removes it")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        args.fn(args)
    except (RuntimeError, OSError) as error:
        print(f"error: {error}")
        sys.exit(1)
