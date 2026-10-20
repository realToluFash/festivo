# How work moves between roles

Which Shortcut state a story is in decides which role it wakes. The aim is that **every
step wakes exactly one role**, and that the board says truthfully where each story is.

**Status: agreed with the owner on 20 Oct, not yet built.** The owner adds the new states
in Shortcut; ops changes `sq` and the skills to match, in one pull request.

## The states

```
Backlog → To Do (PM) → Needs Design (UX, skipped with no screen) → Ready For Dev
        → In Progress → In Review (lead) → Passed Code Review → merged → Ready For QA
        → In QA → Passed QA → Done (owner)
                                 ↘ Failed QA → In Progress
                  ↘ Failed Code Review → In Progress → In Review
Any state → Waiting On Owner → back where it came from
```

| State                  | Wakes                          | Leaves when                                         |
| ---------------------- | ------------------------------ | --------------------------------------------------- |
| Backlog                | business manager               | the product manager takes it into To Do             |
| To Do                  | product manager                | the AC is settled: to Needs Design or Ready For Dev |
| **Needs Design**       | designer                       | screens are linked: to Ready For Dev                |
| **Ready For Dev**      | the developers (one claims it) | a developer claims it: to In Progress               |
| In Progress            | that story's developer         | the checks are green: to In Review                  |
| In Review              | tech lead                      | the review: to Passed or Failed Code Review         |
| **Passed Code Review** | that story's developer         | merged at the passed commit: to Ready For QA        |
| **Failed Code Review** | that story's developer         | the findings are fixed: back to In Review           |
| Ready For QA           | the testers (one claims it)    | a tester claims it: to In QA                        |
| In QA                  | that tester                    | the test: to Passed QA or Failed QA                 |
| Failed QA              | that story's developer         | fixed: to In Review                                 |
| Passed QA              | nobody                         | the owner moves it to Done                          |
| **Waiting On Owner**   | nobody                         | the owner decides: back to the state it came from   |

The new states are in bold. Their names must match exactly, because `sq` matches states by
name.

## Why each one

**Needs Design and Ready For Dev split To Do.** Today To Do is queued by the product
manager, the designer, the business manager and both developers (`ROLES` in
`tools/queue/soirely_queue/roles.py`). A story entering it wakes five workers, about $0.15
each before any work, and they race: a developer can start building before the AC is
settled or the screens exist. After the split, To Do is the product manager's alone.

**Waiting On Owner gives the owner one column.** Today a story waits on the owner only if
its description contains the words "owner decision" (`business_manager` in
`digests.py`), and a hold such as sc-2864's lives in a comment. Nothing wakes on this
state, so a held story costs nothing, and moving it back wakes the right role.

**Failed Code Review mirrors Failed QA.** Today findings send a story back to In Progress,
where rework looks the same as a first build. In its own state the worker knows to read the
review threads first, the developer's queue puts rework ahead of new stories, and review
round trips can be counted.

**Passed Code Review shows what is approved and waiting to merge**, and wakes the developer
to merge it. The state can become untrue, so the commit decides, not the state:

- `sq` merges only at the commit the tech lead passed, as it does today, and refuses
  otherwise.
- A push after the pass, such as merging `main` in to fix a conflict, moves the story back
  to In Review on its own, and the tech lead reviews again.

## Wake fixes that need no new state

- **Failed QA wakes only the developer.** Today it also wakes the product manager and the
  designer on every failure, and most failures are code. When QA finds a gap in the AC or
  the design, it tags `[pm]` or `[ux]` on the story, and that wakes them.
- **The business manager keeps Backlog and `[bm]` tags**, and leaves To Do.

## Labels for roles with more than one agent

**Developers: `dev1` and `dev2`, as today.** A story stays with its developer for its whole
life, across separate workers: build, review fixes, merge, Failed QA fixes. That developer's
checkout holds the branch, so the label routes every step to the right one. Ready For Dev is
shared: whichever developer claims a story first labels it.

**Testers: `qa1`, `qa2` and `qa3`, as a record, not a routing rule.**

- When a tester moves a story to In QA, `sq` adds that tester's label, so anyone can see who
  to tag (`[qa2]`) with a question about the result.
- A story back in Ready For QA after a failure goes to the tester who failed it first, for
  30 minutes. That tester wrote the report, and their stack has the data set up.
- After that, any free tester takes it. Retests should not wait behind a busy tester while
  two others are idle; testing needs no one stack the way a build needs one branch.
- Claims stay in `sq`, as now, so two testers can never take one story, label or not.

Tester 1's role stays `qa` and its tag stays `[qa]`; only the label is `qa1`, to match
`dev1`. No other role has more than one agent. More capacity means a new instance, such as
`dev3` with its own label and checkout, the way `dev2` works.

## What changes in the repository

- the queues in `ROLES`, and the developer queue's order: Failed Code Review and Failed QA
  first;
- the move back to In Review on a push after a pass;
- the tech lead's skill: it moves a story to Passed or Failed Code Review, rather than
  leaving a pass in In Review or sending findings to In Progress;
- the state names in the developer, product manager and designer skills;
- the QA labels on claim, and the 30-minute retest preference;
- a test for each wake, beside the existing ones in `tools/queue/tests`.

The product manager then sorts the stories now in To Do into the new states, in one sweep.
