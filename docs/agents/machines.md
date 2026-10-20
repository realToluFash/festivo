# Machines

Where the agents run: the per-machine `agents.json`, setting up from a fresh clone on Linux
or a Mac, running agents on more than one computer without conflicts, and keeping every
checkout on the latest `main`.

**Status: agreed with the owner on 20 Oct.** #276 builds `agents.json`, `just agents` and
staying on `main`, for Linux. #279 builds more than one machine, ops on every machine and
the permission asks. The Mac is later work, and so is each line below marked _(later)_.

## `agents.json`

Each machine has its own file at `~/.config/soirely/agents.json`. It lives outside the
repository because it describes the machine, not the project. The repository ships
`agents.example.json`, and `just agents setup` creates the file from it.

```json
{
  "machine": "tolu-linux",
  "workspace": "~/personal",
  "mainCheckout": "festivo",
  "claudeConfigDir": "~/.claude-soirely",
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

| Field                                     | Meaning                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `machine`                                 | this machine's name, in the run log and `sq status`, and shown to other machines for the roles it holds                            |
| `workspace`                               | where checkouts live: each role's is `<workspace>/soirely-<role>`                                                                  |
| `mainCheckout`                            | the folder of the main checkout, developer 1's. `festivo` here; `soirely` on a fresh machine                                       |
| `roles`                                   | the roles this machine may run. A role not listed never ticks here                                                                 |
| `checkout`                                | per role: overrides the path for that one role                                                                                     |
| `standby`                                 | per role: runs here only while no other machine wants it. See [More than one machine](#more-than-one-machine)                      |
| `model`, `effort`                         | per role, or in `defaults`. See [Models and effort](#models-and-effort)                                                            |
| `memoryMax`, `maxRuntime`, `maxBudgetUsd` | per role, or in `defaults`. The budget is unset until the owner picks one                                                          |
| `claudeConfigDir`                         | required: the Claude config folder, and so the account, the workers use; per role as well. See [Claude accounts](#claude-accounts) |
| `claudeVersion`, `onVersionDrift`         | the pinned CLI version, and `"warn"` (default) or `"stop"` when it drifts. See [Guards](README.md#guards-and-alerts)               |
| `dailyBudgetUsd`                          | no new worker once today's spend reaches it. Unset until the owner picks one                                                       |
| `minFreeGb`                               | no new worker under this much free disk; 15 by default                                                                             |

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
- **A missing default stops every role.** The timer's `sq run` logs `error:` and starts
  nothing, and `sq status` says the same. The fix is to put `model` and `effort` back in
  `defaults`; `agents.example.json` has Opus 5.5 at medium. _(Later: a command that offers
  to write them.)_
- **A model above the default's price is pointed out.** `sq start` and `sq status` say so,
  for example `lead runs claude-fable-5-1, 2.5× the default per token`, so a costly choice
  is always deliberate.
- **A model the account cannot use** passes the check but fails its first run. That run's
  exit and reason go to the run log and `sq status`. Its item waits out the lapse like any
  other failed run, so it is not retried every minute.
- **Each run records its model and effort** in `runs/<role>.jsonl`, so a change can be
  measured against the default before it is kept.

Adding a model is a pull request to `models.json`, reviewed like any other change.

### Claude accounts

The roles can run under different Claude accounts, all the owner's own subscriptions. Each
account is a Claude config folder logged in to it, and a role names its folder:

```json
{
  "claudeConfigDir": "~/.claude",
  "roles": {
    "dev": { "claudeConfigDir": "~/.claude-b" },
    "qa": { "claudeConfigDir": "~/.claude-b" },
    "lead": {}
  }
}
```

A role's own folder wins, then the machine's. **`claudeConfigDir` is required**, like the
default model: a file without it stops every role with an `error:`, and nothing falls back
to a folder the file does not name. `agents.example.json` sets Claude's own default,
`~/.claude`, which runs as `claude` does with nothing set (its account file is
`~/.claude.json`, beside the folder). The owner's Linux machine keeps the agents apart from
their own sessions, so its file names `~/.claude-soirely`, set by hand.

**With `~/.claude`, the workers share the owner's settings and memory.** No permission
lands there: the workers' grants and denials are passed on each run's command line (see
[Permission asks](#permission-asks)), so the owner's own sessions are never widened or
denied by them. But what the owner's sessions allow, and remember, the workers see too. A
machine where the owner also works in Claude names a folder of its own, as this one does
with `~/.claude-soirely`.

- **Logging in, once per folder:** `CLAUDE_CONFIG_DIR=~/.claude-b claude` (plain `claude` for
  `~/.claude`), then
  `/login` with that account. `just agents setup` makes each folder the roles name, copies
  the default folder's `settings.json` into a new one, and says which folders still need a
  login. The copy is made once. A later setup overwrites nothing; it names each folder
  whose `settings.json` no longer matches the default's, so a rule added there is not
  silently missing from the others.
- **A folder with no login refuses its roles**, with the command to log in. The other
  roles keep running. `sq` reads only the account's email from `.claude.json`, never a
  token. On Linux the login is `.credentials.json` beside it; a Mac keeps it in the
  Keychain. _(To check with the Mac runner: that two folders keep two Keychain logins.)_
- **Each run records its account** in the run log, and `sq status` shows each role's
  account when the machine uses more than one.
- **Settings and memory are per folder; the workers' permissions are per machine.** What
  one account's sessions remember, the others do not see, so anything every role needs
  belongs in the repository, a story or an `sq` note.
- _(Later: an account at its usage limit holds only its own roles until the limit resets,
  rather than each of their runs failing.)_

### When no workspace is set

`just agents setup` asks. `just agents up`, `sq start` and the timer stop with an
`error:` that says to run it.

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

**The fix: what is shared lives in GitHub, which every machine sees**, as git references
under `refs/soirely/` in the repository. Each points at a small commit whose message holds
the record. Creating a reference that exists is refused, and moving one only succeeds from
the commit it was read at, so two machines can never both win.

| Reference                           | Holds                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `refs/soirely/machines/<machine>`   | the heartbeat: which roles this machine lists, has started, keeps standby |
| `refs/soirely/roles/<role>`         | the lease: the machine that runs this role                                |
| `refs/soirely/claims/<pool>/sc-<n>` | a story taken from a shared queue (`dev` or `qa`), and by which machine   |
| `refs/soirely/pause`                | the pause on every machine, and who set it                                |

Every minute `sq run` reads them all in one call, writes its heartbeat, and settles:

- **A role runs on one machine at a time.** A started role takes its lease if nobody holds
  it, and keeps it while it stays started. Another machine started with the same role ticks
  it not at all, and `sq status` and its journal say
  `dev: running on tolu-linux, last seen 20s ago`. A stopped role's lease is given back the
  same minute.
- **A lease lapses with its machine.** A machine whose heartbeat is 5 minutes old has gone
  quiet, and any machine started with its roles takes them over.
- **`standby` hands a role back.** A standby machine takes a role only while no live machine
  has started it as a first choice, and gives it back once its own worker is done, never in
  the middle of one.
- **A story is claimed in GitHub too**, before its worker starts. The developers share To
  Do and the testers share Ready For QA, even on different machines, so a story claimed on
  one is skipped on the other. A claim is given back when its worker finishes, and lapses
  after 90 minutes or when its machine goes quiet.
- **Pushes do not collide.** A story's branch belongs to its developer's label, so it is
  pushed from the one machine running that developer.
- **GitHub out of reach** (offline, or a rate limit) runs only the roles this machine held at
  its last good minute, with a `warning:`, so a dropped connection never starts a role twice.

**The file says what may run here; the lease decides what does.** A role listed on two
machines, neither as `standby`, is reported in `sq status` as a conflict: one machine runs
it and the other idles, which is rarely what the owner meant.

**Pausing every machine.** `sq pause --everywhere` writes the pause reference, and every
machine holds its roles from its next minute; `sq resume --everywhere` lifts it. A local
`sq resume` does not lift it, and says so. Paused machines keep their heartbeats and leases.

**Using two machines.** Split the roles: for example, developers, lead and ops on the Linux
machine, the testers, linguist and designer on the Mac. `sq start --all` on both is safe.
More capacity comes from more instances (`dev3`), never the same role twice. Stacks, ports
and simulators stay local to each machine; only leases and claims are shared. One read and
one write a minute per machine is well inside GitHub's rate limits.

**To check on the first run.** That GitHub accepts references outside `refs/heads`, and that
branch protection on `main` does not affect them. The tests cover the rules with a pretend
GitHub; the first `sq run` against the real one is the check, and `sq status` shows a
failure as the `could not reach the shared leases` warning. If GitHub refuses them, lock
branches under `soirely-locks/` give the same refuse-if-it-exists guarantee. Writing these
references to the shared repository is an outside change, part of what the owner approves
by merging #279.

### Ops on every machine

**Ops is the one role that runs on every machine**, because some of its work belongs to
one machine: disk and Docker cleanup, the stacks, and keeping the manager installed and up to
date. Ops never applies permissions: only the owner does (below). So ops is split in two:

| Part                   | Runs                                                 | Covers                                                                             |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ops@<machine>`        | on every machine, always listed in its `agents.json` | disk, build cache, stacks, the manager, the `claude` CLI version                   |
| ops, the shared duties | on one machine, by lease (`refs/soirely/roles/ops`)  | `main` going red, CI on pull requests, advisories, deploys, the permissions ticket |

**`ops` is required in every `agents.json`**: a file without it stops `sq run` with an
`error:`. Each minute, with no model, `sq run` checks the machine and files what it finds as
ops work of its own kind, `machine`, in the queue `ops@<machine>`:

| Check                                                   | Becomes                                          |
| ------------------------------------------------------- | ------------------------------------------------ |
| free disk under `minFreeGb`                             | urgent: free space so workers can start          |
| Docker's build cache over 20 GB (read every 30 minutes) | urgent: `just prune-build-cache`                 |
| once a day                                              | the sweep: disk, Docker, the stacks, the manager |

- **This machine's ops takes its machine work whoever holds the ops lease.** A machine
  without the lease runs ops for `ops@<machine>` items only.
- **A full disk holds every other role, but not this.** The disk guard is the one hold
  `ops@<machine>` may work through, since clearing it is the job. Any other hold (the daily
  cap, a paused machine) holds ops too.
- **It works only on its own machine**, and never runs a command on another computer. Its
  brief names the machine and says so.

The shared duties hold a lease like any other role, so two machines never both fix a red
`main` or open the same pull request.

## Permission asks

Some agents will need a command that their permission rules do not yet allow. Asks go to
one place, the owner decides each one, and **only the owner grants it**, by a command in a
terminal of their own.

Every role writes to Shortcut with the owner's API token and to GitHub as the owner's
user, so an agent's reply and the owner's look the same. A "yes" in a thread therefore
grants nothing. The grant is an act no agent can perform alone: the owner merging the pull
request and running the apply command.

**One standing Shortcut story, [sc-4992 "Agent permissions"](https://app.shortcut.com/soirely/story/4992)**,
holds every ask as its own comment thread. It stays in Backlog: nobody builds, tests or
closes it.

1. **A worker that is refused a command posts an ask** on that story with
   `sq <role> permission-ask --rule '<rule>' --for '<why>' --without '<what fails>'`,
   which fills in the format, the role and the machine:

   ```
   Permission ask (from dev2)
   Machine: tolu-mac
   Rule: Bash(xcrun simctl boot:*)
   For: booting the iOS simulator to test sc-3132 (the command it was refused)
   Without it: the iOS half of QA cannot run on this machine
   ```

   There is no owner tag, since the owner is not a role. The worker does not wait. It notes
   the ask on its story (`sq <role> note`), finishes what it can without the command, and
   moves on. The item comes back with the role's next pick.

2. **The owner answers in that thread**: yes, no, or an alternative, such as a narrower
   rule or a different command. The answer is a record of the decision, not the grant.
3. **Ops drafts the change.** An approved rule goes into `tools/queue/permissions.json`,
   with the roles it is for and the ask's comment, through a draft pull request.
   **Only the owner merges it**, even after the lead's pass: `sq` refuses to merge a pull
   request that touches `permissions.json`, for every role. A rejected ask stays in the
   thread, so the same ask is not posted again; `permission-ask` refuses a rule already
   asked for and prints the owner's answer, if there is one.
4. **The owner applies it on each machine** with `just agents permissions apply`, run in
   their own terminal. It reads `permissions.json` from `origin/main`, shows each rule it
   adds or removes and for which roles, and only after `yes` typed at the keyboard copies
   it to `~/.config/soirely/permissions.json` (mode 600). It refuses without a terminal and
   inside a worker. `just agents permissions` alone shows what is pending, and `sq status`
   says when `main` grants rules this machine has not applied. `just agents setup` offers
   the apply at the end.

**No Claude settings file is written by anyone.** Each worker is started with its role's
applied rules as `--allowedTools`, and with `--disallowedTools` for what no worker may do
whatever it was granted: the owner's `sq` commands, `just agents`, `systemctl --user`, and
editing `~/.config/soirely` or its Claude folder. Those guard against a worker that misreads
a thread; the boundary is that granting needs the owner at a keyboard.

## Starting the manager

**The manager is brought up to date every time it starts.** `just agents up` and
`sq start` do the following before any role ticks:

1. Check `agents.json` (workspace, roles, models and effort), and refuse what fails.
2. `git fetch`, then compare the installed `sq` with `tools/queue` on `origin/main`.
3. Reinstall `sq` if it differs, and only if CI is green on that commit. If it is not, or
   the fetch fails because the machine is offline, start on the installed version and say
   why.
4. Rewrite the systemd units if their text changed.

While running, `sq run` repeats steps 2–4 every ten minutes, and checks the `claude` CLI
against `claudeVersion` every run ([Guards](README.md#guards-and-alerts)). _(Later: the
launchd job on a Mac, and `sq status` showing the last failed check.)_ Permissions are
never applied here; see [Permission asks](#permission-asks).

## Staying on the latest `main`

Every worker starts from an up-to-date checkout. The script prepares it before the model
runs, so it costs no tokens.

| Role's situation                                                                                 | Before the worker starts                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No branch of its own (lead, product manager, designer, business manager, creative, ops, testers) | `git fetch`, then the checkout moves to the newest `origin/main`                                                                                        |
| Developer building (In Progress, Failed QA, Failed Code Review)                                  | `git fetch`, then `origin/main` is merged into the branch. No rebase, no force-push. A conflicting merge is undone and the worker is told to resolve it |
| Developer in review (In Review, Passed Code Review)                                              | `git fetch` only: merging `main` would void the lead's pass                                                                                             |
| Changes nobody committed (untracked files do not count)                                          | nothing is touched, and the worker is told. _(Later: `sq status` shows it too.)_                                                                        |

- Each worker's prompt starts with the `main` commit it was prepared against, so its report
  says which code it worked from.
- The skills come from the checkout, so updating the checkout updates the instructions.
- `sq` itself is reinstalled from `main` when `tools/queue` changes, and only once CI is
  green on that commit. A broken `sq` reaching `main` would otherwise stop every role on
  every machine at once. See [Starting the manager](#starting-the-manager).
