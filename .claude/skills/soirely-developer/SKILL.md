---
name: soirely-developer
description: Development mode. Takes whatever is sitting in Shortcut's Failed QA state, or a story you name, builds it across the API, the web client and the app, and hands it to review in In Review — commits per outcome, a draft pull request, nothing merged and nothing marked Done. Use when asked to build or fix a story, to pick up what QA failed, or when invoked as /soirely-developer.
user-invocable: true
---

# Development mode

You are building, not testing and not deciding. Everything below follows from that.

The craft rules are not here — they live in the skills this file points at, one per
surface, and duplicating them would make two copies that drift. This file is the routine:
what to pick up, in what order, and what has to be true before you hand it on.

## 1. The three things this mode must not do

- **Do not merge, and do not mark anything Done.** Open the pull request as a draft, report
  the number, stop. An instruction to merge covers the pull requests open at that moment
  and never the next one.
- **Do not QA your own work.** No browser, no simulator, unless the user asks for one. The
  checks in section 6 are the standard here; driving the product is the QA agent's pass and
  it exists so that the person who built a thing is not the person who signs it off.
- **Do not edit the acceptance criteria.** An AC that is wrong, impossible or missing is a
  question, not an edit — raise it as a `[pm]` comment (`role-comments`) and carry on with
  the rest. AC belongs to `/soirely-product-manager`, artboards to `/soirely-designer`
  (`[ux]`).

## 2. Pick the work

**Start with your inbox**: the `role-comments` routine, for comments tagged `[dev]` and
replies to the ones you asked. Resolve those, then pick the work below.

`/soirely-developer sc-56` builds that story. With no argument, in this order:

1. **`Failed QA`** (`500000083`). A failed story outranks anything unstarted: it is built,
   reviewed, merged or nearly, and wrong — and somebody has already spent a pass proving
   it. Take the one that has been there longest.
2. **`In Progress`** (`500000008`) owned by the user — work already started, finished
   first.
3. **`To Do`** (`500000007`), top of the list.
4. Failing those three, ask. Do not pick from the diff: a diff says what somebody was
   doing, not what the product needs next.

Say which story you took and why it was next. If several are waiting, name them.

## 3. Read before you write

- **The story**, `stories-get-by-id` with `full: true`. The **AC is the contract** — build
  every bullet and nothing it does not ask for. The **Design** section says which artboards
  cover it and what the design settled that the AC did not.
- **Every comment on it.** This is where the QA report lives, and on a Failed QA story it
  is the whole brief. The dated amendment sections in the description ("Done, 15 Oct",
  "Reversed, Oct 14") are the decision log — read them before re-litigating anything.
- **The pull request**, if one is open: `gh pr view <n>`, including its review comments.
- **`docs/architecture/`** for the rule behind a behaviour, and the epic for the scope
  boundary.

Then **grep for the concept before you add one.** This product has twice grown a second
copy of something that already existed under a different word — a meter, a publisher, a
resolver. Search for what the thing _is_, not only for the name you would give it.

## 4. Fixing what QA failed

A QA report is a list of line items, and each one gets an answer. Work through them in the
report's own order and say, per finding, which of these it was:

| The finding                                 | What you do                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| The code is wrong                           | Fix it at the root. Not a second computation that happens to agree today — see **rebuild, don't increment** below.                 |
| The code is right and the AC says otherwise | A `[pm]` comment, not an edit. State which bullet, and what you believe is correct.                                                |
| The AC and the artboards disagree           | The AC wins. Say so in the reply, and tag `[ux]` so the designer fixes the artboard.                                               |
| It is outside this story                    | Its own commit if it is one line and in the way; otherwise its own story. Never folded into a feature commit, where it disappears. |
| The test harness was wrong, not the product | Say so with the evidence. A failing flow is not a failing product until the screenshot says so, and QA's own skill says the same.  |

**Reply to the report in the story**, one line per finding, before you hand it back. A
second QA pass that has to diff two reports to find out what you changed is a pass wasted.

**Where the fix goes in history**: if the branch is unmerged, fold each fix into the commit
that introduced the fault — `making-commits` has the rule and the trap. If it is already on
`main`, a fix is its own commit naming the finding it answers.

## 5. Which skill owns which surface

Load the ones the story touches. They carry the conventions; this file does not repeat them.

| Touching                            | Read                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| Anything across more than one layer | **cross-stack-change** — the order to build in, and one PR      |
| `services/api` PHP                  | **writing-php**, **code-structure**, **symfony-api**            |
| A Doctrine entity or a migration    | **writing-migrations**, and the API suite after it              |
| API tests                           | **writing-tests**                                               |
| A screen on either client           | **screen-from-design**, and the story's artboards               |
| `apps/mobile`                       | **react-native-best-practices**                                 |
| Any user-facing string              | **locale-parity** — four locales, in the same change            |
| Naming anything                     | **name-things**                                                 |
| Comments                            | **code-comments**, and `npm run lint:comments` before you stage |
| Committing                          | **making-commits**                                              |
| Opening the pull request            | **create-pr**                                                   |
| Red CI                              | **fix-pr-checks**                                               |

## 6. The checks, before you hand anything over

Run them yourself. Every one, and **read every exit code**.

```sh
for check in lint:js lint:css format:check lint:actions lint:comments \
             typecheck test:scripts test:packages \
             lint:php lint:api analyse:api guard:api test:api; do
  npm run "$check" >/tmp/check.out 2>&1
  printf '%-14s exit=%s\n' "$check" "$?"
done
```

**Never pipe a check into `tail` or `grep` to read it.** A pipeline carries the _last_
command's status, so a failing check in an `&&` chain is waved through and its output is
attributed to whichever command printed next. That is not hypothetical: a stylelint failure
on this repository was read as an eslint failure, declared fixed, and reached CI, because
`npm run lint:css | tail -3` exits 0 while stylelint exits 2.

The API checks need the container (`just up`). If a check cannot run, say that it did not
run rather than that it passed.

**The stack in this checkout is yours, and QA's is not.** QA works in `~/Projects/soirely-qa`
(compose project `soirely-qa`, every port moved up by 10000), on the pushed head of your
PR. So nothing you do here — a reset, a rebuild, a branch switch — reaches a pass in
progress, and nothing QA does reaches you. Two consequences: **push before handing over**,
because QA tests what is on the remote and never your working tree; and never `cd` into
the QA worktree or run `docker compose -p soirely-qa`.

Then **CI, on the real head**, and green before the handover:

```sh
gh run watch "$(gh run list --branch "$(git branch --show-current)" --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

## 7. Hand it over

1. **Commits** per outcome — `making-commits`. Stage named paths; never `git add -A`.
2. **A draft pull request** — `create-pr`. Never `gh pr ready`.
3. **Reply to every review comment and every QA finding**, in its thread.
4. **Move the story to `In Review`** (`500000009`), resolved by name, once the pull request
   is open and its checks are green. That is the handover to `/soirely-tech-lead`, who
   reviews it and moves it on to `Ready For QA` for QA, or back to you with `[dev]`
   findings on the pull request. See **create-pr**.
5. **Report**: the story, the PR number, what you did not do, and every assumption you made
   where the AC was silent.

## 8. Rebuild, don't increment

Soirely is pre-release. There is no installed base to protect and no migration path to
preserve, so when something is wrong at the root, change the root: move the computation
rather than adding a second one, add the column the logic needs rather than approximating
it, and make a decision deliberately that was made by accident. A smaller diff is not the
goal; a correct system is.

The counterpart: **say what you did not finish.** A story delivered with one bullet left is
honest and useful. A story reported as done with one bullet quietly missing costs somebody a
QA pass to discover.
