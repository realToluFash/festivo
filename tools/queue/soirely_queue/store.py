"""The SQLite file every role reads, and the claims that keep two runs off one item."""

import json
import sqlite3
import time

from . import roles

SCHEMA = """
create table if not exists meta (key text primary key, value text);
create table if not exists stories (
  id integer primary key, state text, updated_at text, json text not null
);
create table if not exists prs (
  number integer primary key, story_id integer, head_sha text, json text not null
);
create table if not exists work (
  id integer primary key autoincrement,
  fingerprint text unique not null,
  pool text not null,
  roles text not null,
  kind text not null,
  story_id integer,
  pr integer,
  reason text not null,
  priority integer not null,
  comments text,
  status text not null default 'open',
  claimed_by text,
  lease_until real,
  first_seen real not null,
  done_at real,
  note text
);
create index if not exists work_open on work (status, priority, first_seen);
create table if not exists runs (role text primary key, last_done real);
create table if not exists shown (
  run text not null, key text not null, version text, at real, primary key (run, key)
);
create table if not exists seen (
  role text not null, key text not null, version text, at real, primary key (role, key)
);
create table if not exists notes (
  id integer primary key autoincrement, role text not null, story_id integer not null,
  note text not null, at real not null
);
create table if not exists drawings (
  story_id integer primary key, name text not null, prompt text not null, at real not null
);
create table if not exists claims (
  key text primary key, role text not null, at real not null
);
create table if not exists handled (
  role text not null, comment_id integer not null, primary key (role, comment_id)
);
create table if not exists moves (
  story_id integer not null, state text not null, moved_at text not null, role text not null,
  primary key (story_id, state, moved_at)
);
"""

LEASE_MINUTES = 90


def connect(path):
    db = sqlite3.connect(path, timeout=30, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("pragma journal_mode = wal")
    db.executescript(SCHEMA)
    if not get_meta(db, "linguists_merged"):
        db.execute("begin immediate")
        merge_linguists(db)
        set_meta(db, "linguists_merged", True)
        db.execute("commit")
    return db


def merge_linguists(db):
    """What the four locale roles dealt with and noted is the l10n role's, so their old
    comments do not come back to it as new. Repeating it changes nothing."""
    former = ", ".join(f"'{locale}'" for locale in roles.FORMER)
    db.execute("insert or ignore into handled (role, comment_id) select 'l10n', comment_id "
               f"from handled where role in ({former})")
    db.execute(f"update notes set role = 'l10n' where role in ({former})")


def get_meta(db, key, default=None):
    row = db.execute("select value from meta where key = ?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def set_meta(db, key, value):
    db.execute("insert into meta (key, value) values (?, ?) "
               "on conflict (key) do update set value = excluded.value",
               (key, json.dumps(value)))


def put_story(db, story):
    db.execute("insert into stories (id, state, updated_at, json) values (?, ?, ?, ?) "
               "on conflict (id) do update set state = excluded.state, "
               "updated_at = excluded.updated_at, json = excluded.json",
               (story["id"], story.get("state"), story.get("updated_at"), json.dumps(story)))


def story(db, story_id):
    row = db.execute("select json from stories where id = ?", (story_id,)).fetchone()
    return json.loads(row["json"]) if row else None


def stories(db):
    return [json.loads(row["json"]) for row in db.execute("select json from stories")]


def put_prs(db, prs):
    """A sync sees every open pull request, so one it no longer sees has closed."""
    db.execute("delete from prs")
    for pr in prs:
        db.execute("insert into prs (number, story_id, head_sha, json) values (?, ?, ?, ?)",
                   (pr["number"], pr.get("story_id"), pr.get("head_sha"), json.dumps(pr)))


def put_pr(db, pr):
    db.execute("insert into prs (number, story_id, head_sha, json) values (?, ?, ?, ?) "
               "on conflict (number) do update set story_id = excluded.story_id, "
               "head_sha = excluded.head_sha, json = excluded.json",
               (pr["number"], pr.get("story_id"), pr.get("head_sha"), json.dumps(pr)))


def prs(db):
    return [json.loads(row["json"]) for row in db.execute("select json from prs order by number")]


def pr(db, number):
    row = db.execute("select json from prs where number = ?", (number,)).fetchone()
    return json.loads(row["json"]) if row else None


def prs_for_story(db, story_id):
    return [json.loads(row["json"]) for row in
            db.execute("select json from prs where story_id = ? order by number", (story_id,))]


def record(db, items, now=None):
    """Adds new work and retires open work that no longer applies.

    Claimed work is left alone: the run holding it finishes or its lease runs out.
    """
    now = now or time.time()
    db.execute("begin immediate")
    try:
        current = {item["fingerprint"] for item in items}
        for item in items:
            db.execute(
                "insert into work (fingerprint, pool, roles, kind, story_id, pr, reason, "
                "priority, comments, first_seen) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "on conflict (fingerprint) do update set priority = excluded.priority, "
                "status = case work.status when 'gone' then 'open' else work.status end",
                (item["fingerprint"], item["pool"], ",".join(item["roles"]), item["kind"],
                 item.get("story_id"), item.get("pr"), item["reason"], item["priority"],
                 ",".join(map(str, item.get("comments") or [])), now))
        for row in db.execute("select id, fingerprint from work where status = 'open'"):
            if row["fingerprint"] not in current:
                db.execute("update work set status = 'gone' where id = ?", (row["id"],))
        db.execute("update work set status = 'open', claimed_by = null, lease_until = null "
                   "where status = 'claimed' and lease_until < ?", (now,))
        db.execute("commit")
    except BaseException:
        db.execute("rollback")
        raise


def held_by(db, role, now=None):
    now = now or time.time()
    return db.execute("select * from work where status = 'claimed' and claimed_by = ? "
                      "and lease_until >= ?", (role, now)).fetchone()


def waiting(db, role):
    return db.execute("select * from work where status = 'open' "
                      "and ',' || roles || ',' like ? order by priority, first_seen, id",
                      (f"%,{role},%",)).fetchall()


def claim_key(row):
    """What a claim on another machine is about: the item's story, or with none its kind."""
    return f"sc-{row['story_id']}" if row["story_id"] else row["kind"]


def claim(db, role, now=None, kinds=None, skip=()):
    """The role's top open item, or None. One claim per role, and one per pool item.
    `kinds` limits it to some kinds of work; `skip` holds the (pool, claim key) pairs taken
    on another machine."""
    now = now or time.time()
    db.execute("begin immediate")
    try:
        if held_by(db, role, now):
            db.execute("commit")
            return None
        rows = [row for row in waiting(db, role)
                if (kinds is None or row["kind"] in kinds)
                and (row["pool"], claim_key(row)) not in skip]
        if not rows:
            db.execute("commit")
            return None
        top = rows[0]
        db.execute("update work set status = 'claimed', claimed_by = ?, lease_until = ? "
                   "where id = ?", (role, now + LEASE_MINUTES * 60, top["id"]))
        db.execute("commit")
        return db.execute("select * from work where id = ?", (top["id"],)).fetchone()
    except BaseException:
        db.execute("rollback")
        raise


def finish(db, work_id, note=None, now=None):
    now = now or time.time()
    row = db.execute("select * from work where id = ?", (work_id,)).fetchone()
    if not row:
        return None
    db.execute("update work set status = 'done', done_at = ?, note = ?, lease_until = null "
               "where id = ?", (now, note, work_id))
    if row["comments"]:
        mark_handled(db, row["claimed_by"] or row["roles"].split(",")[0],
                     [int(c) for c in row["comments"].split(",")])
    if row["claimed_by"]:
        mark_run(db, row["claimed_by"], now)
    if note and row["story_id"]:
        add_note(db, row["claimed_by"] or row["roles"].split(",")[0], row["story_id"], note, now)
    return row


def release(db, work_id):
    db.execute("update work set status = 'open', claimed_by = null, lease_until = null "
               "where id = ? and status = 'claimed'", (work_id,))


def mark_run(db, role, now=None):
    db.execute("insert into runs (role, last_done) values (?, ?) "
               "on conflict (role) do update set last_done = excluded.last_done",
               (role, now or time.time()))


def last_run(db, role):
    row = db.execute("select last_done from runs where role = ?", (role,)).fetchone()
    return row["last_done"] if row else None


def item(db, work_id):
    return db.execute("select * from work where id = ?", (work_id,)).fetchone()


def mark_handled(db, role, comment_ids):
    db.executemany("insert or ignore into handled (role, comment_id) values (?, ?)",
                   [(role, c) for c in comment_ids])


def handled(db):
    return {(row["role"], row["comment_id"]) for row in db.execute("select * from handled")}


def mark_move(db, story_id, state, moved_at, role):
    db.execute("insert or replace into moves (story_id, state, moved_at, role) "
               "values (?, ?, ?, ?)", (story_id, state, moved_at, role))


def moves(db):
    return {(row["story_id"], row["state"], row["moved_at"]): row["role"]
            for row in db.execute("select * from moves")}


def add_note(db, role, story_id, note, now=None):
    db.execute("insert into notes (role, story_id, note, at) values (?, ?, ?, ?)",
               (role, story_id, note, now or time.time()))


def add_drawing(db, story_id, name, prompt, now=None):
    db.execute("insert or replace into drawings (story_id, name, prompt, at) "
               "values (?, ?, ?, ?)", (story_id, name, prompt, now or time.time()))


def drop_drawing(db, story_id):
    return db.execute("delete from drawings where story_id = ?", (story_id,)).rowcount


def drawings(db):
    return [dict(r) for r in db.execute("select story_id, name, prompt, at from drawings "
                                        "order by at")]


def notes(db, role, story_id, limit=3):
    return db.execute("select note, at from notes where role = ? and story_id = ? "
                      "order by at desc limit ?", (role, story_id, limit)).fetchall()


def take_story(db, story, role, now=None):
    """The first role to claim a story from the state it is in now holds it, so two testers
    or two developers reaching it together cannot both win. Returns the holder."""
    key = f"{story['id']}:{story['state']}:{story['moved_at']}"
    db.execute("insert or ignore into claims (key, role, at) values (?, ?, ?)",
               (key, role, now or time.time()))
    return db.execute("select role from claims where key = ?", (key,)).fetchone()["role"]
