# Handoff — epic 32 · Menu and dietary

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/32
- **Artifact title to use:** `Soirely — Menu and dietary`

## What this area is

Courses in order, dishes within them, variants for people who need one. Guests choose, and
the kitchen needs the counts.

## Candidate artboards

- **Menu and Seating** — building the menu
- **Guest RSVP** — the guest choosing a meal

## Layouts, and why

**All four.** Built on a computer, read in the apps during service, chosen on a guest's own
phone.

## What these screens must honour

- **Courses to Dishes to Variants.** That vocabulary is fixed. Never "plate", "slot" or
  "Meal Library".
- Within a dish, components group by category — starch, protein, side.
- **An allergy is not a preference**, and the distinction has to survive a black-and-white
  print and a glance across a loud room. Allergies are listed first and separately.
- The kitchen's view: counts per dish and variant, for the room and per table, plus who has
  not chosen.

## Traps specific to this epic

- A dish or variant may carry a **cost** (sc-100), visible only with the budget
  permission. A screen showing prices to everyone is a disagreement.
- A menu changing **after** guests have chosen is a real situation: who is affected, what
  they chose, and asking again without losing the original answer.
- Guests who have not chosen are their own number, because a budget has to decide whether
  to price them.
