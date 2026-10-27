# Handoff — epic 30 · Guests

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/30
- **Artifact title to use:** `Soirely — Guests`

## What this area is

The heart of planning, and where most of the time goes. Several hundred people, each with
a name, contact details, groups, dietary needs, companions, a reply, a seat, and eventually
whether they turned up.

## Candidate artboards

- **Guests and Service** — the list, and its service-floor sibling
- **Guest Import** — column mapping and the staging grid
- **Guest RSVP** — the guest's own side of it

## Layouts, and why

**All four.** And this is where the hard one lives: **a dense table of four hundred guests
has to work on a phone** — sorting, filtering, selecting eighty rows, inline editing. Not
"degrade to a card list". Work.

## What these screens must honour

- A name is a **full name** and often carries a title. "Chief Mrs Adaeze Okonkwo-Williams"
  is a normal guest, not an edge case. Never split it for a first name.
- **Held is its own state.** A companion whose host has not accepted is not coming, and
  must not be shown like No reply. Colour separates yes, maybe and not-yes; shape says
  which kind of not-yes.
- An import is **fixed before anything is created** — per-cell errors with reasons, fixable
  in place — and **reversible afterwards** as a whole run.
- Bulk work is normal: select eighty, act, and undo afterwards rather than confirm before.
- **Allergy is not a preference.** An allergy is red-outlined, carries the word, and is
  listed first and separately.

## Traps specific to this epic

- Percentages are **of the whole room**, never of replies received.
- The guest's own pages have no account and will never install anything. They are the
  simplest thing in the product and the part most people ever see.
- A merge of two records that are one person has to say what happens to their reply and
  their seat.
