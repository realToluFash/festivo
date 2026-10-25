"""Pulls Shortcut and GitHub into the store. One sync serves every role's tick."""

import datetime
import time
from concurrent.futures import ThreadPoolExecutor

from . import github, roles, store, work
from .shortcut import Shortcut, ShortcutError, slim

FRESH_SECONDS = 60
FULL_EVERY_SECONDS = 15 * 60
# Ready For Dev is searched on its own more often, so a developer is not left idle.
READY_EVERY_SECONDS = 5 * 60
INBOX_DAYS = 14
LOOKUP_EVERY_SECONDS = 60 * 60
# An epic's state decides whether its Ready For Dev stories are offered, so epics are read
# on every sync, not with the hourly lookups.
EPICS_EVERY_SECONDS = 60
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
        store.set_meta(db, "slim_version", SLIM_VERSION)
        full = True
    states, epics = _lookups(db, shortcut, now)
    full = full or now - store.get_meta(db, "full_at", 0) >= FULL_EVERY_SECONDS
    days = INBOX_DAYS if full else 1
    since = (datetime.datetime.fromtimestamp(now, datetime.UTC)
             - datetime.timedelta(days=days)).date().isoformat()
    found = {s["id"]: s for s in shortcut.search(f"updated:{since}..*")}
    ready = full or now - store.get_meta(db, "ready_at", 0) >= READY_EVERY_SECONDS
    for state in roles.QUEUE_STATES if full else ["Ready For Dev"] if ready else []:
        found.update({s["id"]: s for s in shortcut.search(f'state:"{state}"')})
    stale = [story_id for story_id, hit in found.items()
             if (store.story(db, story_id) or {}).get("updated_at") != hit.get("updated_at")]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for raw in pool.map(shortcut.story, stale):
            store.put_story(db, slim(raw, states, epics))
    fetched = len(stale)
    if full:
        store.set_meta(db, "full_at", now)
    if ready:
        store.set_meta(db, "ready_at", now)
    return fetched


def refresh_story(db, shortcut, story_id, now=None):
    states, epics = _lookups(db, shortcut, now or time.time())
    story = slim(shortcut.story(story_id), states, epics)
    store.put_story(db, story)
    return story


def pr_stories(db, shortcut, now):
    """The story of every open pull request, however long ago it was last updated, so a
    pull request on an old Done or archived story is still seen. A story Shortcut does not
    have is remembered as missing and not asked for again. Search leaves archived stories
    out, so a Done one is fetched again now and then to see it archived."""
    missing = set(store.get_meta(db, "missing_stories") or [])
    again = now - store.get_meta(db, "pr_stories_at", 0) >= FULL_EVERY_SECONDS
    wanted = set()
    for pr in store.prs(db):
        if pr["state"] != "open" or not pr["story_id"] or pr["story_id"] in missing:
            continue
        known = store.story(db, pr["story_id"])
        if not known or again and work.finished(known):
            wanted.add(pr["story_id"])
    for story_id in sorted(wanted):
        try:
            refresh_story(db, shortcut, story_id, now)
        except ShortcutError as error:
            if " 404 " in str(error):
                missing.add(story_id)
    store.set_meta(db, "missing_stories", sorted(missing))
    if again:
        store.set_meta(db, "pr_stories_at", now)


def refresh_lookups(db, shortcut):
    store.set_meta(db, "lookups_at", 0)
    return _lookups(db, shortcut, time.time())


def sync_github(db):
    owner, name = store.get_meta(db, "repository") or github.repository()
    store.set_meta(db, "repository", [owner, name])
    known = {pr["number"]: pr for pr in store.prs(db)}
    prs = github.pull_requests(owner, name, known)
    cache, kept = store.get_meta(db, "carried", {}), {}
    for pr in prs:
        try:
            pr["carried"] = work.carried(pr, cache, github.same_change,
                                         known.get(pr["number"]))
        except github.GitHubError:
            pr["carried"] = None
        kept.update({key: cache[key] for key in cache if key.endswith(f"..{pr['head_sha']}")})
    store.set_meta(db, "carried", kept)
    store.put_prs(db, prs)
    runs = github.main_runs()
    store.set_meta(db, "main_runs", runs)
    store.set_meta(db, "main_run", runs[0] if runs else None)


def sync(db, now=None, force=False, full=False):
    """Syncs unless another tick did within the last minute. Returns the errors, if any."""
    now = now or time.time()
    db.execute("begin immediate")
    last = store.get_meta(db, "synced_at", 0)
    if not force and now - last < FRESH_SECONDS:
        db.execute("commit")
        return []
    store.set_meta(db, "synced_at", now)
    db.execute("commit")

    errors = []
    shortcut = Shortcut()
    try:
        sync_shortcut(db, shortcut, now, full)
    except Exception as error:
        errors.append(str(error))
    try:
        sync_github(db)
    except Exception as error:
        errors.append(str(error))
    if not errors:
        try:
            pr_stories(db, shortcut, now)
        except Exception as error:
            errors.append(str(error))
    store.set_meta(db, "sync_errors", errors)
    if not errors:
        store.set_meta(db, "synced_ok_at", now)
    return errors
