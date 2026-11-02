---
name: review-ac
description: Review the acceptance criteria on a Soirely story for completeness and QA readiness, and flag drift between the AC and any linked pull request. Use before moving a story to review, or when AC no longer describes what was built.
disable-model-invocation: true
user-invocable: true
argument-hint: <shortcut-story-id>
arguments: [story_id]
---

# AC Review Skill

You are reviewing the acceptance criteria on story `$story_id` for completeness, and
checking whether what was built still matches what was asked for.

**Tools.** Read only through `sq <your role>` — the product manager runs it, so the examples
use `sq pm`. `sq pm help` lists what the role may run. Never call the Shortcut tools or `gh`
yourself. A thing you read on an earlier run and that has not changed prints as a one-line
reference; use `--again` only if you truly need its full text again.

## Step 1: Gather context

1. `sq pm story sc-$story_id`: the story, its links, related stories and pull requests
2. `sq pm history sc-$story_id` for how it has changed
3. The epic it belongs to, `sq pm epic <n>` — the scope boundary and its carried-forward
   notes both change what the AC ought to cover
4. Any related or linked stories, `sq pm story sc-<n> --section AC` each

## Step 2: Gather the pull request

For each pull request the story lists:

1. `sq pm pr <n>` for its status and body, and `sq pm diff <n>` for the file list, then
   `sq pm diff <n> <path> [<path>…]` for the files that matter (`--all` for every one)
2. Note what was actually implemented against what the AC describes

Drift in either direction matters. Code with no AC behind it is unverifiable by QA; AC
with no code behind it is a story that is not finished.

## Step 3: Check against the standard

Run the AC through the same checklist `create-ticket` writes to. For each surface the
story touches, ask whether the AC covers it:

| Surface            | Look for                                                      |
| ------------------ | ------------------------------------------------------------- |
| API endpoint       | status codes, response shape, who is refused and with what    |
| Doctrine migration | what happens to rows predating the change                     |
| Mobile screen      | all three layouts, keyboard behaviour, empty and error states |
| Web page           | responsive behaviour, what an unauthenticated visitor sees    |
| Mercure topic      | what the client does on receive, and after a reconnect gap    |
| Permission         | who can, who cannot, what the refusal looks like              |
| User-facing copy   | every string present in all four locales                      |

Then the cross-cutting ones, which are missed most often:

- the unmatched or out-of-range input
- the empty state
- what must keep working unchanged

## Step 4: Report

```
## AC Review: sc-<id> — <title>

### Summary
What the story covers and an overall read on the AC.

### Gaps
Relevant checklist items the AC is missing. For each: what is missing, why it
matters, and suggested AC text ready to paste.

### Ambiguities
Language two people would read differently. Give concrete rewording.

### PR vs AC drift
Behaviour in the PR that no AC bullet covers, and AC bullets nothing implements.
Critical for QA — lead with this when there is any.

### QA steps
How to verify this by hand, based on what the AC says and the PR does.

### Recommendations
Ordered by how much each one improves QA's ability to verify the work.
```

## Guidelines

- Be practical, not pedantic. Do not flag gaps that genuinely do not apply.
- Prioritise by impact. A missing permission bullet matters more than wording.
- If the AC is solid, say so. Do not invent problems to look thorough.
- QA is the audience. The question is always "could somebody check this on a screen".
