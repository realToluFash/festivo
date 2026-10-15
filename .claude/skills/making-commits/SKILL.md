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

## Read your own comments before you stage

`git diff` the work and look at every comment line it adds, against **code-comments**. Two
questions each: would a reader break something without it, and is it still true next year.

This takes a minute and it is the last cheap moment — once it is committed the choice is
somebody's review comment, and the sweep that follows touches every file at once. A branch
that added nine hundred lines of comment and kept a hundred and thirty is what skipping it
costs.

`npm run lint:comments` does the arithmetic part of this on the staged change, and the
pre-commit hook runs it. It refuses a comment running past three lines and a file gaining
more than eight. Passing it is not the standard — the two questions above are — but a
change it fails has definitely not met them.

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

## Resolving review comments: fold, do not append

**A review fix belongs in the commit that introduced the thing being fixed.** Not in a new
`fix review comments` commit at the end — that is not an outcome, it is a record of a
conversation, and it leaves the commit it refers to wrong in the history forever.

So after a round of review, the branch is **rebuilt**, not extended. Each fix is squashed
into its commit, and `git log` reads as though the code had been right the first time —
because that is what the reviewer approved and what a bisect will check out.

```bash
git reset --soft <base>   # the whole branch's work, staged, in one place
# then re-commit it in the groups it should have been in
```

Rebuilding from a soft reset is usually simpler than a chain of `fixup!` commits and an
interactive rebase, because the working tree is already the final state — the only question
left is how to group it.

**And it avoids a trap in the fixup route.** A `fixup!` is a patch made against the final
state; applying it to an earlier commit conflicts wherever a later commit touched the same
lines, and resolving that conflict in favour of the earlier commit **silently drops the fix
from the final tree** — the later commit simply re-adds what it always added. That is how a
comment deleted in a sweep came back: the fixup landed on the commit before the one that
re-introduced the line.

Whichever route you take, prove the rebuild changed no content:

```bash
git diff ORIG_HEAD HEAD   # must be empty — same tree, different history
```

Empty means you regrouped the work. Anything else means you changed it, and you now have to
read what changed and decide whether you meant it.

### The exception, and it is the important half

**A comment that sends you outside the pull request gets its own commit.** If the reviewer
says "while you are here, this other thing is also wrong", that other thing is a separate
outcome with a separate reason, and folding it into a feature commit hides it.

Sorting one from the other, on a real example:

| The comment                                        | Where it goes                                     |
| -------------------------------------------------- | ------------------------------------------------- |
| rename this class you just added                   | the commit that added it                          |
| remove this comment you just wrote                 | the commit that wrote it                          |
| this method you added should be a setter           | the commit that added it                          |
| **also fix the nine other places you named badly** | **its own commit** — none of them are in this PR  |
| **write the rule down in a skill**                 | **its own commit** — a standard is its own change |

The test: **would this change make sense on `main` without the rest of the pull request?**
If yes, it is its own commit. If it only makes sense as part of the thing being reviewed, it
belongs in that thing's commit.

### What this costs

The branch is force-pushed, so use `--force-with-lease` and never `--force`. Say in the
report that you rebuilt and what the new shape is, because a reviewer who had read the old
commits needs to know their anchors moved. Inline review comments survive a force-push when
their line still exists; GitHub marks them outdated when it does not.

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
