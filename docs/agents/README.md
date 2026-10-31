# Running the agents

How the Soirely roles (`/soirely-developer`, `/soirely-qa-tester` and the rest) run on their
own: what checks for work, what does it, what it costs, and the commands that start and
stop it all.

**Status: agreed with the owner on 20 Oct. The Linux runner is #276, more than one machine
is #279, the Mac runner is #280 and the workflow states are sc-5148; the rest is later work, marked where it is described.** Until a role is moved over, it runs as a `CronCreate`
routine inside an open Claude Code session (`role-routine`). Ops owns the work; it lands in
the pull requests listed under [Delivery](#delivery).

- [The roles](roles.md): each role, what it does, what wakes it, and where it works.
- [How work moves between roles](workflow.md): the Shortcut states, the labels and which
  role each one wakes.
- [Machines](machines.md): `agents.json`, Linux and Mac, running agents on more than one
  computer, and keeping every checkout on the latest `main`.

## The idea

**No model runs while there is nothing to do.** A plain script checks for work every
minute. A model starts only when the script finds some, and it stops when that piece of
work is done.

Measured from the role sessions on 18 Oct:

| Part                          | Cost   | Calls | Context per call |
| ----------------------------- | ------ | ----- | ---------------- |
| Hand-started runs             | $19.78 | 526   | 60k–107k         |
| Workers started by a tick     | $9.88  | 336   | 34k–104k         |
| Idle ticks that found nothing | $5.22  | 186   | 72k–171k         |

An idle tick costs about $0.03 to print `idle`, because it re-reads the role's whole
session. Ten roles ticking every three minutes is about $12 an hour of nothing. Workers are
already lean: each starts at 29k tokens and writes 15–40 tokens per call, so their cost is
the reading their work needs. Cutting that is cutting quality, so this design leaves
workers as they are and removes the ticks.

## The pieces

```
 timer, every minute                                       one per wake
 ┌───────────────────┐   wake:   ┌──────────────────────────────────────┐
 │ sq run            │ ────────▶ │ claude -p, in the role's checkout,   │
 │  sync once        │           │ the role's skill, one piece of work, │
 │  tick each role   │           │ ends with sq <role> done             │
 │  (no model)       │           └──────────────────────────────────────┘
 └───────────────────┘                      │ one JSON line per run
        idle / busy: nothing                ▼
                                   <sq home>/runs/<role>.jsonl
```

- **`sq run`** syncs Shortcut and GitHub once, then ticks each role this machine runs, in
  plain Python. `idle`, `busy` and `error:` start nothing.
- **A wake starts one worker**: a fresh `claude -p --permission-mode auto` run in that
  role's own checkout, with the same model, effort, skills and prompt as today's workers.
  It runs apart from the tick that started it, so it outlives it: as its own systemd unit
  on Linux, and on a Mac as a process in a session of its own, run by `sq worker-supervise`.
- **One worker per role at a time.** While a role's worker runs, its tick is skipped.
- **The run log.** Each run appends one line to `runs/<role>.jsonl`: time, item, exit code,
  cost, token usage and the worker's report. `sq status` shows the last report per role.
  This is how we know what each role costs, and whether a change saved anything.

## How long a worker lives

**One piece of work, then it exits.** One story built, one review, one test pass, one memo.
A story passes through several short workers on its way: the developer builds and opens the
pull request, the tech lead reviews, the developer merges, QA tests.

- A worker is stopped at **90 minutes**, the same as a claim's lapse. Its item stays
  claimed until the lapse, so a run that fails the same way every time is not retried
  every minute.
- Of the 22 workers recorded by 20 Oct, half finished in about 2 minutes and the longest, a
  QA pass, took 49. None was a developer build, so the run log is where we learn whether
  builds fit in 90 minutes. If they do not, the ceiling rises for developers only.

## Why workers start fresh

Starting fresh costs about $0.10–0.20: the 29k-token start, 18k of it already cached, plus
the story or pull request that `sq <role> next` prints.

Staying awake costs more. A session that keeps 70k tokens of earlier work re-reads them on
every call, about $0.21 over a typical 15-call item. It has to keep ticking to stay warm,
about $0.80 an hour while idle. After an hour of quiet its cache expires and the next call
re-writes the whole context, about $0.80. And it gets worse as it fills: old stories bleed
into new ones, and at 300k it is compacted anyway.

Within one item a worker keeps its context: it is one continuous run from claim to `done`.

## Context that outlives a worker

A worker's memory ends with it, so what matters is written where the next one reads it.

| Context                             | Where it lives                                |
| ----------------------------------- | --------------------------------------------- |
| What was asked, and the decisions   | the Shortcut story                            |
| Questions and answers between roles | tagged comment threads (`role-comments`)      |
| Code and review                     | the branch, its commits, the pull request     |
| What the last run learned           | `sq <role> done --note`, and `sq <role> note` |
| Lasting lessons                     | the memory files                              |

**Milestone notes.** A worker stopped part way, by its time or memory limit or a crash,
never writes its closing note. So a worker writes a short `sq <role> note` at each
milestone ("branch pushed, API done, web half done") and pushes its branch as it goes. A
stopped run then loses minutes, not the thread.

## Commands

| Command                                            | What it does                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `just agents setup`                                | checks prerequisites, asks for the workspace if unset, makes checkouts and stacks, installs the timer                                                                                                                                                                                                                         |
| `just agents up`                                   | starts the manager for the roles in this machine's `agents.json`                                                                                                                                                                                                                                                              |
| `just agents down`                                 | stops the manager, lets running workers finish (up to 10 minutes), stops the agent stacks                                                                                                                                                                                                                                     |
| `just agents down --now`                           | the same, stopping running workers at once and giving their items back                                                                                                                                                                                                                                                        |
| `sq start <role>` / `sq stop <role>`               | starts or stops one role on this machine                                                                                                                                                                                                                                                                                      |
| `sq status`                                        | each role here: started or stopped, its model, refused and why, or the machine it runs on; the manager; the last report                                                                                                                                                                                                       |
| `sq web`                                           | the same as `sq status`, as a live page at http://127.0.0.1:8765 that refreshes every 5 s, with the other machines' ([Each machine's page](machines.md#each-machines-page-on-the-others)); `--port`, `--listen`, `--no-open`                                                                                                  |
| `sq run --dry-run`                                 | syncs, then says which ready role would wake for what, started or not; starts nothing, installs nothing                                                                                                                                                                                                                       |
| `sq pause` / `sq resume`                           | no role ticks on this machine until resumed; running workers finish their item                                                                                                                                                                                                                                                |
| `sq pause --everywhere` / `sq resume --everywhere` | the same on every machine, through GitHub                                                                                                                                                                                                                                                                                     |
| `just agents permissions [apply]`                  | what `main` grants the workers that this machine has not applied; `apply` applies it, after a typed yes                                                                                                                                                                                                                       |
| `sq <role> permission-ask`                         | a worker's ask for a command it was refused, posted on sc-4992 ([Permission asks](machines.md#permission-asks))                                                                                                                                                                                                               |
| `sq ux to-draw` / `sq ux drawn` / `sq ux drawings` | an unattended ux run has no Artifact tool: it lists a story to draw with a prompt, shown on `sq web`; the manager draws the list itself, one story at a time, in a background session (`claude --bg`) under ux's account, which has the Artifact tool; `/soirely-designer` with no argument draws it too, one agent per story |
| `sq cost [--days N]`                               | what the workers cost, per day and role, from the run log                                                                                                                                                                                                                                                                     |

`just agents down` uses `docker compose down` without `-v`: databases and volumes are kept,
and `just agents up` comes back with the same data. Developer 1 works in the main checkout,
so its stack is the owner's own `soirely` stack; `down` stops it only when `dev` is listed
in this machine's file, and says so first.

`sq start`, `sq stop`, `sq pause`, `sq resume`, `sq run` and `just agents` refuse to run
inside a worker: its unit sets `SOIRELY_WORKER`, and `sq` prints `error:` and exits. That
guards against a worker that reads "stop the routine" in a thread and acts on it. It is not
a security boundary, since a worker with a shell could unset the variable. The boundary is
that workers are only ever asked to do their role's work, and what they run is in the run
log. Each worker is also started with these commands, `just agents`, `systemctl --user`
and edits of the config and Claude folders denied (`--disallowedTools`); that, too, guards
against a misreading rather than an attack.

## Limits

- **Memory.** Each worker has a ceiling: 3G by default, 8G for the QA testers, 16G for all
  workers together on Linux. These are starting values, tuned at the cut-over against
  `/proc/pressure/memory`. They exist because on 18 Oct systemd-oomd killed the owner's
  whole session over memory stall, with 25 GiB still free. Macs have no hard limit, so
  there each worker's supervisor checks its memory every 5 seconds and stops it over its
  `memoryMax`, as it does at its `maxRuntime`. The 16G for all workers together holds on
  Linux only.
- **Spending.** A per-run ceiling (`--max-budget-usd`) can be set per role in
  `agents.json`. No role has one until the owner picks a number.
- **No token, no tick.** The Shortcut token is read from `~/.config/soirely/env` (mode 600,
  outside the repository). Without it `sq run` prints `error:`, ticks nothing and never
  carries on from an old sync.

## Guards and alerts

Each guard holds new workers back; a worker already running finishes its item. Each is
printed on every run, for the journal, and told to the owner once (a desktop notification
through `notify-send`), not once a minute.

- **Disk.** Under `minFreeGb` free (15 by default) on the workspace's disk, no worker
  starts. BuildKit's cache has filled this disk before; `just prune-build-cache` is the
  usual way back.
- **Daily cap.** When the run log's spend for today reaches `dailyBudgetUsd`, no worker
  starts until midnight. Unset by default, like the per-run ceiling.
- **The claude version.** `claudeVersion` pins the CLI the workers were tested on. When the
  installed `claude --version` differs, every run prints a `warning:` naming both versions
  and saying to update `claudeVersion` once the new one is trusted, and the owner gets one
  notification per new version. The roles carry on, unless `onVersionDrift` is `"stop"`,
  which holds every role until the pin matches. Unset, nothing is pinned. Each run's log
  line records the version it ran on, so a change in quality can be traced to an update.
- **Waiting on the owner.** A report with a line that waits on the owner (a merge, a
  decision, a go-ahead) notifies the owner with that line, and `sq status` shows it until
  the role's next run.
- **A worker that ended without a report**, stopped by its time or memory limit or a crash,
  leaves a line in the run log saying why, and notifies the owner.
- **Pause.** `sq pause` holds every role on this machine, and `sq pause --everywhere`
  every role on every machine. A machine paused here still renews its leases, so a pause
  never hands its roles to another machine.

## Decided, 20 Oct

- **The check is a script, not a model.** Rejected: running the tick on a cheaper model
  (Haiku 5.5), and one dispatcher session ticking every role. Both cut idle to cents rather
  than zero, and both keep the open terminal and the seven-day expiry of `CronCreate`.
- **One timer for every role, each worker in its own unit.** Rejected: one timer per role,
  where ten syncs would race. Rejected: the worker as a child of the tick, because systemd
  stops a finished oneshot service's whole control group (systemd.kill(5)) and the worker
  would die with it.
- **Routines run while the owner is logged in.** Rejected: `loginctl enable-linger`, since
  Docker Desktop stops at logout and a worker woken then would find no stack.
- **Nothing is trimmed before it is measured.** No worker's model or effort is lowered
  until a week of the run log shows quality holds.
- **The workers are unattended `claude -p` runs, so building this waits for the owner's
  go-ahead in person.** Auto mode refused creating them once (sc-2784, #2834), so the
  owner will likely add a permission rule as well.

## Delivery

1. **The Linux runner**: `sq run`, `sq start` and `sq stop`, the systemd units, the run log,
   milestone notes, `agents.json` with its workspace, models and effort, `just agents`,
   keeping checkouts on `main`, the self-update, and the guards and alerts above. Tests run
   without systemd. Cut-over is one role at a time, ops first and measured over a quiet
   hour; each role's `CronCreate` job is deleted before its `sq start`, never both at once.
2. **More than one machine**, #279: the GitHub role leases and story claims,
   `ops@<machine>`, `sq pause --everywhere`, and the permission asks
   ([machines.md](machines.md)). Until GitHub is seen to accept the leases on a first run,
   run the agents on one machine only.
3. **The workflow**, sc-5148: the new Shortcut states, the QA labels and the wake fixes
   ([workflow.md](workflow.md)).
4. **The Mac**, #280: the launchd runner and `just agents setup` on macOS
   ([machines.md](machines.md#setting-up-from-a-fresh-clone)).

Story: sc-2864, which started as the product manager's idea; the owner gave it to ops on
20 Oct.
