"""Pulls Shortcut and GitHub into the store. One sync serves every role's tick."""

import contextlib
import datetime
import time
from concurrent.futures import ThreadPoolExecutor

from . import github, roles, store, work
from .shortcut import OutOfTime, Shortcut, ShortcutError, history_moves, history_vcs, slim

FRESH_SECONDS = 60
FULL_EVERY_SECONDS = 15 * 60
# A sync reads what changed since the last whole one, from this long before it, so a story
# updated while that sync ran is not missed.
OVERLAP_SECONDS = 2 * 60
# Ready For Dev is searched on its own more often, so a developer is not left idle.
READY_EVERY_SECONDS = 5 * 60
INBOX_DAYS = 14
LOOKUP_EVERY_SECONDS = 60 * 60
# An epic's state decides whether its Ready For Dev stories are offered, so epics are read
# on every sync, not with the hourly lookups.
EPICS_EVERY_SECONDS = 60
# The timer fires every minute and skips a fire while a tick still runs, so a sync stops
# here and the roles are ticked from the last whole one.
BUDGET_SECONDS = 25
# A demo-only story's demo that merged before the sync's window of 15 merges is found by
# search, and searched for again this often while the story waits on it.
DEMO_SEARCH_SECONDS = 24 * 60 * 60
# Bumped when `shortcut.slim` keeps new fields, so stories stored before are fetched again.
SLIM_VERSION = 3


def _lookups(db, shortcut, now):
    """Workflow states change rarely, so they are refreshed hourly; epics every minute."""
    states, epics = store.get_meta(db, "states"), store.get_meta(db, "epics")
    if now - store.get_meta(db, "lookups_at", 0) >= LOOKUP_EVERY_SECONDS:
        states = {str(s["id"]): s["name"] for w in shortcut.workflows() for s in w["states"]}
        store.set_meta(db, "states", states)
        store.set_meta(db, "epic_states", {str(s["id"]): s["name"]
                                           for s in shortcut.epic_states()})
        store.set_meta(db, "lookups_at", now)
        store.set_meta(db, "epics_at", 0)
    if now - store.get_meta(db, "epics_at", 0) >= EPICS_EVERY_SECONDS:
        names = store.get_meta(db, "epic_states") or {}
        epics = {str(e["id"]): {"name": e["name"], "state": e.get("state"),
                                "state_name": names.get(str(e.get("epic_state_id"))),
                                "updated_at": e.get("updated_at"),
                                "position": e.get("position")}
                 for e in shortcut.epics() if not e.get("archived")}
        store.set_meta(db, "epics", epics)
        store.set_meta(db, "epics_at", now)
    return states, epics


def sync_shortcut(db, shortcut, now, full=False):
    if store.get_meta(db, "slim_version") != SLIM_VERSION:
        db.execute("delete from stories")
        store.set_meta(db, "lookups_at", 0)
        store.set_meta(db, "full_at", 0)
        store.set_meta(db, "slim_version", SLIM_VERSION)
        full = True
    states, epics = _lookups(db, shortcut, now)
    full = full or now - store.get_meta(db, "full_at", 0) >= FULL_EVERY_SECONDS
    since = now - INBOX_DAYS * 24 * 60 * 60 if full else \
        max(store.get_meta(db, "shortcut_at", 0) - OVERLAP_SECONDS, now - 24 * 60 * 60)
    ready = full or now - store.get_meta(db, "ready_at", 0) >= READY_EVERY_SECONDS
    ids = {name: int(state_id) for state_id, name in states.items()}
    changed = datetime.datetime.fromtimestamp(since, datetime.UTC).isoformat()
    # Search leaves archived stories out, so the archived are asked for apart: archiving a
    # story updates it.
    asks = [{"updated_at_start": changed}, {"updated_at_start": changed, "archived": True}]
    asks += [{"workflow_state_id": ids[state]}
             for state in (roles.QUEUE_STATES if full else ["Ready For Dev"] if ready else [])
             if state in ids]
    found = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for hits in pool.map(lambda ask: shortcut.find(**ask), asks):
            found.update({s["id"]: s for s in hits})
        stale = [story_id for story_id, hit in found.items()
                 if (store.story(db, story_id) or {}).get("updated_at") != hit.get("updated_at")]
        raws = list(pool.map(shortcut.story, stale))
        for raw in raws:
            store.put_story(db, slim(raw, states, epics))
    undo_design_branch_moves(db, shortcut, raws, states, epics)
    fetched = len(stale) + sync_blockers(db, shortcut, states, epics)
    store.set_meta(db, "shortcut_at", now)
    if full:
        store.set_meta(db, "full_at", now)
    if ready:
        store.set_meta(db, "ready_at", now)
    return fetched


UNPLACED = object()


def design_branch_move(history, states, branches):
    """The ux/ branch or pull request whose push moved a story from Needs Design to Ready For
    Dev, if its last move was that one; UNPLACED if that move names a pull request `branches`
    does not hold yet; otherwise None. `branches` names each pull request's branch, by number."""
    for entry in reversed(history):
        moves = history_moves(entry)
        if not moves:
            continue
        if (states.get(str(moves[0].get("old"))), states.get(str(moves[0].get("new")))) \
                != ("Needs Design", "Ready For Dev"):
            return None
        for thing in history_vcs(entry):
            kind = thing["entity_type"]
            name = thing.get("name") if kind == "branch" else \
                branches.get(thing.get("number")) if kind == "pull-request" else None
            if roles.is_design_branch(name):
                return name
        if any(thing["entity_type"] == "pull-request" and thing.get("number") not in branches
               for thing in history_vcs(entry)):
            return UNPLACED
        return None
    return None


def design_pull_requests(raw, prs):
    """Each ux/ branch naming a story, with its pull requests by number, each True once merged
    or closed. Shortcut's record and sq's GitHub view are both read, and either seeing a pull
    request finished settles it, since the other may not have caught up with the merge."""
    found = {}

    def see(branch, number, finished):
        if not roles.is_design_branch(branch):
            return
        pulls = found.setdefault(branch, {})
        if number is not None:
            pulls[number] = pulls.get(number, False) or bool(finished)

    for branch in raw.get("branches") or []:
        see(branch.get("name"), None, False)
        for pr in branch.get("pull_requests") or []:
            see(branch.get("name"), pr.get("number"), pr.get("merged") or pr.get("closed"))
    for pr in raw.get("pull_requests") or []:
        see(pr.get("branch_name"), pr.get("number"), pr.get("merged") or pr.get("closed"))
    for pr in prs:
        if pr.get("story_id") == raw["id"] or pr.get("branch") in found:
            see(pr.get("branch"), pr["number"], pr.get("state") in ("merged", "closed"))
    return found


def demo_unmerged(pulls):
    """A ux/ branch with an open pull request, or with none sq can match, is demo work still
    to merge."""
    return any(not numbers or not all(numbers.values()) for numbers in pulls.values())


def undo_design_branch_moves(db, shortcut, raws, states, epics):
    """Shortcut's GitHub integration moves a story to Ready For Dev when a branch naming it is
    pushed, a designer's ux/ branch too, while its demo is still under review. Ready For Dev
    means a merged demo, so the move is undone while a ux/ branch naming the story has not
    merged, and stands once every one has: the integration makes the same move on the merge.
    A story Shortcut fails on, or whose move names a pull request sq's GitHub view does not
    hold yet, is stored without its `updated_at`, so the next sync tries again."""
    ids = {name: int(state_id) for state_id, name in states.items()}
    if "Needs Design" not in ids:
        return
    prs = store.prs(db)
    for raw in raws:
        if states.get(str(raw.get("workflow_state_id"))) != "Ready For Dev":
            continue
        pulls = design_pull_requests(raw, prs)
        if not demo_unmerged(pulls):
            continue
        branches = {pr["number"]: pr.get("branch") for pr in prs}
        branches.update({number: branch for branch, numbers in pulls.items()
                         for number in numbers})
        try:
            found = design_branch_move(shortcut.history(raw["id"]), states, branches)
            if found is UNPLACED:
                store.put_story(db, dict(slim(raw, states, epics), updated_at=None))
            elif found:
                moved = shortcut.update(raw["id"], workflow_state_id=ids["Needs Design"])
                store.put_story(db, slim(moved or shortcut.story(raw["id"]), states, epics))
        except ShortcutError:
            store.put_story(db, dict(slim(raw, states, epics), updated_at=None))


def sync_blockers(db, shortcut, states, epics):
    """The stories that block one not yet claimed, since a blocker the searches miss (Done
    long ago, or in a state no queue reads) still decides whether the story is held. Once
    stored, a blocker is kept current by the searches for what changed, archived or not.
    One Shortcut does not have is not asked for again."""
    missing = set(store.get_meta(db, "missing_stories") or [])
    wanted = set()
    for story in store.stories(db):
        if story["done"] or story["state"] not in work.HOLDABLE:
            continue
        for blocker_id in work.blockers(story):
            if blocker_id not in missing and not store.story(db, blocker_id):
                wanted.add(blocker_id)
    def fetch(blocker_id):
        try:
            return blocker_id, shortcut.story(blocker_id)
        except OutOfTime:
            raise
        except ShortcutError as error:
            return blocker_id, error

    with ThreadPoolExecutor(max_workers=8) as pool:
        for blocker_id, raw in pool.map(fetch, sorted(wanted)):
            if not isinstance(raw, ShortcutError):
                store.put_story(db, slim(raw, states, epics))
            elif " 404 " in str(raw):
                missing.add(blocker_id)
    store.set_meta(db, "missing_stories", sorted(missing))
    return len(wanted)


def refresh_story(db, shortcut, story_id, now=None):
    states, epics = _lookups(db, shortcut, now or time.time())
    story = slim(shortcut.story(story_id), states, epics)
    store.put_story(db, story)
    return story


def pr_stories(db, shortcut, now):
    """The story of every open pull request, however long ago it was last updated, so a
    pull request on an old Done or archived story is still seen. Once stored, it is kept
    current by the searches for what changed, archived or not, as a blocker is. A story
    Shortcut does not have is remembered as missing and not asked for again."""
    missing = set(store.get_meta(db, "missing_stories") or [])
    wanted = sorted({pr["story_id"] for pr in store.prs(db)
                     if pr["state"] == "open" and pr["story_id"]
                     and pr["story_id"] not in missing and not store.story(db, pr["story_id"])})
    for story_id in wanted:
        try:
            refresh_story(db, shortcut, story_id, now)
        except OutOfTime:
            raise
        except ShortcutError as error:
            if " 404 " in str(error):
                missing.add(story_id)
    store.set_meta(db, "missing_stories", sorted(missing))


def refresh_lookups(db, shortcut):
    store.set_meta(db, "lookups_at", 0)
    return _lookups(db, shortcut, time.time())


def sync_github(db):
    # Written only once: a write waits on another process's write lock, up to SQLite's
    # busy timeout, before the deadline is ever checked.
    if not store.get_meta(db, "repository"):
        store.set_meta(db, "repository", list(github.repository()))
    owner, name = store.get_meta(db, "repository")
    known = {pr["number"]: pr for pr in store.prs(db)}
    prs = github.pull_requests(owner, name, known)
    cache, kept = store.get_meta(db, "carried", {}), {}
    for pr in prs:
        try:
            pr["carried"] = work.carried(pr, cache, github.same_change,
                                         known.get(pr["number"]))
        except github.OutOfTime:
            raise
        except github.GitHubError:
            pr["carried"] = None
        kept.update({key: cache[key] for key in cache if key.endswith(f"..{pr['head_sha']}")})
    store.set_meta(db, "carried", kept)
    store.put_prs(db, prs)
    runs = github.main_runs()
    store.set_meta(db, "main_runs", runs)
    store.set_meta(db, "main_run", runs[0] if runs else None)


def demo_prs(db, now):
    """The merged pull requests of each demo-only story waiting on its build that the sync's
    window no longer holds, stored beside it, so the product manager is still told to move
    the story on. Each story is searched once a day; a failed search keeps what it found."""
    stored = store.prs(db)
    seen = {pr["story_id"] for pr in stored if pr.get("story_id")}
    found, kept = store.get_meta(db, "demo_prs") or {}, {}
    for story in store.stories(db):
        if roles.DEMO_ONLY not in story["labels"] or story["state"] not in work.DEMO_WAITING \
                or story["done"] or story.get("archived") or story["id"] in seen:
            continue
        key, entry = str(story["id"]), found.get(str(story["id"]))
        if not entry or now - entry["at"] >= DEMO_SEARCH_SECONDS:
            try:
                entry = {"at": now, "prs": github.merged_for_story(story["id"])}
            except github.OutOfTime:
                raise
            except github.GitHubError:
                pass
        if entry:
            kept[key] = entry
    store.set_meta(db, "demo_prs", kept)
    numbers = {pr["number"] for pr in stored}
    extra = {pr["number"]: pr for entry in kept.values() for pr in entry["prs"]
             if pr["number"] not in numbers}
    if extra:
        store.put_prs(db, stored + list(extra.values()))


def sync(db, now=None, force=False, full=False, budget=BUDGET_SECONDS, clock=time.monotonic,
         client=Shortcut):
    """Syncs unless another tick did within the last minute. Returns the errors, if any.
    A part that runs out of budget stops without an error; `sync_report` names it, with how
    long each part took."""
    now = now or time.time()
    db.execute("begin immediate")
    last = store.get_meta(db, "synced_at", 0)
    if not force and now - last < FRESH_SECONDS:
        db.execute("commit")
        return []
    store.set_meta(db, "synced_at", now)
    db.execute("commit")

    errors, cut, took = [], [], {}
    deadline = None if budget is None else clock() + budget

    def part(name, step):
        begun = clock()
        try:
            step()
        except (OutOfTime, github.OutOfTime):
            cut.append(name)
        except Exception as error:
            errors.append(str(error))
        took[name] = round(clock() - begun, 1)

    shortcut = client(deadline=deadline, clock=clock)
    part("shortcut", lambda: sync_shortcut(db, shortcut, now, full))
    with github.deadline(deadline, clock) if deadline else contextlib.nullcontext():
        part("github", lambda: sync_github(db))
        if "github" not in cut and not errors:
            part("demo prs", lambda: demo_prs(db, now))
    if not errors and not cut:
        part("pr stories", lambda: pr_stories(db, shortcut, now))
    store.set_meta(db, "sync_errors", errors)
    store.set_meta(db, "sync_report", {"at": now, "took": took, "cut": cut})
    if not errors and not cut:
        store.set_meta(db, "synced_ok_at", now)
    return errors
