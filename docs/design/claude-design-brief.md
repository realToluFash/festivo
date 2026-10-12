# Brief for Claude Design — the Soirely design context

> Paste everything below the line into Claude Design. It is written to stand on
> its own: a designer reading it needs no access to this repository.
>
> Keep this file as the brief is revised, so the design context and the brief it
> came from stay together. What comes back lands in `docs/design/` beside it.

---

## What you are designing

**Soirely** is event management software. One person — an organiser — plans an
event over weeks and then runs it in one night. Weddings, conferences, funerals,
birthdays, launches. Four hundred guests, a seating plan, a menu with dietary
variants, a budget, a running order, a team of staff.

It is sold globally and speaks **English, Spanish, French and Portuguese** from
day one.

You are designing its **design context**: the tokens, typography, components and
layout patterns that every screen will be built from, plus a page on each
surface that displays them all. Not screens — the vocabulary screens are made
of.

## Three surfaces, three completely different situations

This is the part that should shape the design. The same product is used in three
places that have almost nothing in common, and a system that treats them as one
responsive continuum will be wrong in all three.

### Web — planning, at a desk

A person with a keyboard, a wide monitor and a spreadsheet mindset. Four hundred
rows of guests. Drag a guest to a table. Reconcile dietary choices against a
menu. Chase eleven bounced invitations.

**Desktop-first, genuinely** — not a phone layout stretched across a monitor.
Dense tables, a persistent sidebar, keyboard navigation that actually goes
somewhere, and a content area that uses a 2560px screen rather than centring
1200px of it.

The same web application also serves two audiences the organiser is not:

- **A guest.** No account, will never install anything, arrives from a link in
  an email, probably on a phone, possibly elderly, possibly annoyed. Replies to
  an invitation, picks a meal, reads where they are sitting. This has to be the
  simplest thing in the product.
- **Somebody who has never heard of Soirely.** The marketing and sign-up pages.

### Mobile — running the night

A dim room at nine in the evening. One hand free; the other is holding plates, a
clipboard or a phone torch. Noise. A server who needs to know which table is
waiting and which guest has the nut allergy, in one glance, while walking.

Three layouts, and they are **structurally different rather than rescaled**:

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **Phone**            | one thing at a time; controls within a thumb's reach of the bottom |
| **Tablet portrait**  | two columns, detail stacked beneath the list                       |
| **Tablet landscape** | a list beside a detail pane that stays put                         |

A tablet on a stand at a kitchen pass is a real deployment, not an edge case.

**A dark theme is a product requirement here, not a preference.** A white screen
at full brightness in a dim venue is both unusable and rude to the room. Treat
the night-time appearance as the primary one for this surface and the light one
as the alternate — the opposite of the web.

### Support — an agent console

Seven o'clock on a Saturday. A customer's service floor has stopped working
mid-event. An agent has to read an account's whole history in ten seconds and
act.

Read-heavy, information-dense, keyboard-driven. One timeline per account,
organisation and event — _signed up → verified → joined an organisation →
created an event → sent 412 invitations, 11 bounced → upgraded → started
service_. Search that accepts any identifier the customer happens to have: an
email, a phone number, an event name, a correlation id, an invoice number.

Two queues that must look different at a glance: the normal one, and the one for
a broken event in progress. The second is not a priority flag on the first.

This surface is used all day by a handful of people who will become expert in
it. Optimise for speed and density over friendliness. It should not look like a
different product, but it should not be styled as if an organiser were reading
it either.

## Start by proposing directions — do not start building

**First, propose four distinct visual directions**, each as:

- background and surface hex, ink and muted-ink hex, one accent hex
- a typeface pairing, named
- one line on why it fits _this_ product
- one line on what it would feel wrong for

Then stop and wait for a choice. Build out only the chosen direction.

This matters because the brief is otherwise wide open and the first instinct is
rarely the best one for a product that has to feel calm during a crisis.

### Deliberately away from the previous attempt

A previous version of this product used **`#5B3BF5` violet on an off-white
`#F3F2F8`, with Space Grotesk**. That palette is still sitting in the codebase
as a placeholder and is being removed. **None of the four directions should be a
variation of it.** No violet-to-indigo brand, no Space Grotesk.

Avoid, as well, the aesthetic every tool converges on when unsupervised: Inter,
Roboto, system-ui as a _choice_; purple or blue gradients; a card grid with
identical radii and a drop shadow; a palette that could belong to any SaaS
product. This one has a specific character available to it — events are
hospitality, warmth, ceremony and controlled panic — and nothing about that is
generic.

Also avoid the other default: cream background, serif display type, terracotta
accent, italic word-accents. It is a real aesthetic and it is overused for
exactly this kind of brief.

## What to deliver, once a direction is chosen

### 1. Tokens, as one declaration

Colour, type, spacing, radii, borders, shadow, motion, and the per-surface
exceptions. Named by **role, not by appearance** — `--surface-raised`, not
`--grey-100` — because a dark theme and a light theme have to share the names.

Every colour that carries meaning needs its full set: default, hover, active,
disabled, and the ink that goes on it.

State the contrast ratio for each text-on-background pair. **4.5:1 minimum for
body text, 3:1 for large text and for the focus ring.** The guest surface and
the night-time mobile surface are where this will actually be tested — a
seventy-year-old reading an invitation on a phone in a car, and a server in a
dim room.

### 2. Typography

A scale with a stated purpose per step, not a ratio for its own sake. Say which
step is the table row, which is the body, which is the one number on a screen
somebody reads from two metres away.

**Weights, not families, are how weight is selected.** A custom face ships one
file per weight and the mapping is by weight; name the weights you use and keep
them few.

The scale must survive four languages. French and Portuguese run roughly 20–30%
longer than English for the same sentence. **No fixed-width labels, no text
fitted tightly to a button, no truncation as a layout strategy.** Say what
happens when a label does not fit.

### 3. Components, with every state

For each: anatomy, sizes, the states (default, hover, focus-visible, active,
disabled, loading, error, empty), and what it must never be used for.

What this product needs, from the work actually coming:

|                      |                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data**             | dense table with sortable and sticky headers, row selection, inline edit; list row; definition list; timeline; stat; tag and status pill; avatar and avatar group                                      |
| **Input**            | text, textarea, number, select, combobox with search, date and date-range, time, checkbox, radio, switch, file drop, quantity stepper                                                                  |
| **Action**           | button in primary / secondary / quiet / destructive; icon button; button group; split button; link                                                                                                     |
| **Structure**        | page header with actions; sidebar navigation; tabs; accordion; card; panel; divider; toolbar; breadcrumb                                                                                               |
| **Overlay**          | modal; drawer; bottom sheet (mobile); popover; menu; tooltip; toast                                                                                                                                    |
| **Feedback**         | inline validation; banner in info / success / warning / danger; empty state; loading skeleton; progress; confirmation for destructive actions                                                          |
| **Product-specific** | guest row with RSVP state; table and seat on a floor plan; course and dish with dietary marks; schedule item on a timeline; invitation card as a guest sees it; delivery-status row for a sent message |

Three that need particular thought, because they are where this product lives:

- **The seating plan.** A canvas of tables and seats, zoomable, with guests
  dragged onto chairs. What a table looks like at four zoom levels; how an
  unseated guest reads; how a selected seat reads; how it works with a finger
  rather than a mouse.
- **The service floor.** A view a server glances at while walking. What state a
  table is in, what is waiting, what is urgent — legible in a dim room, at
  arm's length, in under a second.
- **The empty state.** An organiser's first hour is entirely empty screens. They
  are the most-seen screens in the product and usually the least designed.

### 4. Layout patterns

Per surface, with the actual grid: the web application shell; the web public
page; the web guest page; the three mobile layouts; the support console shell.

Say where the breakpoints are and what _changes structurally_ at each — not what
rescales.

Two platform facts to design within rather than around:

- Android draws the app behind the status and navigation bars. Content is kept
  clear of them by the layout, so say what the safe area does to each pattern.
- A keyboard covering the lower third of a phone screen is the normal state
  while typing. Say where the submit control goes.

### 5. Motion and feedback

Durations and easing, as tokens. What animates and what must not. **Honour
`prefers-reduced-motion`** — state the reduced variant for anything that moves.

Say what a 300ms wait looks like versus a 3-second one, and what an optimistic
action looks like when it fails.

### 6. A gallery page per surface — the part that keeps this honest

A single page on **web**, on **support** and in the **mobile app** that renders
every component in every state, reading from the tokens.

Not a static specimen sheet. A page a developer opens to copy from, a designer
opens to check against, and that visibly breaks when a token changes — which is
the only thing that keeps a design system and a codebase from drifting apart
over sixteen scopes of work.

Each entry shows: the component, its states side by side, and the token names it
consumes.

## Non-negotiables, because the code already enforces them

- **Four locales**, all equal. Nothing designed English-first and translated later.
- **`focus-visible` on everything reachable by keyboard**, and a focus ring that
  survives on every background in the palette.
- **A skip link** to the content on every full page.
- **`prefers-reduced-motion`** honoured.
- **Contrast**: 4.5:1 body, 3:1 large text and focus ring.
- **Mobile: weights only, never a font family in a style.** And never a text
  element nested inside another text element — two adjacent ones instead.
- **A menu or popover is a top-level overlay**, never rendered inside a card,
  which clips it.
- **Dark theme defined for mobile**, and light defined for web and support. Both
  use the same token names.

## How to answer

1. The four directions, then stop.
2. After a direction is chosen: tokens first, then typography, then components,
   then layouts, then motion, then the gallery.
3. For every decision that could have gone the other way, one sentence on why it
   went this way. A design context without reasons gets overridden by the first
   developer who disagrees with it.
