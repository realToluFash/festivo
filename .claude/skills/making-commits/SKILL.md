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

**This is load-bearing, because nothing is squashed.** The repository allows merge commits
only — squash and rebase are both off — so every commit you write reaches `main` with its
message and its SHA intact, and `git bisect` will check out the middle of your series. A
commit that fails for unrelated reasons makes the whole history unusable for finding
anything.

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

**Never mention Claude, AI assistance or the session** — not in the subject, not in the
body, and never as a `Co-Authored-By` trailer. The commits read as the developer's own
work. The same applies to pull requests.

## Step 6: Report

Give the commit list, one line each, and state:

- that the tree is identical to before, where you re-split something
- which suites you ran at which commit, with the numbers
- any commit you could not verify independently, and why

If a pre-existing failure shows up, say it is pre-existing and say how you established
that. Never present an unverified split as verified.

## Hooks

`lefthook.yml` holds them. Read it rather than guessing — this is a summary of what it
does, and it is the file that is authoritative.

### Most of it fixes rather than complains

Prettier, ESLint and php-cs-fixer all run with their fixer on and `stage_fixed: true`, and
`mago fix --no-fmt` applies the mago fixes that are safe. **So do not format by hand before
committing, and do not re-stage after the hook runs — it has already done both.**

What this means in practice:

- A formatting-only failure should not happen. If the hook reports one, something is wrong
  with the tooling, not with the file.
- **The files in the commit may differ from the files you staged.** That is the fixers
  working. Read `git show` after committing rather than assuming your staged version is
  what landed.
- A fixer that rewrites a file you had open means your editor's copy is now stale.

### What cannot be fixed automatically

Four checks report and stop, because no tool can guess the intent:

| Check              | What it catches                                    | Where the rules are           |
| ------------------ | -------------------------------------------------- | ----------------------------- |
| `mago lint`        | a convention, such as a native call where Psl goes | `writing-php`                 |
| `mago analyze`     | a type, signature or reachability error            | —                             |
| `mago guard`       | a namespace depending on one it may not            | `code-structure`, `scopes.md` |
| `check-commit-msg` | a subject that is not a conventional commit        | Step 5 above                  |

The three mago checks run **project-wide**, not on staged files, and that is deliberate: a
type error and a boundary violation are properties of the project rather than of a file. A
staged signature change whose caller is not staged is exactly the commit they catch.

**The consequence to expect: unrelated work in progress elsewhere in the tree can fail your
commit.** That is not a bug in the hook. Establish it is pre-existing and unrelated, then
see below.

`mago lint` has a baseline at `services/api/.build/mago/lint-baseline.toml` holding the
issues that existed when it was adopted, so it fails on a new one and not on the backlog.
**Never add to that file to get a commit through.** A new entry means a new issue.

### Bypassing

If the hook fails on problems your change did not introduce, do not silently bypass it and
do not quietly fix unrelated files to get past it. Establish the failures are pre-existing —
check the same file on `main` — then use `--no-verify` and **say so**, naming what the hook
was failing on.

Bypassing is also right mid-split: the hook stashes unstaged changes, which is dangerous
when several commits' worth of work is still in the tree.

### Running them without committing

```bash
just check              # everything CI runs
just lint               # the fixers' checks, every language
just static-analysis    # mago analyze
just guard              # mago guard
npx lefthook run pre-commit
```

## Guidelines

- Never commit unrelated local edits that happen to be dirty. Check `git status` and stage
  explicitly by path — **never `git add -A` or `git add .`**.
- Committing is not pushing. Do not push, force-push or open a PR unless asked.
- **Never merge a pull request unless told to**, and an instruction to merge covers only
  the pull requests open at that moment, not the next one. When merging is asked for, let
  GitHub supply the merge commit's subject rather than passing `--subject`: it appends the
  pull request number, which every merge on `main` carries.
- When rewriting pushed history use `--force-with-lease`, never `--force`.
- If the work genuinely is one outcome, one commit is correct. Do not manufacture a split
  to look thorough.
