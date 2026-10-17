---
name: role-comments
description: How the seven roles talk to each other on a Shortcut story — a comment addressed with [pm] [qa] [ux] [dev] [bm] [lead] [ops], answered in its own thread, and the inbox routine every role runs to find what is waiting on it. Use when a role needs something from another, and at the start of every /soirely-* run.
user-invocable: false
---

# Comments between roles

The seven roles never talk in chat. A question one of them has for another is a comment on
the story it is about, addressed by tag, so the right role finds it on its next run and
anybody reading the story later can see what was asked and what was decided.

| Tag      | Role                        | Asked about                                                     |
| -------- | --------------------------- | --------------------------------------------------------------- |
| `[pm]`   | `/soirely-product-manager`  | what the product does: scope, AC, an undecided state            |
| `[ux]`   | `/soirely-designer`         | what a screen looks like, an artboard, a missing one            |
| `[dev]`  | `/soirely-developer`        | how it was built, a defect, a branch, a pull request            |
| `[qa]`   | `/soirely-qa-tester`        | what was tested, a finding, a re-test                           |
| `[bm]`   | `/soirely-business-manager` | money: a price, a plan limit, a cost, the market                |
| `[lead]` | `/soirely-tech-lead`        | a review: a finding, a re-review, how something should be built |
| `[ops]`  | `/soirely-ops`              | CI, the stacks, a deploy, an environment, a secret              |

**Product questions go to `[pm]`.** If you are deciding what the product should do, stop:
that is a question, and this is where it goes. **Money questions go to `[bm]`**: what
something costs, what to charge for it, or where a plan's limit sits.

## 1. Asking

Every agent posts as the same Shortcut user, so the comment has to say who wrote it. The
first line is the header, and nothing else:

```text
[pm] [ux] (from qa)
The code-entry screen has no state for a code that has expired. Is it a refusal with a
resend button, or a fresh screen? The AC is silent and no artboard draws it.
```

- **Addressees first**, as many tags as the question needs, then `(from <role>)`.
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

Reply **in the thread** — `stories-create-comment` with `replyToCommentId` set to the
question's id — never as a new top-level comment. The header addresses the asker:

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

1. **Find the stories.** `stories-search` with `comment: "[<you>]"` and `isDone: false`.
   Search tokenises, so it may match loosely or miss: also run `updated: "<14 days ago>..*"`
   over the open states, and read the comments of anything it returns.
2. **Find the open threads.** `stories-get-by-id` with `full: true`, then keep the comments
   whose header names your tag and which are open for you under section 3. Replies
   addressed to you count too: an answer to your own question is in your inbox.
3. **Resolve them, oldest first.** Answer, or act on an answer you were given — a `[dev]`
   reply from PM that changes an AC bullet is work to build, and a `[qa]` reply from dev
   that says a finding is fixed is a re-test.
4. **Report it.** First lines of your report to the user: how many threads you resolved,
   on which stories, and any you could not.

Then continue with your own pick-the-work order. An empty inbox is one line, not a reason
to stop.

## 5. What this is not for

- **Not for the user.** A decision only the user can make — merging, Done, money, a
  pricing call — goes in your report to them, not in a tag.
- **Not for a role to do another's job.** `[dev]` cannot ask `[pm]` to "just approve" an AC
  edit it already made; dev does not edit AC. The tags route the question; the roles'
  boundaries stay where each role's skill puts them.
