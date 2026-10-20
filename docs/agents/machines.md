# Machines

Where the agents run: the per-machine `agents.json`, setting up from a fresh clone on Linux
or a Mac, running agents on more than one computer without conflicts, and keeping every
checkout on the latest `main`.

**Status: agreed with the owner on 20 Oct, not yet built.**

## `agents.json`

Each machine has its own file at `~/.config/soirely/agents.json`. It lives outside the
repository because it describes the machine, not the project. The repository ships
`agents.example.json`, and `just agents setup` creates the file from it.

```json
{
  "machine": "tolu-linux",
  "workspace": "~/personal",
  "mainCheckout": "festivo",
  "roles": {
    "dev": {},
    "dev2": {},
    "ops": {},
    "qa": { "memoryMax": "8G" },
    "qa2": { "standby": true },
    "lead": { "effort": "high" },
    "ux": { "checkout": "~/design/soirely-ux" }
  },
  "defaults": {
    "model": "claude-opus-5-5",
    "effort": "medium",
    "memoryMax": "3G",
    "maxRuntime": "90m",
    "maxBudgetUsd": null
  }
}
```

| Field                                     | Meaning                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `machine`                                 | this machine's name, shown to other machines that try to start a role it holds               |
| `workspace`                               | where checkouts live: each role's is `<workspace>/soirely-<role>`                            |
| `mainCheckout`                            | the folder of the main checkout, developer 1's. `festivo` here; `soirely` on a fresh machine |
| `roles`                                   | the roles this machine may run. A role not listed never ticks here                           |
| `checkout`                                | per role: overrides the path for that one role                                               |
| `standby`                                 | per role: runs here only while no other machine holds it                                     |
| `model`, `effort`                         | per role, or in `defaults`. See [Models and effort](#models-and-effort)                      |
| `memoryMax`, `maxRuntime`, `maxBudgetUsd` | per role, or in `defaults`. The budget is unset until the owner picks one                    |

- **Changes take effect within a minute.** `sq run` reads the file every minute. A removed
  role's running worker finishes its item and takes no more.
- **`~` is expanded**, so one file works for any user name, on Linux or a Mac.
- **Links are followed.** On this machine `~/Projects` links into `~/personal`, so either
  works as the workspace. `~/personal` is preferred, so paths show where files really are.
- **Mistakes are refused, never guessed.** An unknown role stops `sq run` with an `error:`
  naming the role and the file. A role whose checkout is missing is skipped, and `sq status`
  names the path it expected. A changed `workspace` moves nothing: each role not at the new
  path is reported, and `just agents setup` offers fresh checkouts there. It never moves or
  deletes old ones, which may hold work nobody committed.

### Models and effort

**The default is Claude Opus 5.5 at medium effort, and it is read from the file**:
`defaults.model` and `defaults.effort`. `sq` has no default of its own; the shipped
`agents.example.json` carries `claude-opus-5-5` and `medium`. A role sets `model` or
`effort` to differ from the default, and only that role changes.

**Safeguards.** A typo in a model or effort is the costliest mistake this file can hold, so
each is checked against a list in the repository, `tools/queue/models.json`: every model id
`sq` accepts, with the effort levels that model takes.

- **Exact ids only.** `claude-opus-5-5`, never `opus` or a date-suffixed id. An alias can
  start pointing at another model with no commit, which is a change nobody reviewed.
- **The effort must be one that model takes.** For the current Opus, Sonnet, Haiku and Fable
  models that is `low`, `medium`, `high`, `xhigh` or `max`.
- **A role whose model or effort fails the check is refused, never run on a guess.** It
  starts no worker. `sq status` and the log name the role, the field, the value, and the
  accepted values. The other roles keep running. A bad `defaults` refuses every role that
  relies on it, since running them on anything else would be a guess.
- **A missing default is treated like a missing workspace.** The timer's `sq run` logs
  `error:` and starts nothing. A command the owner runs offers to write Opus 5.5 at medium
  into the file.
- **A model above the default's price is pointed out.** `sq start` and `sq status` say so,
  for example `lead runs claude-fable-5-1, 2.5× the default per token`, so a costly choice
  is always deliberate.
- **A model the account cannot use** passes the check but fails its first run. That run's
  exit and reason go to the run log and `sq status`. Its item waits out the lapse like any
  other failed run, so it is not retried every minute.
- **Each run records its model and effort** in `runs/<role>.jsonl`, so a change can be
  measured against the default before it is kept.

Adding a model is a pull request to `models.json`, reviewed like any other change.

### When no workspace is set

A command the owner runs (`just agents setup`, `just agents up`, `sq start`) asks:

```
No workspace is set in ~/.config/soirely/agents.json.
Where should the agents' checkouts live? [~/Projects]: ~/personal

  ~/personal exists. Role checkouts will be created here as soirely-<role>,
  for the 6 roles in this file (about 1 GB each, 92 GB free).
  Save "workspace": "~/personal" and continue? [Y/n]
```

- The default offered is `~/Projects` if it exists, otherwise `~/soirely`.
- A path that does not exist is offered for creation; one that cannot be written to is
  asked again; too little disk for the listed roles is said before anything is created.
- The answer is saved, so each machine is asked once. `--workspace <path>` answers without
  asking, for scripts.

The timer's `sq run` never asks and never guesses. It logs
`error: no workspace in ~/.config/soirely/agents.json; run just agents setup`, ticks no role
and starts no worker. `sq status` shows the same line.

## Setting up from a fresh clone

`just agents setup` does everything after `git clone`:

1. **Checks prerequisites**: `claude` signed in, `gh` signed in, Docker, Python 3, and the
   Shortcut token in `~/.config/soirely/env` (mode 600). It names what is missing and stops.
2. **Asks for the workspace** if none is set, as above.
3. **Makes each listed role's checkout and stack** with `just dev-env setup --role <role>`.
4. **Installs the runner for this system.** The `sq` commands are the same on both.

|                                   | Linux                              | Mac                                                                    |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Timer every minute                | systemd user timer                 | launchd agent, `StartInterval 60`                                      |
| Each worker                       | its own unit, `systemd-run --user` | its own launchd job                                                    |
| Worker memory ceiling             | hard, by systemd (`MemoryMax`)     | none in the system: `sq run` watches and stops a worker over its limit |
| Stops at logout, resumes at login | yes                                | yes                                                                    |

The tests cover both versions without either system installed.

## More than one machine

**The risk.** Claims live in a SQLite file on each machine. Two machines would each claim the
same story: two workers building one story on one branch, comments posted twice, one story
tested twice.

**The fix: claims live in GitHub, which every machine sees.**

- **A role runs on one machine at a time.** `sq start dev` takes a lease, a git reference
  such as `refs/soirely/roles/dev` naming the machine, renewed every minute. Creating a
  reference that exists is refused, so only one machine can hold it. Another machine's
  `sq start dev` prints `dev is running on tolu-linux, last seen 20s ago` and starts
  nothing. A lease not renewed for 5 minutes lapses, and a standby machine takes over.
- **A story is claimed in GitHub too**, as `refs/soirely/claims/sc-<id>`, with the 90-minute
  lapse. This matters because the developers share Ready For Dev and the testers share
  Ready For QA, even when they run on different machines.
- **Pushes do not collide.** A story's branch belongs to its developer's label, so it is
  pushed from the one machine running that developer.

**The file says what may run here; the lease decides what does.** If two machines' files
list the same role, only one runs it, and `sq status` on each says which. A role listed on
two machines without `standby` is also reported as a conflict.

**Using two machines.** Split the roles: for example, developers, lead and ops on the Linux
machine, the testers, linguist and designer on the Mac. `sq start --all` on both is safe.
More capacity comes from more instances (`dev3`), never the same role twice. Stacks, ports
and simulators stay local to each machine; only claims are shared. Two machines syncing once
a minute is well inside Shortcut's and GitHub's rate limits.

**To check before relying on it.** That GitHub accepts references outside `refs/heads`; if it
does not, lock branches under `soirely-locks/` through GitHub's API give the same
refuse-if-it-exists guarantee. And that branch protection on `main` does not affect them.
Writing locks to the shared repository is an outside change, part of what the owner
approves with the pull request.

### Ops on every machine

**Ops is the one role that runs on every machine**, because some of its work belongs to
one machine: disk and Docker cleanup, the stacks, keeping the manager installed and up to
date, and applying approved permissions. So ops is split in two:

| Part                   | Runs                                                 | Covers                                                                             |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ops@<machine>`        | on every machine, always listed in its `agents.json` | disk, build cache, stacks, the manager, the `claude` CLI version, permissions here |
| ops, the shared duties | on one machine, by lease (`refs/soirely/roles/ops`)  | `main` going red, CI on pull requests, advisories, deploys, the permissions ticket |

The shared duties hold a lease like any other role, so two machines never both fix a red
`main` or open the same pull request. Each machine's ops works only on its own machine;
it never runs a command on another computer.

## Permission asks

Some agents will need a command that their permission rules do not yet allow. Asks go to
one place, the owner decides each one, and every machine's ops applies the answer.

**One standing Shortcut story, "Agent permissions"**, holds every ask as its own comment
thread.

1. **A worker that is refused a command posts an ask** on that story with
   `sq <role> permission-ask`, which fills in the format:

   ```
   [owner] Permission ask from dev2 on tolu-mac
   Rule: Bash(xcrun simctl boot:*)
   For: booting the iOS simulator to test sc-3132 (the command it was refused)
   Without it: the iOS half of QA cannot run on this machine
   ```

   The worker does not wait. It notes the ask on its story (`sq <role> note`), finishes
   what it can without the command, and moves on. The item comes back with the role's next
   pick.

2. **The owner answers in that thread**: yes, no, or an alternative, such as a narrower
   rule or a different command. Only the owner's own reply counts as a decision. An agent's
   comment saying yes never does.
3. **Ops records the decision in the repository.** An approved rule goes into
   `tools/queue/permissions.json`, through a pull request that names the ask's comment.
   That file, on merged `main`, is the only list ops ever applies. A rule that is in the
   file but not approved by the owner on the ticket is never applied. A rejected ask stays
   in the thread, so the same ask is not posted again; `permission-ask` refuses a rule
   already answered and points to the answer.
4. **Every machine's ops applies the file.** `ops@<machine>` writes each rule in
   `permissions.json` into that machine's Claude settings, and replies in the ask's thread
   `Applied on tolu-linux`. A new machine applies the whole file at setup, so it catches up
   on every past decision.

The file says which roles each rule is for, so a rule approved for the testers is not
handed to every role.

## Starting the manager

**The manager is brought up to date every time it starts.** `just agents up`,
`sq start` and setup all do the following before any role ticks:

1. `git fetch`, then compare the installed `sq` with `tools/queue` on `origin/main`.
2. Reinstall `sq` if it differs, and only if CI is green on that commit. If it is not, start
   on the installed version and say why.
3. Regenerate the systemd units or the launchd job if their templates changed.
4. Check the `claude` CLI against the version pinned in `agents.json`.
5. Apply `permissions.json` from `main`.
6. Check `agents.json` (workspace, roles, models and effort), and refuse what fails.

If the machine is offline, the manager starts on what is installed, and `sq status` says it
could not check. While running, `ops@<machine>` repeats steps 1–5 whenever `main` changes.

## Staying on the latest `main`

Every worker starts from an up-to-date checkout. The script prepares it before the model
runs, so it costs no tokens.

| Role's situation                                                                                 | Before the worker starts                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No branch of its own (lead, product manager, designer, business manager, creative, ops, testers) | `git fetch`, then the checkout moves to the newest `origin/main`                                                                                        |
| Developer building (In Progress, Failed QA, Failed Code Review)                                  | `git fetch`, then `origin/main` is merged into the branch. No rebase, no force-push. A conflicting merge is undone and the worker is told to resolve it |
| Developer in review (In Review, Passed Code Review)                                              | `git fetch` only: merging `main` would void the lead's pass                                                                                             |
| Changes nobody committed                                                                         | nothing is touched; the worker is told, and `sq status` shows it                                                                                        |

- Each worker's prompt starts with the `main` commit it was prepared against, so its report
  says which code it worked from.
- The skills come from the checkout, so updating the checkout updates the instructions.
- `sq` itself is reinstalled from `main` when `tools/queue` changes, and only once CI is
  green on that commit. A broken `sq` reaching `main` would otherwise stop every role on
  every machine at once. See [Starting the manager](#starting-the-manager).
