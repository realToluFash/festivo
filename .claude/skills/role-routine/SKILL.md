---
name: role-routine
description: How a /soirely-* role keeps itself running — a three-minute tick that costs one shell command when nothing has changed, and a fresh worker agent when something has. Covers scheduling the routine at the end of a run started by hand, what the tick does, and how an unattended run behaves. Use at the end of every /soirely-* run started by hand, and in every run a routine woke.
user-invocable: false
---

# Roles as routines

Each role is always on. Once you start it by hand, it checks every three minutes for
something that needs it, and does the work only when there is some. The check, not the work,
is what runs every three minutes, so a quiet tick has to cost almost nothing.

Throughout, `sq` means `python3 <git common dir>/soirely-roles/sq/sq`, the copy that
`python3 tools/queue/sq install` puts where no branch switch removes it, and every command
names its role first: `sq <role> tick`, `sq fr next`, `sq dev2 done 41`.

- **The check is a script, not a reading.** `sq <role> tick` reads one SQLite
  file that a single sync fills from Shortcut and GitHub, at most once a minute, for every
  role at once. A quiet tick is one command and one word back: `idle`. No skill is loaded,
  no story is read, and no MCP call is made.
- **Only change wakes a role.** That means a story entering its queue, a comment addressed
  to it that no run has dealt with, or a pull request reaching a step that is the role's:
  - for the lead, a head no review covers;
  - for the developer, red checks, green checks to hand to review, a pass to merge, and a
    merge to move to Ready For QA;
  - for ops, `main` going red.

  A story that has sat in the queue since the last run does not wake it again, and nor does
  a story leaving the queue. `sq status` lists what each role holds and has waiting.

- **The work runs in a fresh agent.** A woken tick hands the work to a background agent,
  which loads the skill, does the run with a clean context and reports back. The session
  holding the routine stays small, so the thousands of quiet ticks each day stay cheap. Each
  run also starts clean, rather than carrying the last story's context into the next.
- **One run at a time, one piece of work per run.** A woken tick claims one work item for
  the role, and ticks answer `busy` until the worker finishes it. A claim not finished
  within 90 minutes lapses, and the item goes back to the queue. Testers share Ready For QA,
  and the two developers share unlabelled To Do stories, so one of them claims each story.
- **A heartbeat catches what change misses.** Some work nobody files, such as the
  designer's backlog sweep, the product manager's AC audit, ops' advisories and the business
  manager's stale costs. So after a quiet spell a sweeping role gets a sweep, and any other
  role with stories in its queue gets a pick, which lists the queue for the skill to choose
  from:

| Role                         | Woken by                                                              | Heartbeat                      |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------ |
| `/soirely-product-manager`   | `[pm]`, new in To Do or Failed QA                                     | 2 hours                        |
| `/soirely-designer`          | `[ux]`, new in To Do or Failed QA                                     | 2 hours                        |
| `/soirely-developer` (×2)    | its tag, new in Failed QA, In Progress, To Do; its PR's checks finish | 30 minutes, if work is waiting |
| `/soirely-qa-tester` (×3)    | its tag (`[qa]`, `[qa2]`, `[qa3]`), new in Ready For QA               | 30 minutes, if work is waiting |
| `/soirely-tech-lead`         | `[lead]`, new in In Review                                            | 30 minutes, if work is waiting |
| `/soirely-business-manager`  | `[bm]`, new in Backlog or To Do                                       | 12 hours                       |
| `/soirely-ops`               | `[ops]`, `main` red                                                   | 6 hours                        |
| `/soirely-linguist en`       | `[en]`, a translation ticket new in To Do, In Progress or Failed QA   | 2 hours                        |
| `/soirely-linguist es/fr/pt` | its tag, a translation ticket new in To Do, In Progress or Failed QA  | 30 minutes, if work is waiting |
| `/soirely-creative`          | `[cd]`                                                                | 24 hours                       |

The other roles' queues leave out stories labelled `translation`, which are the linguists'.
The two developers share To Do, but see only their own work beyond it: a story labelled
`dev2` is developer 2's, and any other is developer 1's. A bare `[dev]` comment, and a pull
request's checks, wake only the developer whose label the story carries.
A linguist's routine is scheduled per locale, with the locale as its role: `sq fr tick`.

The sync reads Shortcut through `SHORTCUT_API_TOKEN`, the owner's API token from Shortcut,
Settings, API Tokens, exported in `~/.zshrc`, and GitHub through `gh`. When either fails,
ticks carry on from the last good sync, and `sq status` shows the error.

## 1. Scheduling, at the end of a run started by hand

A run the owner started, as opposed to one a tick woke, ends by making sure its routine
exists. Do this after the report, every time; it takes three steps and stops at the first
that says it is already done.

1. **`CronList`.** A job whose prompt starts `Soirely <role> routine` means it is already
   scheduled. Say so in one line and stop.
2. **`python3 tools/queue/sq install`**, from the checkout you are in. It copies `sq` to
   `<git common dir>/soirely-roles/sq/`, which no branch switch can remove, and prints the
   installed path. The first install also counts every comment already on a story as dealt
   with, so the first ticks start from what arrives next.
3. **`CronCreate`** with `cron: "*/3 * * * *"`, `recurring: true`. QA testers 2 and 3 use
   `"1-59/3 * * * *"` and `"2-59/3 * * * *"`, so the three reach the queue a minute apart,
   and developer 2 uses `"1-59/3 * * * *"` for the same reason. The prompt is below; fill
   in your role (a tester's is `qa`, `qa2` or `qa3`, a developer's `dev` or `dev2`, a
   linguist's its locale) and the installed path the previous step printed:

   ```text
   Soirely <role> routine tick. Run `python3 <git common dir>/soirely-roles/sq/sq <role> tick`
   and nothing else.
   If it prints one word (idle or busy), reply with that word only: stop there.
   If it prints a line starting "error:", reply with that line only.
   If it prints "wake:", start one background general-purpose Agent whose prompt is
   everything after the "---" line, and reply with the wake line only.
   When that Agent finishes, relay its report in five lines or fewer.
   ```

Then tell the owner three things, in one short paragraph:

- when the next tick fires;
- that the routine lives in this session, so this terminal stays open;
- that it expires after seven days, and running the role by hand again renews it.

The owner stops a routine by saying so. Use `CronDelete`.

## 2. The tick

A tick follows its prompt to the letter. One command, and one line back. A quiet tick calls
no other tool: no `CronList`, no story lookup, no summary of what it did. The script
remembers between ticks, so you do not need to.

`idle` and `busy` mean stop. Only `wake` starts a worker, and the worker, not the tick,
finishes the item with `sq <role> done`. When a worker reports back, relay the report and
nothing more. The worker's tool output never enters this session.

## 3. An unattended run

The worker is the role's own skill, run as usual, with these differences. Nobody is
watching, so:

- **Start with `sq <role> next`.** It prints what the work item needs, by its kind (an
  inbox's open threads in full, a story's AC, a pull request's status and open threads), and
  ends with `Next:`, the commands to act with, ids filled in. Something you already read
  prints as a one-line reference with your notes on it; `--again` prints it in full, and only
  when you truly need it. Do not fetch anything with the Shortcut tools or `gh`.
- **Work through `sq <role>`.** `sq <role> help` lists every read and write the role may
  run; each write checks the story or pull request fresh and says why it refused. The
  comment header, the reply threading, label unions and state names are all done for you.

- **One piece of work, then stop.** One story built, one pull request reviewed, one story
  tested, one memo. Whatever else is waiting is already queued, and the next tick starts a
  fresh worker for it. Several small runs beat one long run whose context fills with the
  first story.
- **Never wait for an answer.** Wherever the skill says to ask or to show the owner first,
  do not stop. A question for another role is a tagged comment (`role-comments`). A decision
  only the owner can make — merging, Done, money, production, anything the skill reserves
  for them — goes in the report, and the run moves on to work that does not depend on it. A
  run that can do nothing without that decision says so and stops.
- **An empty run is one line.** If the reason it woke turns out to need nothing, say so and
  finish. Do not go looking for work to justify the wake.
- **Stay out of each other's checkouts.** The routines run side by side:
  - Only developer 1 switches branches in `~/Projects/soirely`, and only developer 2 in
    `~/Projects/soirely-dev2`.
  - QA tester N works in `~/Projects/soirely-qa<n>` (its skill, section 4).
  - Ops works in its own worktree, `../soirely-ops`.
  - Each linguist works in its own worktree, `../soirely-<locale>`.
  - The tech lead, product manager, designer, business manager and creative director read
    code at a pull request's head with `sq <role> diff <pr> [paths…]` and
    `git show origin/<branch>:<path>`, and never check anything out.
- **The report is ten lines at most.** What you did, which stories moved, the questions
  you left and where, and anything waiting on the owner. The evidence lives on the story
  and the pull request, not in the report.
- **Last step, always: `sq <role> done <id> --note "<one line>"`.** It retires the item and
  the comments it covered, and the note is what your next run on the story sees. A run that
  could not finish still runs it, with a note that says why. A story
  still in the queue comes back with the role's next pick, and a released item would only
  wake the next tick into the same wall.
