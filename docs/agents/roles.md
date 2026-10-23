# The roles

Twelve roles, run by nine skills. Each is one agent with its own `sq` name, its own queue
and, where it changes code, its own checkout. `sq <role> help` lists what a role may run,
and `ROLES` in `tools/queue/soirely_queue/roles.py` is the source of truth for queues and
heartbeats.

| Role   | Skill (how it is invoked)   | What it does                                                                                                                                        | Woken by                                                                                           | Works in                               |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `pm`   | `/soirely-product-manager`  | Answers the other roles' questions, writes and sharpens stories and epics so QA can test them, and records each decision with what was rejected.    | `[pm]`, a story new in To Do; every 2 hours                                                        | reads only                             |
| `ux`   | `/soirely-designer`         | Sweeps the backlog for stories that need design, draws the missing screens as one artifact per epic, and links each story to its artboard.          | `[ux]`, a story new in Needs Design; every 2 hours                                                 | reads only                             |
| `dev`  | `/soirely-developer`        | Developer 1. Builds a story across the API, the web client and the app, opens the pull request, merges it after the lead's pass.                    | `[dev]` on its stories, Failed Code Review, Failed QA, In Progress, Ready For Dev, its PR's checks | `~/Projects/soirely`                   |
| `dev2` | `/soirely-developer dev2`   | Developer 2, the same work on stories labelled `dev2`. The two share unlabelled Ready For Dev stories, one claiming each.                           | `[dev2]`, as `dev`                                                                                 | `~/Projects/soirely-dev2`              |
| `qa`   | `/soirely-qa-tester`        | Tester 1. Tests a story against its AC on the API, the web and the app on simulators, hunts edge cases, and passes or fails it.                     | `[qa]`, a story new in Ready For QA                                                                | `~/Projects/soirely-qa`, its own stack |
| `qa2`  | `/soirely-qa-tester qa2`    | Tester 2. The three testers share Ready For QA, one claiming each story.                                                                            | `[qa2]`, as `qa`                                                                                   | `~/Projects/soirely-qa2`               |
| `qa3`  | `/soirely-qa-tester qa3`    | Tester 3.                                                                                                                                           | `[qa3]`, as `qa`                                                                                   | `~/Projects/soirely-qa3`               |
| `lead` | `/soirely-tech-lead`        | Reviews every pull request before QA: the AC against the diff, the house skills, security and tests. Passes it or sends it back; merges nothing.    | `[lead]`, a pull request head no review covers                                                     | reads only, at the PR's head           |
| `bm`   | `/soirely-business-manager` | Pricing, unit economics, costs, the market and go-to-market. Writes decision memos with sourced numbers; the owner signs off money calls.           | `[bm]`, a story new in Backlog; every 12 hours                                                     | reads only                             |
| `ops`  | `/soirely-ops`              | CI on `main`, the stacks, deploys when the owner asks, disk, dependencies and images, and the agent runner. Files and merges its own `ops` stories. | `[ops]`, `main` red, its `ops` stories and their PRs; every 6 hours                                | `~/Projects/soirely-ops`               |
| `l10n` | `/soirely-linguist`         | One role for all four locales: owns the English source copy and writes es, fr and pt, on screens, emails, SMS and push. Merges its own PRs.         | `[l10n]` (or `[en]` `[es]` `[fr]` `[pt]`), a `translation` story; every 2 hours                    | `~/Projects/soirely-l10n`              |
| `cd`   | `/soirely-creative`         | Proposes UX ideas grounded in a real problem, each a Backlog story labelled `idea` with a safe, a bold and a moonshot version.                      | `[cd]`; every 24 hours                                                                             | reads only                             |

The other roles' queues leave out stories labelled `translation` (the linguist's) and `ops`
(ops' own infrastructure work). Who builds and merges a story is decided by its label: `dev2`
is developer 2's, `ops` is ops', `translation` is the linguist's, and anything else is
developer 1's.

## Ops on each machine

Ops is the one role every machine runs, because some of its work belongs to the machine it
runs on. So it is split in two:

- **`ops@<machine>`**, one per machine and always listed in that machine's `agents.json`:
  disk and the build cache, the role stacks, the manager's install and self-update, and
  the `claude` version against its pin. It works only on its own machine and never runs a
  command on another computer.
- **`ops`, the shared duties**, on whichever one machine holds its lease: `main` going red,
  CI on pull requests, advisories, deploys, and the permission asks on sc-4992.

How each machine finds its own ops work is in
[Ops on every machine](machines.md#ops-on-every-machine).

## The owner

Not a role, and no agent acts for them. The owner alone merges a change to
`permissions.json` and applies it, deploys to production, spends money, and makes the
calls a skill reserves for them. Every agent writes with the owner's Shortcut token and
GitHub user, so a comment's `(from <role>)` header, not its author, says which role wrote
it.
