# sq: the roles' work queue

One sync pulls Shortcut and GitHub into a SQLite file. The roles read their work from it
and write their answers through it, rather than each routine asking both services every
three minutes. Python's standard library only, so there is nothing to install.

```sh
python3 tools/queue/sq install          # copy to .git/soirely-roles/sq/, baseline on first run
python3 tools/queue/sq status           # what each role holds and has waiting
python3 tools/queue/sq tick lead        # the routine's check: idle, busy, or wake + brief
python3 tools/queue/sq show 42          # a work item: story, threads, pull requests
python3 tools/queue/sq show sc-66 --all # any story, every thread in full
python3 tools/queue/sq done 42 --note "passed at 908eee1"
```

Writes: `comment`, `move`, `pr-reply`, `pr-resolve`. `sq --help` lists them all.

## How it decides

- **`sync.py`** runs at most once a minute, whichever tick asks first. It does a full pass
  over the queue states every 15 minutes, and otherwise refetches only the stories updated
  since yesterday whose `updated_at` changed. GitHub is one GraphQL query over the open and
  recently merged pull requests.
- **`work.py`** turns the stored stories and pull requests into work items, with no network
  calls. Each item has a fingerprint, such as `lead:review:#176@e9ced78:<moved_at>`, so
  finished work stays finished and a change makes a new item.
- **`store.py`** holds the claims. A role holds one item at a time, a pooled item (Ready For
  QA, unlabelled To Do) goes to one role only, and a claim lapses after 90 minutes.

The database is `.git/soirely-roles/queue.db`, shared by every worktree and never committed.
`SQ_HOME` points it somewhere else, for trying changes against a copy.

## Tests

`npm run test:queue`.
