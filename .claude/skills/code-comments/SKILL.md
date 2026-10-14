---
name: code-comments
description: Code carries almost no comments. The pull request explains the change, the commit explains why it was made, and the code explains itself through naming — so a comment has to earn its place by preventing a mistake. Use when writing or reviewing any file in this repository.
---

# Comments

**Default to none.** The pull request describes the change, the commit message says why it
was made, and the code says what it does. A comment repeating any of those is a third copy
of a fact — and the one that rots first, because nothing fails when it stops being true.

A comment is not documentation. It is an assertion with no test behind it.

## The two tests

Before writing one, both must pass:

1. **Would a reader break something by not knowing this?** Not "would they find it
   interesting" — would they delete a line, reorder two, or change a value, and be wrong.
2. **Is it still true a year from now, independent of this change?** A sentence that only
   makes sense as a description of what you are doing today belongs in the commit message.

If the answer to either is no, delete it and put the thought in the pull request.

## What still earns a comment

- **A trap in the platform.** "`user` is reserved in Postgres, so this name is quoted." Take
  it out and somebody writes the unquoted query next week.
- **An ordering that looks arbitrary and is not.** "This check runs before the membership
  check, never instead of it."
- **A guard that looks removable.** Anything whose absence is silent — a test that exists
  to catch one specific regression, a line that looks redundant and is load-bearing.
- **A value somebody will want to change and should not.** The reason, in one line.
- **A pointer to the authority** — a ticket id, an RFC section, a provider's documented
  behaviour. One line and a reference, not a summary of it.

One or two lines. If it needs a paragraph, it is design rationale, and design rationale
goes in the pull request where it can be discussed and where it stops being read once it is
no longer the current decision.

## What does not

- Restating the code. `// loop over the guests` above a loop over the guests.
- Narrating the change. "Now also handles the dormant case." That is the commit.
- Design rationale at length, or an argument for the approach. That is the pull request.
- Section banners and decorative dividers.
- Commented-out code. Delete it; git has it.
- A `TODO` with no ticket. Either file it or fix it.
- Anything a better name would have said. Rename instead — see the **name-things** skill.

## Type annotations are not comments

PHPDoc that carries type information the language cannot express stays, always:

```php
/** @extends ServiceEntityRepository<User> */
/** @param array<string, string> $parts */
/** @return list<Suggestion> */
```

Those are read by static analysis and by the next person's editor. Generics, array shapes
and `list<>` have no syntax in PHP, so the docblock is the only place they exist. Same for
a TypeScript `@ts-expect-error` with its reason, and for a JSDoc type on an untyped
boundary.

Strip the prose from a docblock; keep the types.

## Where the explanation goes instead

| The thought                          | Where it belongs         |
| ------------------------------------ | ------------------------ |
| What this change does                | the pull request         |
| Why we made it, and what we rejected | the pull request         |
| Why this commit exists on its own    | the commit message       |
| What the code does                   | the code, through naming |
| What will break if you touch this    | a comment, one line      |
| What the acceptance criteria were    | the Shortcut story       |
| How the whole area works             | `docs/architecture/`     |

## The existing codebase disagrees with this

Much of what is already here carries long explanatory docblocks, written before this rule.
**Do not bulk-strip them** — a sweep that rewrites every file makes every blame line
useless and reviews as noise.

Instead: when you are already editing a file for another reason, bring the comments in it
down to this standard as part of that change, and say so in the pull request. The style
converges where work happens, and nowhere else.
