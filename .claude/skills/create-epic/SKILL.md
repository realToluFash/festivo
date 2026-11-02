---
name: create-epic
description: Turn a scope of work into a Soirely epic — one outcome for the product, described so that the stories under it can be written without re-deciding anything. Use when starting a new area of work, or when stories are piling up with no epic to hang them on.
disable-model-invocation: true
user-invocable: true
argument-hint: <the scope of work>
arguments: [scope]
---

# Create Epic Skill

You are turning a scope of work into a Shortcut epic.

`$scope` is usually a few words — "auth", "the seating canvas", "billing". Your job is to
work out what that scope actually contains, write it down so the stories under it can be
drafted without re-litigating the shape, and create the epic.

**Tools.** Read and write Shortcut only through `sq pm`; `sq pm help` lists what you may
run. Never call the Shortcut tools or `gh` directly. Only the product manager creates
epics.

## What an epic is here

**An epic is a scope of work, not a stack.** This is the thing that distinguishes this
project's setup from the one it replaced.

"Auth" is one epic. It covers the Symfony authenticators, the mobile sign-in screens and
whatever the guest web pages need, together — because they are one outcome and they are
only finished at the same moment. An epic called "Auth API" with a sibling called "Auth
mobile" is two halves of a thing that was never two things, and it produces the failure
the monorepo exists to prevent: a backend that shipped weeks before anything could call it.

An epic is **not**:

- a layer — "Doctrine entities", "the API", "the screens"
- a sprint's worth of unrelated work
- a single pull request, which is a story

If the scope you are given is a layer, say so and propose the outcome it belongs to.

## Step 1: Work out what is in it

Before writing anything, establish the real boundary.

1. **Read what exists.** The repository is new, so for most scopes the honest answer is
   "nothing yet" — but check `services/api`, `apps/mobile`, `apps/web` for anything already
   landed that this scope would touch or contradict.
2. **Read the reference implementation.** The previous Go build is at
   `~/festivo-backup-pre-symfony-2026-10-11`. It answered most of these questions once
   already. It is reference, not a base — but an epic written without reading how the
   problem was solved before will rediscover its mistakes.
3. **List the surfaces the scope touches.** Each needs its own stories later:
   - `services/api` — endpoints, entities, migrations, Mercure topics
   - `apps/mobile` — screens, and which of the three layouts each one needs
   - `apps/web` — guest-facing or marketing pages
   - `services/support` — anything the support console must see
   - `infra` — compose services, environment, CI

Never invent a field, endpoint or screen name. If you cannot establish one, it is a
question for Step 2.

## Step 2: Find the gaps and ask

Ask about anything that would **materially change the epic's boundary**. Batch the
questions into one message. The ones worth asking most often:

- **Where does this scope stop?** The commonest defect in an epic is a fuzzy edge that
  turns into an argument three stories in. Name what is explicitly out.
- **What does it depend on?** An epic that cannot start until another lands should say so
  by name, so the ordering is visible rather than discovered.
- **Is there a decision the previous build got wrong** that this is the chance to fix?
- **What is the smallest version that is genuinely usable?** Epics that must land whole
  are a risk; ones with a usable floor are not.

Skip what plainly does not apply, but skip it consciously.

## Step 3: Draft in the house format

Four H2 sections. Keep it short — the epic orients, the stories specify.

```markdown
## Outcome

One paragraph. What is true for a user when this epic is done that is not true now.
Written about the product, not the code.

## Scope

- Bullets naming the substantive pieces, grouped by surface where that helps.
- Each bullet should be recognisable as one or more future stories.

**Out of scope:** what a reasonable person might expect to be in here and is not, and
where it lives instead.

## Depends on

Named epics that must land first, and why. `Nothing.` if it stands alone.

## Carried forward

What the previous implementation learned about this scope — the decisions worth keeping
and the ones worth not repeating. `Nothing.` if this is genuinely new ground.
```

### Why "Carried forward" is not optional padding

The previous build is 1,670 commits of solved problems, and the expensive ones were
rarely the obvious ones. An epic that does not record them invites the same bug twice.
Real examples worth the shape of:

- Every event-scoped route needed an access check mounted on it; the one that forgot was
  not found by any test, because it worked perfectly for anybody who was allowed in.
- Plus-ones had to read the host's RSVP, not their own, or a guest whose host declined
  still counted as attending.
- A realtime publish with no matching subscriber on the client died silently — no error,
  no log, just a screen that never updated.

If the scope has none of this, write `Nothing.` and move on. Do not invent lessons.

## Step 4: Show the draft and wait

**Do not create the epic yet.** An epic is the frame every story under it inherits, and
it is read by more people than it is written by.

Show the full markdown and ask for confirmation or amendment. If Step 2 raised questions
that went unanswered, list the assumptions you made so they can be corrected.

Only proceed on explicit approval.

## Step 5: Create it

Workspace **soirely**. The destination is fixed — do not ask, and do not let the model
pick. `sq` sets the team and the owner itself:

```sh
sq pm new-epic --name "Guests & RSVP" < draft.md
```

It prints the epic id and its URL. Name the epic after the outcome, not the mechanism — `Guests & RSVP`,
not `Guest endpoints`. Keep names short enough to read in a list.

## Step 6: Report

Give the epic ID and URL, the name, and one line on any assumption worth checking.

Suggest `/create-ticket` for the first story under it, and say which story you would write
first and why — usually the one that makes the rest reviewable.

## Guidelines

- An epic nobody can tell when to close is written wrong. The Outcome paragraph is the
  closing condition.
- Prefer a boundary that is slightly too small. A second epic is cheap; an epic that never
  ends is not.
- Do not create an epic per stack. If you find yourself writing "...(API)" in the name,
  stop and reconsider the boundary.
- If `$scope` is really two scopes, say so and offer to draft both.
