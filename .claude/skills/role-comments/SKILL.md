---
name: role-comments
description: How the roles talk to each other on a Shortcut story — a comment addressed with [pm] [qa] [qa2] [qa3] [ux] [dev] [dev2] [bm] [lead] [ops] [cd] [en] [es] [fr] [pt], answered in its own thread, and the inbox routine every role runs to find what is waiting on it. Use when a role needs something from another, and at the start of every /soirely-* run.
user-invocable: false
---

# Comments between roles

The roles never talk in chat. A question one of them has for another is a comment on
the story it is about, addressed by tag, so the right role finds it on its next run and
anybody reading the story later can see what was asked and what was decided.

| Tag      | Role                        | Asked about                                                          |
| -------- | --------------------------- | -------------------------------------------------------------------- |
| `[pm]`   | `/soirely-product-manager`  | what the product does: scope, AC, an undecided state                 |
| `[ux]`   | `/soirely-designer`         | what a screen looks like, an artboard, a missing one                 |
| `[dev]`  | `/soirely-developer`        | how it was built, a defect, a branch, a pull request                 |
| `[dev2]` | `/soirely-developer dev2`   | the same, on a story labelled `dev2`                                 |
| `[qa]`   | `/soirely-qa-tester`        | what was tested, a finding, a re-test: tester 1, or QA in general    |
| `[qa2]`  | `/soirely-qa-tester qa2`    | a finding or a re-test from tester 2's report                        |
| `[qa3]`  | `/soirely-qa-tester qa3`    | a finding or a re-test from tester 3's report                        |
| `[bm]`   | `/soirely-business-manager` | money: a price, a plan limit, a cost, the market                     |
| `[lead]` | `/soirely-tech-lead`        | a review: a finding, a re-review, how something should be built      |
| `[ops]`  | `/soirely-ops`              | CI, the stacks, a deploy, an environment, a secret                   |
| `[cd]`   | `/soirely-creative`         | an idea: a better way to do a flow, a proposal's evidence            |
| `[en]`   | `/soirely-linguist en`      | English copy: wording, a new or changed string, a translation ticket |
| `[es]`   | `/soirely-linguist es`      | Spanish: a translation, a string that does not fit                   |
| `[fr]`   | `/soirely-linguist fr`      | French: a translation, a string that does not fit                    |
| `[pt]`   | `/soirely-linguist pt`      | Portuguese: a translation, a string that does not fit                |

**A QA report is answered to the tester who signed it**: `(from qa2)` gets `[qa2]`. A
question for QA in general is `[qa]`. **A developer question goes to the developer whose
label the story carries**: `dev2` gets `[dev2]`, and `dev1` or no label gets `[dev]`. A
bare `[dev]` on a `dev2` story still reaches developer 2, but write the tag that is meant. A
translation ticket carries no developer label, so a bare `[dev]` on one reaches developer 1:
there, use the label of the feature story the string came from, which its **Covers** names. **Wording questions go to the linguists**: `[en]` for the source copy, the locale's tag for
how it reads in that language. **Product questions go to `[pm]`.** If you are deciding what the product should do, stop:
that is a question, and this is where it goes. **Money questions go to `[bm]`**: what
something costs, what to charge for it, or where a plan's limit sits.

Comments are read and written only through `sq <role>`, where `sq` is
`python3 <git common dir>/soirely-roles/sq/sq` (installed by `python3 tools/queue/sq install`),
never with the Shortcut tools.

## 1. Asking

Every agent posts as the same Shortcut user, so the comment has to say who wrote it. The
first line is the header, and nothing else. `sq <role> comment sc-N --to pm,ux` writes it
for you, with the body from stdin or `--text`:

```text
[pm] [ux] (from qa)
The code-entry screen has no state for a code that has expired. Is it a refusal with a
resend button, or a fresh screen? The AC is silent and no artboard draws it.
```

- **Addressees first**, as many tags as the question needs, then `(from <role>)`. Never
  type the header into the body; `sq` produces `[to] (from role)` from `--to` and your role.
- **One question per comment.** Two questions in one comment cannot be resolved apart.
- **Concise.** Two or three lines: what you found, the question, and your proposed answer
  if you have one. Link the evidence rather than pasting it — the screenshot, the PR line,
  the AC bullet by its words.
- **Ask on the story it is about**, not on the one you happen to be working. If no story
  fits, it is a `[pm]` question on the epic's in-progress story most affected.
- **Carry on.** A question is not a reason to stop the rest of the work. Say in your report
  to the user which questions you left and on which stories.

A QA report's **Outstanding items** and a pull request's **Risks** still say everything
they say today. When one of those lines needs another role to act, it also gets its own
tagged comment, because a line inside a report is not in anybody's inbox.

## 2. Answering

Reply **in the thread** — `sq <role> comment sc-N --reply-to <id> --text "…"` — never as a
new top-level comment. The reply goes on the thread's root, and its header addresses the
asker unless you add `--to`:

```text
[qa] (from pm)
A refusal with a resend button. Added as AC bullet 6. Rejected a fresh screen: it loses
the address the person typed.
```

- **Answer only your part.** A comment tagged `[pm] [ux]` gets one reply from each role.
- **Act before you reply.** If the answer changes an AC bullet, an artboard or the code,
  change it first and say in the reply that you did. An answer that only lives in a comment
  is an answer the next role builds against the old AC.
- **Can't answer?** Say why and re-address it: `[pm] (from ux)` with what you need. Do not
  leave it unanswered — an open thread is somebody else's blocked work.
- The asker does not reply to say thanks. The answer closes the thread.

## 3. What counts as open

A tagged comment is **open for role X** while its thread has no reply whose header reads
`(from X)`. A comment tagged for three roles stays open for each role that has not
replied, and closed for each one that has.

## 4. The inbox routine

Every `/soirely-*` run starts here, before picking its own work. It is cheap, and it is the
thing that unblocks the others.

1. **Find the open threads.** `sq <role> next` gives you the inbox first: an inbox item
   prints every thread with a comment open for you under section 3, in full, with the
   story's section names and its pull request's status. Replies addressed to you count too:
   an answer to your own question is in your inbox. On any other story,
   `sq <role> comments sc-N --open` prints the threads still open for you.
2. **Resolve them, oldest first.** Answer, or act on an answer you were given — a `[dev]`
   reply from PM that changes an AC bullet is work to build, and a `[qa]` reply from dev
   that says a finding is fixed is a re-test.
3. **Report it.** First lines of your report to the user: how many threads you resolved,
   on which stories, and any you could not.

Then continue with your own pick-the-work order. An empty inbox is one line, not a reason
to stop. In a routine run, the inbox is one work item, finished like any other with
`sq <role> done <id> --note "…"` (`role-routine`, section 3).

## 5. What this is not for

- **Not for the user.** A decision only the user can make — merging, Done, money, a
  pricing call — goes in your report to them, not in a tag.
- **Not for a role to do another's job.** `[dev]` cannot ask `[pm]` to "just approve" an AC
  edit it already made; dev does not edit AC. The tags route the question; the roles'
  boundaries stay where each role's skill puts them.
