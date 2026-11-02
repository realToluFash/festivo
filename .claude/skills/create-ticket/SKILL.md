---
name: create-ticket
description: Draft a Soirely story in the house style — a Description that orients the reader and AC that QA can verify without reading code — then create it under an epic once approved. Use when someone describes work that needs a ticket.
disable-model-invocation: true
user-invocable: true
argument-hint: <rough description of the work>
arguments: [request]
---

# Create Ticket Skill

You are turning a rough description of some work into a Shortcut story that QA can verify
without reading code.

`$request` is usually a few sentences. Turn it into a **Description** and **AC** in the
house format, fill the gaps by asking, and only then create the story.

**Tools.** Read and write Shortcut only through `sq <your role>` (`sq pm` in the examples
below; developers, the creative director and the linguists use their own); `sq <your role>
help` lists what you may run. Never call the Shortcut tools or `gh` directly.

## One story, one pull request

A story is the unit that becomes a PR. If it cannot land as one reviewable PR, it is two
stories — say so and offer to draft both.

This is not the same as one story per stack. A story that adds a dietary-tag field is
reasonably one PR touching the Symfony entity, the mobile form and the guest page
together, because splitting it leaves a column nothing writes to. Split by **outcome**,
not by directory. See `cross-stack-change` for how one of these is built and reviewed.

## Step 1: Understand the work

Vague AC comes from vague understanding, and AC naming the wrong field is worse than none.

1. **Search the codebase** for the area named in `$request`. You need real names: the
   screen, the route, the entity, the field labels, the exact options an enum offers.
2. **Read the epic** this belongs under (`sq pm epic N`). It carries the scope boundary and the "carried
   forward" notes, both of which change what the AC must say.
3. **Check the reference implementation** at `~/festivo-backup-pre-symfony-2026-10-11` if
   the behaviour existed before. How it actually worked is often the clearest AC available
   — and where it was wrong, the story should say what is changing.
4. **Note which surfaces the change touches**, because each carries its own AC
   expectations:

   | Surface                     | AC must cover                                                 |
   | --------------------------- | ------------------------------------------------------------- |
   | `services/api` endpoint     | status codes, the shape of the response, who is refused       |
   | Doctrine entity / migration | what happens to rows that predate the change                  |
   | `apps/mobile` screen        | all three layouts, keyboard behaviour, empty and error states |
   | `apps/web` page             | responsive behaviour, what an unauthenticated visitor sees    |
   | Mercure topic               | what the client does on receive, and on reconnect after a gap |
   | permission                  | who can, who cannot, and what the refusal looks like          |

Never invent a field name, option value or label. If you cannot find it, that is a
question for Step 2, not a guess.

## Step 2: Find the gaps and ask

Ask about anything that would **materially change the ticket**. Batch into one message.
The gaps that are missed most often here:

- **The unmatched value.** What happens when input does not map to any option the field
  offers — blank, default, or refusal. This is the single most commonly missing criterion.
- **Failure behaviour.** What the user sees when it does not work, not just that it fails.
- **Access control.** Who can do this, and what an unauthorised attempt gets back.
- **Pre-existing rows.** What a migration does to data created before the change.
- **Live updates.** If something on screen changes as a result, does another open session
  see it without a reload, and on which Mercure topic.
- **Regression surface.** The nearby behaviour that must keep working untouched.
- **Empty states, sorting, pagination, exports.**

Do not ask about what plainly does not apply. A migration-only story needs no layout AC.
Skip consciously, do not omit accidentally.

## Step 3: Draft in the house format

Two H1 sections, `# Description` and `# AC`.

### Description

Three things, in this order, in prose:

1. **What is missing or wrong**, in one or two sentences.
2. **Where it lives and how a user reaches it** — the navigation path, spelled out. QA has
   to find the thing before they can test it. For an API-only change, the method and route.
3. **Any framing rule** governing the whole change — whether new data replaces or merges
   with what is there, whether the change is behind a flag, what "off" looks like.

Keep it short. Its job is orientation; the AC carries the detail.

### AC

A flat list of `-` bullets, nested one level with four spaces for field-level detail.

- **Bold** every screen, section, field and button name exactly as it appears.
- Enumerate the exact options a field offers rather than describing them.
- State rules precisely enough that two people would pick the same value. "The highest
  amount that does not exceed the figure in the document" is verifiable; "the closest
  match" is not.
- One behaviour per bullet. Do not bundle.
- Include the unmatched-input case.
- Close with a regression bullet naming what must keep working unchanged.

### Worked example

```markdown
# Description

A guest's dietary requirements are collected at RSVP but the kitchen never sees them —
the service floor shows a plate with no indication that it has to be different, so the
first time anyone finds out is when it reaches the table.

Dietary tags are set by the guest on the RSVP page (`/invite/<token>`) and by the
organiser on **Guests** > a guest > **Dietary**. They need to reach **Service** >
**Pass**, on the seat card and in the kitchen ticket. Tags replace whatever is on the
seat rather than merging, so clearing them on the guest clears them on the floor.

# AC

- A seat whose guest has one or more dietary tags shows them on the seat card in **Service** > **Pass**:
  - The tag names exactly as stored — Vegetarian, Vegan, Halal, Kosher, Gluten-free, Nut allergy, Dairy-free
  - Where a guest has more than two, the first two show and the rest collapse to a count
- The kitchen ticket for that seat lists every tag in full, with no collapsing.
- A tag added or removed on the guest reaches an open **Pass** screen without a reload, on the `event/<id>/service` Mercure topic.
- A guest with no tags shows nothing in either place — not an empty chip, not "None".
- A tag value that is not one of the seven listed options is ignored rather than displayed, and is reported once in the server log.
- Seat state, plate progress and the existing seat-card layout keep working as they do now.
```

That example names the exact navigation path, states the replace-not-merge rule up front,
enumerates the options, handles both the empty and the unmatched case, covers the live
update, and protects the neighbouring behaviour. Match it.

## Step 4: Show the draft and wait

**Do not create the story yet.** Show the full markdown and ask for confirmation or
amendment. List any assumption you made where Step 2 went unanswered.

Only proceed on explicit approval.

## Step 5: Confirm the destination

Workspace **soirely**. `sq` fixes the team and the workflow, and names states rather than
ids. A new story is Backlog or To Do; the three QA states belong to work already built —
see **soirely-qa-tester**. Only the product manager may create one straight into To Do;
everyone else's starts in Backlog and the PM moves it on.

**Ask for the epic.** Never guess it — a story under the wrong epic is invisible to
whoever is working that scope. List the open epics (`sq pm epics`) and present them,
offering "no epic" as a choice for genuine one-offs.

Also ask, where not obvious:

- story type — feature, bug or chore
- workflow state — default to **Backlog** unless it is being started now
- estimate, if one is wanted — the scale is 0, 1, 2, 4, 8

## Step 6: Create it

Pipe the drafted markdown in as the description:

```sh
sq pm new-story --name "Show dietary tags on the service floor" --epic 31 \
  --state Backlog --type feature --estimate 2 < draft.md
```

`--epic` is required: every story belongs to an epic. Find the one it fits with
`sq <role> epics` (and `sq <role> epic N` to check its scope); if none suits it, make one
with `sq <role> new-epic --name "…"`, the why on stdin, and file the story in it. A new
epic waits for the owner's approval before any of its stories is built. `--label` adds
labels; leave out `--estimate` if none was wanted. It prints the story id, its URL and the branch name. Name the story after
the outcome rather than the mechanism — "Show dietary tags on the service floor", not
"Add dietary field to seat".

## Step 7: Report

Give the story ID and URL, the title, the epic, and one line on any assumption to check.

Give the branch name for the work — the one `new-story` printed, which Shortcut will
recognise, so the story moves itself when the PR opens.

Suggest `/review-ac <id>` once the work is under way.

## Guidelines

- The audience is QA, not the author. Every bullet is something a person can go and check.
- Prefer too specific over too general. "Sorted by surname, A–Z" beats "sorted sensibly".
- If the request is genuinely too vague for testable AC, and asking has not fixed it, say
  so rather than producing plausible filler.
- One story, one outcome. Two unrelated changes are two stories.
