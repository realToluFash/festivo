# Handoff — epic 38 · AI assistance

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/38
- **Page to use:** `38 · AI assistance` in Soirely — Redesign

## What this area is

An assistant reachable from anywhere, which already knows what is on screen and which
event somebody is in. It drafts a seating plan, a running order, a message.

## Candidate artboards

- **Assistant** — the conversation
- **Seating and Assistant on Tablet** — the assistant in context, on a tablet

## Layouts, and why

**All four.** A docked panel on the desktop, a sheet on a phone, a floating panel on a
tablet. Reachable from every screen, in whatever form suits the surface.

## What these screens must honour

- **It proposes and never acts.** A suggestion sits **beside what is already there** and is
  accepted, partly accepted, or discarded. Nothing changes on its own.
- **What it looked at is visible** — "read the guest list, checked table capacities".
  An answer with no visible basis does not get believed.
- It costs credits, and what it is spending is not a surprise.
- Three distinct unavailable states: not here, busy and worth retrying, declining. One of
  those is worth retrying and two are not.

## Traps specific to this epic

- A drafted thing **looks finished**, which makes this the easiest place to break the
  propose-never-act rule. Applying must be a separate, visible act.
- Discarding has to be as easy as accepting, because it will sometimes be wrong.
- Starter suggestions are per-screen, plus what this person asked recently.
