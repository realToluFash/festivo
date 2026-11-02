# Handoff — epic 81 · Budget and costs

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/81
- **Page to use:** `81 · Budget and costs` in Soirely — Redesign

## What this area is

The organiser's own money, spent on their event — caterers, flowers, staff. Not what they
pay us, which is epic 37. A cost is a rate the organiser knows multiplied by a quantity the
product already knows.

## Candidate artboards

**None in the design project** — budget became a scope after the design was made.

**Five artboards already exist** at https://claude.ai/artifact/2Swi2WCFoRNeqPRBngDpbK —
desk web, the decision-time cost panel, vendors and payments, the phone view, and the
planning-tier version. **They are not the designer's work and need review.** Link them
rather than redrawing them, and build only what the sixteen stories need beyond them.

## Layouts, and why

**Desktop to build and reconcile. The apps for the headline number and the payment
reminders** — somebody standing in a venue wants the total, not to edit a rate. **Never
guest-facing.**

## What these screens must honour

- **Never ask for a number the product already knows.** A line needing a typed headcount
  is dead by the third week. Every quantity carries a line naming its source.
- The total is **a range**, not a figure: what is settled, and what it becomes if everybody
  still deciding says yes.
- **Cost per head is the headline**, because that is how organisers and clients talk.
- **What a decision costs, before it is made** — twenty more guests, a switched main
  course, an extended shift.
- Marking a scheduled payment paid **is** how actual spend is recorded. There is no expense
  to enter.

## Traps specific to this epic

- **Three entitlements, three products**: `budget` plans it, `vendors` tracks it, `margin`
  sells it. The planning tier is a **first-class product, not a degraded one** — no empty
  columns with a padlock in them.
- **Margin is never visible without its own permission**, and never on a share link or in
  print. A margin leaked to a client is a commercial incident.
- Planned, committed and paid are **three different numbers** and must not merge into one
  "actual".
- Not to be confused with epic 37. The two kinds of money must never share a component, a
  phrase or an error type.
