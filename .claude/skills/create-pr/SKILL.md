---
name: create-pr
description: Open a pull request for the current branch in the Soirely house format — Description, Risks, References, Evidence of work, Next Steps — filled in from the actual diff, through `sq <role> pr-create`. Ready for review, never a draft, except for ops.
disable-model-invocation: true
user-invocable: true
argument-hint: [optional note about the change]
arguments: [note]
---

# Create PR Skill

You are opening a pull request for the work on the current branch.

**Every PR opens ready for review, not as a draft.** A draft cannot be merged, and the
lead's pass is meant to be the last step before the merge. Only ops opens drafts.

`$note` is optional context. The diff is the source of truth; the note tells you what to
emphasise.

## Tools

Read and write Shortcut and GitHub only through `sq <your role>` — the developer's `sq dev`
or `sq devN`, the linguist's `sq l10n`, `sq ops`; the examples below say `sq dev`.
`sq dev help` lists what you may run. Never call the Shortcut tools or `gh` yourself. Git
in your own checkout stays as it is.

## Step 1: Preflight

1. `git branch --show-current`. **Refuse to continue on `main`.**
2. `git status --short` — uncommitted changes relevant to the work mean stopping to ask
   whether to commit them first. Do not commit on the developer's behalf without asking.
3. `git log --oneline main..HEAD` — the commits this PR will contain. Empty means there is
   nothing to open.
4. Push if needed: `git push -u origin <branch>`. Say that you are doing it.

The base branch is **`main`**. There is no long-lived develop branch here.

## Step 2: Understand the change

Read the diff properly before writing a word. A body assembled from commit subjects is
worthless to a reviewer.

- `git diff main...HEAD --stat` for the shape
- `git log main..HEAD` for the intent behind each commit
- `git diff main...HEAD` for anything you cannot infer from those

Identify specifically:

- What behaviour changes for a user, and what stays the same
- Which surfaces it spans — `services/api`, `apps/mobile`, `apps/web`, `services/support`,
  `infra`. A cross-stack PR needs its halves described together, not listed separately.
- Any Doctrine migration, and what it does to rows that predate it
- Any new Mercure topic, or a change to what an existing one publishes
- Any new permission, or a change to who passes an existing check
- Any new user-facing string, and whether all four locales carry it
- Which tests cover the change, and whether they are new

If the branch is named `sc-<id>/<slug>`, the Shortcut story is `<id>`. Its AC is
`sq dev story sc-<id> --section AC` — if this run already printed it, that is a one-line
reference, and the text above is the one to use. Read it so the References section is
accurate and the description matches what was asked for. **Flag any
drift between the story's AC and the diff** — that is exactly what a reviewer needs.

## Step 3: Write the body

Five headings, in this order. **Never delete one** — if a section does not apply, write
`None.` under it. An explicit "None" says you considered it; a missing heading says you
forgot.

```markdown
# Description

# Risks

# References

# Evidence of work

# Next Steps
```

### The body describes the work, not the week

**A pull request says what the branch is for, what it does, and what a reviewer should push
back on. It is not a record of how it was built.** Every line below was asked for after a
body read as a development diary.

Cut, every time:

- what was tried first, and why it did not work
- a defect introduced and fixed inside this branch, unless it changes how the result should
  be reviewed
- a measurement taken to settle a question nobody asked
- "my first attempt", "it turned out that", "this is the second time"
- how long something took, or how many goes it needed

Keep, because a reviewer acts on them:

- the decision taken and the one rejected, a sentence each, where the choice is contestable
- a defect that **survives** into main — that is a risk — or one this branch fixes for
  somebody else, which is scope worth declaring
- the verification, as results rather than as a narrative

The test for a sentence: would somebody deciding whether this code is correct still want to
read it in six months? If it is only interesting because it happened to you, it goes in the
commit message, where the history of the work belongs.

### Do not wrap the body

**One line per paragraph and per bullet, however long.** GitHub renders a single newline in
a pull request body as a line break rather than joining it into the paragraph, so markdown
wrapped at eighty columns — which is right everywhere else in this repository — arrives as
ragged broken lines.

This is the one file where the usual wrapping is wrong. Commit messages still wrap at
seventy-two; `docs/` still wraps; the PR body does not.

### Description

What changed and why, in prose. Lead with the why — the diff shows the what. Name the
entities, endpoints and screens involved. A short paragraph or two, plus a bulleted list
of the substantive changes where there are several.

For a cross-stack change, say in one sentence why the halves are in the same PR. The
answer is usually that neither is usable alone, and saying it stops a reviewer asking.

### Risks

Do not write "none" reflexively. Work through:

- **Deploy ordering.** Migrations, backfills, queued jobs, anything needing a manual step.
  A migration that must run before the new code is a risk even when it is routine.
- **Data that predates the change.** Rows with a null in the new column, guests imported
  before the validation tightened.
- **The parts you are least sure about**, and why.
- **Tradeoffs taken deliberately** that could bite later.

A risk you name is a risk a reviewer can check; one you omit becomes an incident.

### References

- The Shortcut story, as a full URL: `https://app.shortcut.com/soirely/story/<id>`
- The epic, where the PR is one of several landing a scope
- Any relevant doc under `docs/`
- Related PRs

### Evidence of work

How you verified it, concretely enough to repeat — **results, not the route to them**. The
commands and their numbers, what each new suite holds, what was checked by hand. Not the
order you discovered things in.

- The exact commands you ran and their results — `vendor/bin/phpunit --testsuite Feature`,
  `npx jest <path>`, `npx tsc --noEmit`, with the numbers
- Which tests are new, and which existing suites you ran for regressions
- Anything needing a migration or re-seed first, because a reviewer running against a
  stale database will see failures unrelated to the diff
- For visual changes, **before and after screenshots** — images, not descriptions, and all
  three mobile layouts where the change touches them
- For anything not covered by a test, how you checked it by hand

**Every PR is expected to carry tests.** If this one does not, say so here and say why.

### Next Steps

Follow-up PRs, stories still to raise, work deliberately left out. `None.` if
self-contained.

## Step 4: Check the body

Before opening, read the title and body once more for anything you inferred rather than
knew — especially in Risks, where a wrong assumption is worse than a blank. Say so in the
body where it stands, and in your report.

## Step 5: Open it

```bash
sq dev pr-create --head <branch> --title "<title>" < <body file>
```

The base is `main`. Write the body to a file and pass it on stdin rather than inline — the
markdown does not survive shell quoting intact. `pr-create` refuses `--draft` for every
role but ops.

Title: a conventional-commit prefix matching the branch's commits, naming the outcome.

## Step 6: Hand it to review

**A developer moves the story to `In Review`**: `sq dev move sc-<id> "In Review"`. That
state is the handover: it is how `/soirely-tech-lead` finds work. Once the lead passes it, you merge it and move it on to `Ready For QA` yourself
(`soirely-developer`, section 9). A finished story left in `In Progress` is a story nobody
reviews or tests.

Move it when the work is actually finished — the pull request open and **its checks green**,
not merely pushed (`sq dev checks <n>`: nothing failed, nothing pending). A story handed
over on a red branch wastes somebody's pass on code that is about to change.

Never move a story to **Done**. That is the user's, after a merge.

## Step 7: Report

Give the PR number and URL, the base branch, the commit count, and anything you inferred
rather than knew.

Use `/fix-pr-checks <number>` once CI has started and a check is red.

Say which state the story is in now, so the handover is visible rather than assumed.

## Attribution

**Never reference Claude, Claude Code or Anthropic anywhere in the pull request** — no
footer, no generated-with line, no session link, no co-author trailer. The same applies to
every commit on the branch. The work reads as the developer's own.

## Guidelines

- The reviewer is the audience. Write for someone who has not seen the story.
- Prefer specifics over reassurance. "Feature suite: 212 passed, 1 pre-existing failure
  unrelated to this diff" beats "tests pass".
- If the diff does something the AC does not describe, say so in the Description. Silent
  scope creep is what PR review exists to catch.
- Do not pad. A three-line Description on a three-line diff is correct.
- The history of how the work went belongs in the commit messages, which are written for
  somebody reading `git log` later. The PR body is written for somebody deciding whether to
  merge.
