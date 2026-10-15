# Contributing

## Getting set up

```bash
npm run setup          # node deps, PHP deps, git hooks, local env
docker compose up -d   # the stack
```

`npm run setup` reports what it did and what it skipped. PHP tooling runs in Docker —
you do not need PHP installed.

## Routines

```bash
brew install just      # once
just                   # list every routine, with what it does
```

The `Justfile` at the root is the front door for anything you run more than once — the
containers, the databases, the suites, the checks.

```bash
just up                      # start the stack and wait until it answers
just prepare-database-test   # drop, recreate and migrate the test database
just test-api                # the API suite  (just test-api RequestLocale for one class)
just check                   # everything CI runs
just guard                   # architectural boundaries
just prune-build-cache       # when Docker has eaten the disk
```

Each recipe delegates to the npm script where one exists, and CI calls those same scripts.
That is why there is no third definition of any routine, and why `just check` passing means
the same thing as a green pull request. `just` itself is not installed in CI, so the npm
scripts remain the contract.

### Testing a story by hand

```bash
just qa-account              # a throwaway account, registered through the API
just qa-ios                  # the app in Expo Go on a simulator
just qa-mobile sign-in       # one Maestro flow from apps/mobile/.maestro
just qa-chrome               # a browser with a debugging port, on its own profile
```

None of these run in CI, deliberately: they need a simulator, a browser and a person — or
an agent in QA mode.

An agent in QA mode does not use them here. `just qa-env setup` makes a second stack for
it: a worktree at `../soirely-qa` on the pushed head of the pull request under test, its own
containers and database, every port moved up by 10000, and its own simulators. A developer
running the suite and a QA pass stopping the API to test the offline state then never meet.
Start the QA session in `../soirely-qa`; `node .qa/bin/qa-env.mjs` from there does the rest. `.claude/skills/soirely-qa-tester` is what a pass does with them, how
the report is written, and where it is posted.

## The shape of the work

**An epic is a scope of work, not a stack.** "Auth" is one epic covering the Symfony
endpoints, the mobile screens and the web pages together. See
[docs/architecture/scopes.md](docs/architecture/scopes.md) for how the system is divided
and why.

**A story is a pull request.** If it cannot land as one reviewable PR, it is two stories.

`main` is always deployable and is never committed to directly.

## Branches

Shortcut generates the branch name, and using it is what makes a story move itself
through the workflow when the PR opens:

```
<username>/sc-<id>/<slug>
```

## Commits

One commit, one **outcome** — a thing that is now true for a user or the system. Not a
file, not a layer, not a step in your own process. A commit that adds a Doctrine field,
the endpoint that writes it and the screen that sets it is one commit; none of the three
stands up alone.

The subject line is checked by a hook:

```
type(scope): outcome in the imperative, lowercase, no full stop
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `build`, `ci`,
`revert`. The scope is a surface — `api`, `mobile`, `web`, `infra` — and is omitted on a
commit that genuinely spans several, which is the signal that it does.

Name the outcome, not the mechanism:

```
feat(api): refuse a route with no access policy      ✓
feat(api): add AccessPolicyAttribute                 ✗
```

The body explains **why** — the diff already says what. What was wrong, what this does
about it, and anything a reviewer would otherwise have to ask.

Stage explicitly by path. Never `git add -A` or `git add .`.

## Pull requests

Opened as **drafts**. The template's five headings all stay; a section that does not
apply gets `None.` rather than being deleted — an explicit "None" says you considered it.

Every PR is expected to carry tests.

### Merged as a merge commit, never squashed

The repository allows **merge commits only** — squash and rebase are both turned off.

The commits in a pull request are the unit of review, and squashing discarded them at the
moment they became useful. A reviewer reading `main` after a squash gets one commit with
one message for work that was deliberately split into several outcomes, and `git bisect`
can only ever land on a whole pull request.

What follows from that, and it is not optional:

- **Every commit must pass its own tests**, not just the tip. A bisect will check out the
  third of five commits, and a commit that fails for unrelated reasons makes the whole
  history unusable for finding anything. `making-commits` step 3 covers how to verify it.
- **A commit carries the tests for its own outcome.** No final "add tests" commit — that
  leaves every commit before it unverified.
- **Order by dependency.** A commit must make sense given only the commits before it.
- The merge commit itself takes the pull request's title and an empty body, so
  `git log --first-parent` reads as one line per outcome landed, and the full log still has
  every commit underneath it.

Rebase is off as well as squash: it replays the commits with new SHAs and loses which pull
request they arrived in.

## Hooks

The pre-commit hook formats and lints **staged files only**, so it stays fast. If it
fails on something your change did not introduce, check the same file on `main` first,
then use `--no-verify` and say so in the PR.
