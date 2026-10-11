# Contributing

## Getting set up

```bash
npm run setup          # node deps, PHP deps, git hooks, local env
docker compose up -d   # the stack
```

`npm run setup` reports what it did and what it skipped. PHP tooling runs in Docker —
you do not need PHP installed.

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

## Hooks

The pre-commit hook formats and lints **staged files only**, so it stays fast. If it
fails on something your change did not introduce, check the same file on `main` first,
then use `--no-verify` and say so in the PR.
