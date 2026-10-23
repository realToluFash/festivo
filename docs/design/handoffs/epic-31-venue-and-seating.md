# Handoff — epic 31 · Venue and seating

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/31
- **Artifact title to use:** `Soirely — Venue and seating`

## What this area is

Laying out a room, then putting people in it. Sections, tables of various shapes, rows of
chairs for a ceremony, and loose chairs. Then seating several hundred people, which is a
social puzzle more than a logistical one.

## Candidate artboards

- **Menu and Seating** — the plan on the desktop
- **Seating and Assistant on Tablet** — the tablet, where it is operated by a finger

## Layouts, and why

**All four, and they differ most here.** The plan is built with a mouse on a desk,
adjusted with a finger on a tablet, read live during service, and printed for the venue.
A phone cannot show the whole room, so say what it shows instead.

## What these screens must honour

- **Spatial and direct**, and as workable with a finger as with a mouse — including
  dragging one person onto one chair among four hundred.
- Dragging needs a **click-click** path: pick, then place.
- A seat has states: empty, taken, **held for a companion**, proposed, unusable. Each is a
  shape, not just a colour.
- Four zoom levels with different detail at each, and a tray of the unseated that is
  searchable and is the headline number.
- A previous version is recoverable. This is the easiest thing in the product to destroy
  by accident.

## Traps specific to this epic

- The room count is a shared aggregate (sc-103), not something a screen recomputes.
- **A printable plan is black and white** and gets pinned up at the venue. Seat numbers and
  names must be legible at print size.
- The same layout is later read live during service with service state on it — a different
  rendering, not an editing surface.
