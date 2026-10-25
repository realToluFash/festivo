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
just phone                   # the app in Expo Go on your own phone, at the latest main
just qa-mobile sign-in       # one Maestro flow from apps/mobile/.maestro
just qa-chrome               # a browser with a debugging port, on its own profile
```

`just phone` moves a detached checkout to the latest `main`, starts its stack so a phone on
the same Wi-Fi can reach it, and runs Metro there. It prints the Expo Go build for this SDK,
the `exp://` address to enter, where email and SMS codes land, and the firewall rule to open
when nothing loads. Run it from `../soirely-ops`, never a checkout with a branch in progress.

None of these run in CI, deliberately: they need a simulator, a browser and a person — or
an agent in QA mode. `.claude/skills/soirely-qa-tester` is what a pass does with them, how
the report is written, and where it is posted.

An agent in QA mode does not use them here. There are three QA testers, and
`just qa-env setup --tester N` makes a stack for tester N. Each stack is a worktree at
`../soirely-qa`, `../soirely-qa2` or `../soirely-qa3` on the pushed head of the pull request
under test, with its own containers and database, every port moved up by N×10000, and its
own simulators, or Android emulators on a host without Xcode. A developer running the suite and a QA pass stopping the API to test the
offline state then never meet, and nor do two testers. Run `/soirely-qa-tester`, `… qa2` or
`… qa3` from the main checkout as usual; each does its work in its own worktree, through
`node .qa/bin/qa-env.mjs`. Expo Go does not own the app's `soirely://` scheme, so on Android
a provider's redirect is handed back with `node .qa/bin/qa-env.mjs link 'soirely://oauth/…'`.
`android` removes any release build first, because while it is installed it owns that scheme.

Expo Go fetches the bundle from Metro and draws its own splash, so a bullet about the app
offline from first launch, or its own splash screen, needs the app itself.
`node .qa/bin/qa-env.mjs release` builds a release APK of the QA worktree's commit, with the bundle and fonts inside, installs
it fresh on the tester's phone emulator (`--tablet` for the other) and opens it, so that launch
is its first. `--offline` turns airplane mode on, cuts the stack and waits until the emulator has no
network before that launch. It records the launch's first 15 seconds under `.qa/release`, since
the emulator has no window to watch the splash in. Run
`checkout main` first for main. A QA worktree made before the command existed has an old
`.qa/bin` copy, whose `android` neither removes a release build nor turns airplane mode off.
Refresh that copy alone, leaving the branch and data as they are:
`git fetch origin main && git show origin/main:scripts/qa-env.mjs > .qa/bin/qa-env.mjs` in the
worktree. It needs no Expo account: `expo prebuild` writes `apps/mobile/android`, which
is ignored, and Gradle builds it. The first build on a machine fetches the NDK and an SDK
platform and took an hour here. The APK is kept in
`.qa/release`, named by its commit, so the next install of the same commit skips the build
(`--rebuild` forces one). The iOS build is sc-10624.

There are several developers. Developer 1 works in this checkout on the development ports.
`just dev-env setup --developer N` (2 to 4) makes developer N's: a worktree at
`../soirely-devN` with its own containers and database, on ports of its own (`STACKS` in
`scripts/dev-env.mjs`). Start `/soirely-developer devN` from that worktree. Every `just` recipe and `npm run` check works there as it does here,
because its `.env` names its own compose project. A developer claims a story by adding its
label, `dev1` to `devN`, so the others leave it alone; `.claude/skills/soirely-developer`
has the details.

Every other role that raises pull requests has a stack of its own the same way:
`just dev-env setup --role <role>` makes `../soirely-<role>` for `lead`, `ops` or `l10n`, the
one linguist for all four locales. Only five whole tens of thousands fit under port 65536, so
these take the half steps: `l10n` +15000, `lead` +45000, `ops` +50000 (`STACKS` in
`scripts/dev-env.mjs`). No two development ports are 5000 apart, so no stack
can land on another's.

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
