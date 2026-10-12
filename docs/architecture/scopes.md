# How the system is divided

This document explains why the epics are the epics. It is the one place that argues about
boundaries; everything else assumes them.

## The rule

**A scope owns a set of facts, and each fact has exactly one owner.**

Not a layer, not a screen, not a noun. If two scopes both need to know something, one of
them owns it and the other asks. If neither owns it, you have found a scope that does not
exist yet.

The test for a scope is: _can you say when it is finished?_ "Messaging" can — guests and
staff reliably get told things. "Push notifications" cannot, because it is a detail of
something else that was given its own namespace.

## What the previous build actually looked like

The Go implementation had 28 modules. Nine of them were under 700 lines, and reading their
exported surface says plainly what they were:

| Module        | Its entire job                                      | What it actually was                   |
| ------------- | --------------------------------------------------- | -------------------------------------- |
| `push`        | `RegisterToken`, `UnregisterToken`, `DisableToken`  | a token store for one delivery channel |
| `reminders`   | `SendConfirmation`, `RunSweep`                      | two scheduled sends                    |
| `aiprices`    | `Fetch`, `CostUSD`, `Credits`                       | a price table for the meter            |
| `places`      | `Autocomplete`, `Details`                           | a Google Places proxy                  |
| `groups`      | `List`, `Create`, `Update`, `Delete`                | CRUD on a guest attribute              |
| `sectionsync` | `AfterSectionWrite`, `AfterGroupWrite`, `Reconcile` | —                                      |

That last row is the important one. A module whose whole exported surface is write hooks
and a `Reconcile` function is not a feature. It is the maintenance cost of having stored
the same fact in two places, promoted to a namespace. Nothing was wrong with the code in
it; the code should not have needed to exist.

The fragmentation compounds. Six modules and 10,223 lines were spent on one idea:

```
notifications 6471 + feed 2024 + announcements 670
+ messagetemplates 612 + push 291 + reminders 155
```

An announcement, a reminder, an invitation and an in-app feed item are the same thing sent
for different reasons. Splitting them meant each learned the rules separately, and they
disagreed. One rule — _browser push rides along with another channel and is never chosen
instead of one_ — ended up written twice, in `pickChannels` and again in the composer's
`plan()`, because neither module owned it.

Guests cost 9,227 lines across `guests`, `invite` and `groups`, which is why a plus-one
whose host declined still counted as attending until it was patched: the dependency
between two guests was not modelled, because the thing that would have modelled it lived
in a different module from the thing that read it.

## The division

Sixteen scopes. Each owns its facts.

### Ground

**Foundation** — the toolchain, CI, local stack, Mercure, file storage, the Places proxy.
Everything that is plumbing rather than product. `uploads` and `places` fold in here;
neither was ever a scope.

### Identity

**Accounts & sign-in** — proving you are who you say. Registration, sessions, OAuth, MFA,
verification, recovery. Owns: credentials, identities, sessions.

**Organisations & access control** — what you are allowed to do. Organisations, members,
roles, permissions, member invitations. Owns: the authorisation model.

These are two scopes rather than one because they answer different questions and fail
differently. Conflating them is how an access check becomes something each route remembers
to do rather than something the framework enforces.

### The event

**Events** — the event itself and its lifecycle. Owns: the event record, its states, and
the rule that every event-scoped thing is reached through it.

**Guests** — everyone invited and everything true about them: the list, groups, dietary
needs, the invitation, their reply, their plus-ones, and whether they turned up. Absorbs
`invite` and `groups`. A plus-one is modelled as a guest whose attendance depends on
another guest's, from the first migration, not as a flag added later.

**Venue & seating** — sections, tables, rows, loose chairs, and who sits where. Absorbs
`sectionsync` by not needing it: a section is stored once, and guest grouping reads it
rather than keeping a parallel copy.

**Menu & dietary** — courses, dishes, variants, and each guest's choices.

**Run of show** — the schedule, the stage screen, the presenter console.

**Staffing** — who works the event and what they are responsible for. Distinct from
organisation members: a hired waiter works one night and is not in your company. The
previous build conflated these and had to re-scope personnel to the organisation after the
fact.

### The night

**Service floor** — the plate's journey from kitchen to table, and every request a guest
makes while sitting at it. The one scope carried over largely intact; it was designed late,
with the benefit of everything learned before it.

### Across everything

**Messaging** — one machine. A message has an audience, a set of channels, a template and
a trigger. An invitation is a message triggered by publishing; a reminder is one triggered
by a clock; an announcement is one triggered by a person; the in-app feed is a channel.
Absorbs `notifications`, `feed`, `announcements`, `messagetemplates`, `push` and
`reminders`. Channel-selection rules live here once.

**Plans & billing** — tiers, limits, metering, credits. Absorbs `aiprices`. There is one
meter; anything that costs money reports to it. The previous build billed AI requests
twice because a second meter was written by somebody who searched for "credit" and found
nothing, the first one having been called "usage".

**AI assistance** — the assisted flows, their prompts, and what they cost. Separate from
the features that use it so the cost and the prompt surface have an owner.

**Support** — customer support and the agent console.

**Insights** — reporting for the organiser.

**Marketing site** — the public pages.

## What this buys

Twenty-eight modules become sixteen scopes. The cuts are not cosmetic:

- No `sectionsync`, because nothing is stored twice.
- One place that decides how a message reaches somebody, so the rule cannot be written
  twice and disagree with itself.
- One meter, so nothing is billed twice.
- Plus-ones and staffing modelled correctly on the first migration rather than corrected
  by one later.

## Which surface owns what

The product has two interfaces and they are not the same product at different sizes. The
work splits by where it actually happens.

|                                           | Primary                                                             | Companion                         |
| ----------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| Accounts, organisations, billing          | **web**                                                             | mobile sign-in                    |
| Guests, seating, menu, schedule, staffing | **web** — desktop work, spreadsheet-adjacent                        | mobile for review and quick edits |
| Service floor, arrivals, run of show      | **mobile and tablet** — a server carrying plates is not at a laptop | a web pass view                   |
| Guest invitations and RSVP                | **web** — guests will never install an app                          | —                                 |
| Marketing                                 | **web**                                                             | —                                 |

So it is not "web primary, mobile secondary". It is **planning on the web, the night on
mobile**, and each epic should say which it is.

What the two share is `packages/api-client` and `packages/domain` — the wire types and the
rules. Not the interface: React Native's primitives fight dense desktop work, and sharing
across two genuinely different interaction models costs more than it returns. A rule
implemented twice will diverge; a button implemented twice will not.

## The design context

Every scope's screens are built from one vocabulary rather than sixteen. The tokens, the
type scale, the components and the layout patterns live in `docs/design/`, and each surface
carries a gallery page rendering all of them — which is the only thing that keeps the
design and the code from drifting apart across sixteen scopes.

`docs/design/claude-design-brief.md` is the brief that produced it, kept beside it so a
revision to either is a diff rather than an argument from memory.

**A design is reproduced, then wired, then translated** — in that order, stopping between.
Approximating one is how it drifts, and the drift is never visible in the pull request that
caused it.

## When to add a scope

When a set of facts has no owner. Not when a file gets long, and not when something needs
somewhere to live — that is the instinct that produced `sectionsync`. If a proposed scope
cannot be finished, it is part of one that can.
