# Handoff — epic 35 · Service floor

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/35
- **Artifact title to use:** `Soirely — Service floor`

## What this area is

The night itself: a plate's journey from the kitchen to the table, and every request a
guest makes while sitting at it.

## Candidate artboards

- **Service** — the floor during the event
- **Guests and Service** — the guest list's service-side sibling

## Layouts, and why

**The apps, overwhelmingly** — a phone in one hand, a tablet on a stand at the pass. There
is a view on the web for whoever is at a laptop. A tablet on a stand is a real deployment,
so tablet landscape is not an afterthought here.

## What these screens must honour

- **What a table needs is readable at arm's length in under a second.**
- A kitchen printout is **black and white**, so colour alone cannot be carrying it.
- Dietary flags on a ticket **cannot be missed**.
- Everything updates as the room changes, and **stale state is declared** — a figure with
  no age and no connection state is the worst failure this product can have.

## Traps specific to this epic

- The circumstances are the constraint: a dim room, noise, one hand free, plates in the
  other, walking. A design that is merely compact is not the same as one that is glanceable.
- **Patchy signal is normal.** Say what still works and what is queued.
- A server sees their own tables, not everybody's.
- Nothing here may interrupt a live event, including a plan limit or a billing state.
