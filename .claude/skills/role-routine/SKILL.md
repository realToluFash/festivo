---
name: role-routine
description: How a /soirely-* role keeps itself running — a three-minute tick that costs one shell command when nothing has changed, and a fresh worker agent when something has. Covers scheduling the routine at the end of a run started by hand, what the tick does, and how an unattended run behaves. Use at the end of every /soirely-* run started by hand, and in every run a routine woke.
user-invocable: false
---

# Roles as routines

Each role is always on. Once you start it by hand, it checks every three minutes for
something that needs it, and does the work only when there is some. The check, not the work,
is what runs every three minutes, so a quiet tick has to cost almost nothing:

- **The check is a script, not a reading.** `scripts/role-tick.mjs` asks Shortcut and
  GitHub what changed since the last tick, entirely in shell. A quiet tick is one command
  and one word back: `idle`. No skill is loaded, no story is read, and no MCP call is made.
- **Only change wakes a role.** That means a story entering its queue, a comment addressed
  to it, a pull request's checks finishing (developer), or `main` going red (ops). A story
  that has sat in the queue since the last run does not wake it again, and nor does a story
  leaving the queue.
- **The work runs in a fresh agent.** A woken tick hands the work to a background agent,
  which loads the skill, does the run with a clean context and reports back. The session
  holding the routine stays small, so the thousands of quiet ticks each day stay cheap. Each
  run also starts clean, rather than carrying the last story's context into the next.
- **One run at a time.** While a worker is going, ticks answer `busy`. A run still marked
  as going after three hours counts as dead, and the next tick replaces it.
- **A heartbeat catches what change misses.** Some work nobody files, such as the
  designer's backlog sweep, the product manager's AC audit, ops' advisories and the business
  manager's stale costs. Some runs also die before they finish. So each role wakes after a
  quiet spell anyway, if it has work waiting or is a sweeping role:

| Role                        | Woken by                                                               | Heartbeat                      |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `/soirely-product-manager`  | `[pm]`, new in To Do or Failed QA                                      | 2 hours                        |
| `/soirely-designer`         | `[ux]`, new in To Do or Failed QA                                      | 2 hours                        |
| `/soirely-developer`        | `[dev]`, new in Failed QA, In Progress, To Do; a PR's checks finishing | 30 minutes, if work is waiting |
| `/soirely-qa-tester`        | `[qa]`, new in Ready For QA                                            | 30 minutes, if work is waiting |
| `/soirely-tech-lead`        | `[lead]`, new in In Review                                             | 30 minutes, if work is waiting |
| `/soirely-business-manager` | `[bm]`, new in Backlog or To Do                                        | 12 hours                       |
| `/soirely-ops`              | `[ops]`, `main` red                                                    | 6 hours                        |

The check reads Shortcut through `SHORTCUT_API_TOKEN`, the owner's API token from Shortcut,
Settings, API Tokens, exported in `~/.zshrc`. Without it the check sees only GitHub and the
heartbeat. The routine still works, but stories wait up to a heartbeat and some runs find
nothing. Say so when you schedule.

## 1. Scheduling, at the end of a run started by hand

A run the owner started, as opposed to one a tick woke, ends by making sure its routine
exists. Do this after the report, every time; it takes three steps and stops at the first
that says it is already done.

1. **`CronList`.** A job whose prompt starts `Soirely <role> routine` means it is already
   scheduled. Say so in one line and stop.
2. **`node scripts/role-tick.mjs <role> --install`**, from the checkout you are in. It copies
   the script to `.git/soirely-roles/`, which no branch switch can remove. It also records
   what is waiting now, so the first tick does not redo the run you just finished.
3. **`CronCreate`** with `cron: "*/3 * * * *"`, `recurring: true` and this prompt, with your
   role tag and the installed path the previous step printed:

   ```text
   Soirely <role> routine tick. Run `node <path> <role>` and nothing else.
   If it prints one word (idle or busy), reply with that word only.
   If it prints a line starting "error:", reply with that line only.
   If it prints "wake:", start one background general-purpose Agent whose prompt is
   everything after the "---" line, and reply with the wake line only.
   When that Agent finishes, run `node <path> <role> --done` and relay its report in five
   lines or fewer.
   ```

Then tell the owner three things, in one short paragraph:

- when the next tick fires;
- that the routine lives in this session, so this terminal stays open;
- that it expires after seven days, and running the role by hand again renews it.

Add a line if the install said Shortcut is not checked.

The owner stops a routine by saying so. Use `CronDelete`.

## 2. The tick

A tick follows its prompt to the letter. One command, and one line back. A quiet tick calls
no other tool: no `CronList`, no story lookup, no summary of what it did. The script
remembers between ticks, so you do not need to.

When a worker reports back, run `--done` even if the report says it already did; a second
`--done` is harmless, and a missed one makes the role look busy for three hours. Relay the
report and nothing more. The worker's tool output never enters this session.

## 3. An unattended run

The worker is the role's own skill, run as usual, with these differences. Nobody is
watching, so:

- **Start with why it woke.** The brief names the stories, comments and pull requests that
  woke it. Deal with those, then follow the skill's usual order.
- **One piece of work, then stop.** One story built, one pull request reviewed, one story
  tested, one memo. If more is waiting that you could do now, finish with `--done --more`,
  and the next tick starts a fresh worker for it. Several small runs beat one long run whose
  context fills with the first story.
- **Never wait for an answer.** Wherever the skill says to ask or to show the owner first,
  do not stop. A question for another role is a tagged comment (`role-comments`). A decision
  only the owner can make — merging, Done, money, production, anything the skill reserves
  for them — goes in the report, and the run moves on to work that does not depend on it. A
  run that can do nothing without that decision says so and stops.
- **An empty run is one line.** If the reason it woke turns out to need nothing, say so and
  finish. Do not go looking for work to justify the wake.
- **Stay out of each other's checkouts.** The routines run side by side:
  - Only the developer switches branches in `~/Projects/soirely`.
  - QA works in `~/Projects/soirely-qa` (its skill, section 4).
  - Ops works in its own worktree, `../soirely-ops`.
  - The tech lead, product manager, designer and business manager read code at a pull
    request's head with `gh pr diff` and `git show origin/<branch>:<path>`, and never check
    anything out.
- **The report is ten lines at most.** What you did, which stories moved, the questions
  you left and where, and anything waiting on the owner. The evidence lives on the story
  and the pull request, not in the report.
- **Last step: `--done`.** `node <path> <role> --done`, with `--more` if work is still
  waiting.
