"""Pulls Shortcut and GitHub into the store. One sync serves every role's tick."""

import datetime
import time
from concurrent.futures import ThreadPoolExecutor

from . import github, roles, store
from .shortcut import Shortcut, slim

FRESH_SECONDS = 60
FULL_EVERY_SECONDS = 15 * 60
INBOX_DAYS = 14
LOOKUP_EVERY_SECONDS = 60 * 60


def _lookups(db, shortcut, now):
    """Workflow state and epic names change rarely, so they are refreshed hourly."""
    if now - store.get_meta(db, "lookups_at", 0) < LOOKUP_EVERY_SECONDS:
        return store.get_meta(db, "states"), store.get_meta(db, "epics")
    states = {str(s["id"]): s["name"] for w in shortcut.workflows() for s in w["states"]}
    epics = {str(e["id"]): e["name"] for e in shortcut.epics()}
    store.set_meta(db, "states", states)
    store.set_meta(db, "epics", epics)
    store.set_meta(db, "lookups_at", now)
    return states, epics


def sync_shortcut(db, shortcut, now, full=False):
    states, epics = _lookups(db, shortcut, now)
    full = full or now - store.get_meta(db, "full_at", 0) >= FULL_EVERY_SECONDS
    days = INBOX_DAYS if full else 1
    since = (datetime.datetime.fromtimestamp(now, datetime.UTC)
             - datetime.timedelta(days=days)).date().isoformat()
    found = {s["id"]: s for s in shortcut.search(f"updated:{since}..*")}
    if full:
        for state in roles.QUEUE_STATES:
            found.update({s["id"]: s for s in shortcut.search(f'state:"{state}"')})
    stale = [story_id for story_id, hit in found.items()
             if (store.story(db, story_id) or {}).get("updated_at") != hit.get("updated_at")]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for raw in pool.map(shortcut.story, stale):
            store.put_story(db, slim(raw, states, epics))
    fetched = len(stale)
    if full:
        store.set_meta(db, "full_at", now)
    return fetched


def refresh_story(db, shortcut, story_id, now=None):
    states, epics = _lookups(db, shortcut, now or time.time())
    store.put_story(db, slim(shortcut.story(story_id), states, epics))


def sync_github(db):
    owner, name = store.get_meta(db, "repository") or github.repository()
    store.set_meta(db, "repository", [owner, name])
    store.put_prs(db, github.pull_requests(owner, name))
    store.set_meta(db, "main_run", github.main_run())


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
    try:
        sync_shortcut(db, Shortcut(), now, full)
    except Exception as error:
        errors.append(str(error))
    try:
        sync_github(db)
    except Exception as error:
        errors.append(str(error))
    store.set_meta(db, "sync_errors", errors)
    if not errors:
        store.set_meta(db, "synced_ok_at", now)
    return errors
