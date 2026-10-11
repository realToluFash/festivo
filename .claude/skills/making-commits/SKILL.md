---
name: making-commits
description: Split work into atomic commits — each one outcome, each passing its own tests at that commit — and write messages that explain why. Use when committing work, or when asked to break an existing commit up.
disable-model-invocation: true
user-invocable: true
argument-hint: [optional note about what the work was]
arguments: [note]
---

# Making Commits Skill

You are turning a working tree, or an existing sprawling commit, into a series of atomic
commits a reviewer can read one at a time.

`$note` is an optional hint. Ignore it if the diff tells you more.

## The rule

**One commit, one outcome.** An outcome is a thing that is now true for a user or for the
system — not a file, not a layer, not a step in your own process.

These are outcomes:

- a guest can be given a dietary tag
- the service floor reads it
- an open screen sees the change without a reload

These are **not** outcomes, and must not be commits on their own:

- "add the API side"
- "update tests"
- "fix review comments"
- "wip"

In a monorepo the layer temptation is stronger, because the layers are right there in
adjacent directories. Resist it. A commit that adds a Doctrine field, the endpoint that
writes it and the screen that sets it is **one** commit — they deliver one outcome and
none of them stands up alone. A commit that adds that field _and_ changes an unrelated
query is two.

## Step 1: Find the outcomes

Read the whole diff before splitting anything — `git diff`, or `git show` for a commit you
are breaking up. Then list the outcomes it contains. Most changes have between one and
five. More than about six usually means you are splitting by layer; re-read and regroup.

For each outcome gather **every** file that delivers it, across `services/api`,
`apps/mobile`, `apps/web` and `infra`. Splitting those apart is the most common mistake —
it produces commits that cannot stand alone and hides the change from review.

## Step 2: Order them by dependency

A commit must make sense given only the commits before it. Where one outcome reads a value
another produces, the producer goes first. Where a rename makes later commits legible, it
goes first and its message says why it is landing alone.

State a non-obvious dependency in the message so nobody reorders it later:

> The column from the previous commit had nothing writing to it.

## Step 3: Each commit must pass its own tests

Not just the tip. Someone checking out the third of five commits must get a green tree,
and a bisect must not hit a commit failing for unrelated reasons.

That means **a commit carries the tests for its own outcome**. Do not park test changes in
a final "add tests" commit — that is not an outcome, and it leaves every commit before it
unverified.

Verify it, do not assume it:

```bash
git checkout <commit>
# run the suites covering that commit's outcome
git checkout <branch>
```

Run the narrowest suites that actually cover the change rather than everything, and say
which ones you ran.

## Step 4: Verify the split changed nothing

After re-splitting an existing commit the tree must be byte-identical:

```bash
git diff <original-commit> HEAD    # must be empty
```

If it is not empty you dropped or duplicated a hunk. Fix it before going further. Say in
your report that you checked — "identical tree" is what makes a re-split trustworthy.

## Step 5: Write the message

Subject: a conventional-commit prefix (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`),
then the outcome in the imperative, lowercase, no full stop. Name the outcome, not the
mechanism — `feat: show dietary tags on the service floor`, not `feat: add tags field`.

Scope the prefix by surface when it clarifies and only one is touched: `fix(api):`,
`feat(mobile):`. A genuinely cross-stack commit takes no scope — that is the signal that
it spans them.

Body, wrapped at 72 characters:

1. **What was wrong or missing.** The reviewer needs the problem before the solution.
2. **What this commit does about it** — prose, or bullets when there are several
   coordinated parts.
3. **Anything a reviewer would otherwise have to ask.** Why a value is read from one place
   rather than another. Why this had to be in this commit. What happens to data that
   predates the change.

Explain _why_, not what — the diff already says what. A body listing the files changed is
worthless.

End with the `Co-Authored-By` trailer this environment sets. (The developer's other
repositories omit assistant attribution entirely; if that is wanted here, change this
section and this section only — the rest of the skill does not depend on it.)

## Step 6: Report

Give the commit list, one line each, and state:

- that the tree is identical to before, where you re-split something
- which suites you ran at which commit, with the numbers
- any commit you could not verify independently, and why

If a pre-existing failure shows up, say it is pre-existing and say how you established
that. Never present an unverified split as verified.

## Hooks

If a pre-commit hook fails on problems your change did not introduce, do not silently
bypass it and do not quietly fix unrelated files to get past it. Establish the failures
are pre-existing — check the same file on `main` — then use `--no-verify` and **say so**,
naming what the hook was failing on.

Bypassing is also right mid-split: the hook stashes unstaged changes, which is dangerous
when several commits' worth of work is still in the tree.

## Guidelines

- Never commit unrelated local edits that happen to be dirty. Check `git status` and stage
  explicitly by path — **never `git add -A` or `git add .`**.
- Committing is not pushing. Do not push, force-push or open a PR unless asked.
- When rewriting pushed history use `--force-with-lease`, never `--force`.
- If the work genuinely is one outcome, one commit is correct. Do not manufacture a split
  to look thorough.
