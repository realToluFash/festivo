# sq: the roles' one way in

One sync pulls Shortcut and GitHub into a SQLite file. Every role reads its work from it and
writes through it, so no role calls the Shortcut tools or `gh` itself. Python's standard
library only, so there is nothing to install.

```sh
sq <role> help                    # the commands this role may run, and no others
sq <role> next                    # claim your next work and print what it needs
sq <role> done <id> --note "…"    # finish it; the note is what your next run on the story sees
sq status | sync [--full] | install
```

`sq` is `python3 .git/soirely-roles/sq/sq` once installed (`python3 tools/queue/sq install`),
so a branch switch never takes it away. Roles: pm, ux, dev, dev2, qa, qa2, qa3, lead, bm,
ops, en, es, fr, pt, cd.

## Reads print each thing once

Every read goes through a ledger of what the role has already been shown.

- **Within a run** (one claimed work item), a second request for the same section, comment,
  thread or file prints `… (shown above)`.
- **Across runs**, something the role read before and that has not changed prints as one
  line, `… (unchanged since you read it on 18 Oct)`, with the role's own notes on that story
  from `done --note` and `note`. Anything that changed prints in full.
- **What the work needs is always in full**: the AC for a developer building or a tester
  testing, the Design section for a tester, the PR's Risks for a tester and for the lead,
  the latest QA report on a Failed QA story, the review on a Failed Code Review one, and every comment still open for the role.
- `--again` on any read prints it in full regardless.

| Read                                                        | Prints                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                                                      | the payload for the work item's kind (below)                                                                                                    |
| `queue`                                                     | the role's pick or sweep list, one line per story                                                                                               |
| `story sc-N [--section S \| --headings]`                    | the story as the role works on it, or one section, or the section names                                                                         |
| `comments sc-N [--open \| --all] [--from R] [--since ID]`   | the threads involving the role; the rest as one line each                                                                                       |
| `pr N [--section S]`                                        | status, lead verdict, open threads; or one section of the body                                                                                  |
| `diff N [paths… \| --all]`                                  | the file list with +/-; or those files' diffs, cached by head sha                                                                               |
| `checks N [--names]`                                        | failing checks with the last 40 lines of each failed log                                                                                        |
| `runs`, `find "<query>"`, `epics`, `epic N`, `history sc-N` | one line per run, story, epic or state change                                                                                                   |
| `states sc-N sc-M … [--body DIR]`                           | one line per id, read fresh: state, epic, name; a missing id says so and the rest still print; `--body` saves each description as `DIR/sc-N.md` |

### Payloads by kind

| Kind                           | Who         | Prints                                                                                                                             |
| ------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `inbox`                        | any         | the threads with a comment open for the role, in full; the story's section names; the PR's status                                  |
| `story`                        | the queue's | the story through the ledger, AC (and Design for a tester) in full, tasks, links, involving threads, PRs                           |
| `review`                       | lead        | the AC, the involving threads, PR status with open and resolved threads, Risks, the diff stat, what changed since the last verdict |
| `threads`                      | lead        | the PR's status with every open thread, when a reply lands on any open thread, whoever opened it, in any story state               |
| `merge`                        | dev, dev2   | the PR's status, read live; a conflict says to bring main in rather than merge                                                     |
| `conflict`                     | dev, dev2   | the PR's status and how to bring main in, for an open PR that conflicts with main in any state; it goes ahead of comments          |
| `answer-threads`               | dev, dev2   | the PR's status with every open thread, when the lead passed the head but a thread it has not had your reply on holds the merge    |
| `to-qa`                        | dev, dev2   | the merge commit, and the one command that hands the story to QA                                                                   |
| `to-review`, `merged-unpassed` | dev, dev2   | the PR's status and the command to run                                                                                             |
| `checks-red`                   | dev, dev2   | each failing check with its log's last 40 lines                                                                                    |
| `main`                         | ops         | main's last runs and the failed log                                                                                                |
| `pick`, `sweep`                | the role    | the role's digest (below)                                                                                                          |

The digests: queue order for developers and testers; To Do and Waiting On Owner for the PM, Needs Design for the designer, QA outstanding items,
ideas and epics for the PM; stories with no Design section, or whose AC changed since, for
the designer; owner-decision and billing stories for the BM; ideas and QA friction for the
creative; translation tickets with their tasks and blocking stories for linguists; main's
runs for ops. Every payload ends with `Next:`, the commands to act with, ids filled in.

## Writes are checked before they are sent

`sq <role> help` lists only what the role may run. Each write also checks the state of the
story or pull request, read fresh rather than from the last sync, and says why it refused.

| Write                                                                            | Who                                | Does                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comment sc-N --to r,r \| --reply-to ID`                                         | all                                | posts `[r] (from role)`; `en`, `es`, `fr` and `pt` post their language tag and reach the linguist; a reply goes on the thread's root and defaults to the asker. `--untagged` posts `(from role)` alone, a record or a reply that only confirms, and wakes nobody                                                       |
| `note sc-N`                                                                      | all                                | a private line the role's next run on the story sees                                                                                                                                                                                                                                                                   |
| `claim sc-N`                                                                     | developers, testers                | developer: adds its label, moves to In Progress. Tester: In QA plus `QA claim: qaN`; a claim over three hours old can be taken over. The first claim recorded wins. Prints the story                                                                                                                                   |
| `move sc-N "<state>"`                                                            | per `roles.MOVES`                  | only the moves the role's skill makes, from the states it makes them from; the PM moves any story from any state to any other                                                                                                                                                                                          |
| `label sc-N --add … --remove …`                                                  | per `roles.OWN_LABELS`             | sends the union, so no other label is lost                                                                                                                                                                                                                                                                             |
| `report sc-N passed\|failed [--files …]`                                         | testers                            | uploads, posts the report, moves to Passsed QA or Failed QA, sets `qa passed` or `qa failed`                                                                                                                                                                                                                           |
| `edit sc-N\|epic-N --section S \| --dated T \| --replace OLD --with NEW [--dry]` | pm, ux (Design), bm, cd, linguists | replaces one section, or adds a dated one, leaving the rest as it was. `--replace` takes several targets and changes all or none: OLD must appear exactly once in each; `--dry` names what would change                                                                                                                |
| `new-story`, `new-epic`, `task`, `relate`, `archive`                             | per `roles.MAY`                    | a new story starts in Backlog unless the PM says otherwise; a new story needs `--epic` naming an open epic, and any role that files stories may make one; a new epic starts in Waiting for Owner Approval; the creative's carry `idea`, at most three open; `relate` on a pair already linked answers `already linked` |
| `pr-create --head B --title T`                                                   | developers, linguists, ops         | ready for review; only ops opens drafts                                                                                                                                                                                                                                                                                |
| `review N --pass\|--back --findings F`                                           | lead                               | one review: the summary from stdin, each `## path:line blocking\|should\|nit` block in F inline, and the pass or back line at the live head. A pass tells `[qa]` (`--qa`); back moves the story to In Progress and tells its developer                                                                                 |
| `resolve N <comment id> [--text]`                                                | lead                               | replies in the thread, then resolves it                                                                                                                                                                                                                                                                                |
| `pr-reply N <comment id>`                                                        | developers, linguists, lead, ops   | replies in the thread holding that comment, signed `(from role)` so the queue knows whose word it ends on                                                                                                                                                                                                              |
| `merge N`                                                                        | developers, linguists              | developer: only with the lead's pass at the live head, no open thread, green checks and MERGEABLE; merges with `--match-head-commit`, moves the story to Ready For QA and tells `[qa]` the merge commit. Linguist: its own locale files only, merge commit, branch deleted                                             |
| `to-qa sc-N`                                                                     | developers                         | for a PR that merged at a head the pass covers, carried over a merge of main included: Ready For QA, and `[qa]` told the merge commit                                                                                                                                                                                  |
| `pr-close N --text WHY`                                                          | developers, linguists, ops         | posts WHY on the pull request, then closes it unmerged. The builder of its story closes its own, the two developers each other's; the linguist alone a translation ticket's; ops any                                                                                                                                   |
| `rerun N \| --run ID`                                                            | developers, ops                    | reruns the failed jobs                                                                                                                                                                                                                                                                                                 |

## How work is found

- **`sync.py`** runs at most once a minute, whichever tick asks first. It does a full pass
  over the queue states every 15 minutes (Ready For Dev alone every 5), and otherwise refetches only the stories updated
  since yesterday whose `updated_at` changed. GitHub is one GraphQL query over the open and
  recently merged pull requests (about 13 points of the 5,000 an hour), and the last five
  runs on main.
- **When GraphQL is spent**, the sync reads the same pull requests over REST, which has its
  own hourly budget, and refetches only those whose `updated_at` or head changed, or whose
  checks were pending. REST cannot say whether a thread is resolved, so a known thread keeps
  what the last GraphQL sync saw and a new one counts as open. Reads and writes that REST
  does as well (`live`, files, diff, merge, pr-create, reviews, replies) always use REST;
  `checks` falls back to it. Only `resolve` needs GraphQL, and it says so rather than reply
  and fail. Every `gh` call names the repository, so `sq` works from any directory.
- **`work.py`** turns the stored stories and pull requests into work items, with no network
  calls. Each item has a fingerprint, such as `lead:review:#176@e9ced78:<moved_at>`, so
  finished work stays finished and a change makes a new item. Every move a role makes
  through `sq` is recorded with the `moved_at` it landed at, and a story a role moved into
  its own queue is no work for it; the same move by anyone else still is.
  A role takes its items in this order: anything on a story in Passed Code Review, Failed
  QA or Failed Code Review, a merged story's move to Ready For QA, and the lead's reviews
  and review threads (`FINISHING`); then
  comments; then pull request work; then reviews; then its queue; then sweeps.
  A developer's queue runs epic by epic (`work.epic_order`): by the epic's place in
  Shortcut's epic list, then the story's place in the story list, with stories in no epic
  last.
  Only an epic in progress offers its Ready For Dev stories (`work.held_epic`): one in To
  Do or Waiting for Owner Approval holds them, and they come back when it moves to In
  Progress. Epics are read on every sync, so the change reaches the queue within a minute.
- **`store.py`** holds the claims. A role holds one item at a time, a pooled item (Ready For
  QA, unlabelled Ready For Dev) goes to one role only, and a claim lapses after 90 minutes.

The database is `.git/soirely-roles/queue.db`, shared by every worktree and never committed.
`SQ_HOME` points it somewhere else, for trying changes against a copy.

## Running unattended

`sq run` is what the systemd timer runs every minute: it syncs, then starts one worker,
`claude -p` in a capped unit of its own, for each started role whose minute it is and that
has work. `machine.py` reads `~/.config/soirely/agents.json`, `runner.py` decides and
launches, `systemd.py` writes the units, `checkout.py` brings each checkout up to `main`
before a worker starts, `update.py` keeps the installed `sq` on a `main` CI passed, and
`runlog.py` records each run's cost and report in `<sq home>/runs/<role>.jsonl`. The
design, the commands and the guards are in [docs/agents](../../docs/agents/README.md).

## Tests

`npm run test:queue`. The write tests run against fakes and never reach Shortcut or GitHub.
