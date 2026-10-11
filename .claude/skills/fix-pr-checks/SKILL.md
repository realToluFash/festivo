---
name: fix-pr-checks
description: Watch a pull request's CI checks, diagnose failures, fix them in the commit that caused them rather than on top, and repeat until the checks pass. Invoke with a PR number.
disable-model-invocation: true
user-invocable: true
argument-hint: <pr-number>
arguments: [pr]
---

# Fix PR Checks Skill

You are getting PR `$pr` to green.

## The rule that shapes everything here

**A fix goes into the commit that caused it.** Not on top as `fix: CI`. The branch a
reviewer reads should look like the work was done right, because `making-commits` promises
that each commit passes its own tests — a branch with a "fix CI" commit at the end breaks
that promise for every commit before it.

That means the loop is: diagnose, fix, `--fixup` the right commit, autosquash,
force-with-lease, wait again.

## Step 1: Look

```bash
gh pr checks <pr> --watch
gh pr view <pr> --json headRefName,statusCheckRollup
```

If no checks appear at all, the PR is probably a draft and the workflow skips drafts. Say
so rather than waiting indefinitely.

## Step 2: Diagnose before touching anything

Get the actual failure, not the summary:

```bash
gh run view <run-id> --log-failed
```

Then establish **which commit introduced it**. `git log main..HEAD` plus the failing file
usually settles it; `git log -S'<symbol>' main..HEAD` when it does not.

Three failures worth recognising on sight:

- **Pre-existing.** The same check fails on `main`. Fix it in a separate PR, say so, and do
  not fold unrelated repair into this branch.
- **Environmental.** A flaky runner, a timeout, a cache miss. Re-run once with
  `gh run rerun <id> --failed` before changing any code. Do not "fix" a test that is not
  broken.
- **Real.** Everything else.

## Step 3: Fix it in place

```bash
git add <paths>                      # explicitly, never -A
git commit --fixup <sha>
GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <sha>~1
git push --force-with-lease
```

`--force-with-lease`, never `--force`. If the lease is refused, somebody else has pushed —
stop and say so rather than overwriting them.

Where a fix genuinely belongs to no existing commit — a new CI config, a dependency the
branch never touched — a new commit is correct. Say why in its message.

## Step 4: Repeat

Back to Step 1. Each pass should reduce the failure count; if it does not, say what you
have tried and what you now think is happening rather than looping on the same fix.

**Stop and ask after three passes on the same check.** Three rounds that have not moved it
means the diagnosis is wrong, and more attempts will not fix a wrong diagnosis.

## Step 5: Report

- Which checks were failing and why, one line each
- Which commit each fix was folded into
- Anything you ruled pre-existing, and how you established that
- Anything still red, and what you think it is

Never report green without having seen it green.

## Guidelines

- Do not disable a test, loosen an assertion or add a skip to get past a failure. If that
  is genuinely right, it is a decision for the developer and you ask first.
- Do not reformat or "tidy" files you are in for an unrelated fix.
- Linter autofixes are fine, but check the diff before folding them in — autofixers
  sometimes reach well beyond the failing rule.
