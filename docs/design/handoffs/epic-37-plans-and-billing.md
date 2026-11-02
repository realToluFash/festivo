# Handoff — epic 37 · Plans and billing

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/37
- **Page to use:** `37 · Plans and billing` in Soirely — Redesign

## What this area is

The subscription belongs to the organisation, not the person. Someone pays for it, possibly
for several organisations at once. Plans are sold on the web only.

## Candidate artboards

- **Billing** — the plan, payment methods, invoices and usage

## Layouts, and why

**Desktop and the narrow web only.** This is one of the three things the narrow web
carries, so it needs a real phone-browser design. **Not in the apps at all** — app stores
take a share of anything bought inside an app.

## What these screens must honour

- **A paywall must never ruin somebody's wedding.** A hard limit is refused **when
  something is created**, with the limit named and the way out offered — never a flat no,
  and never during a live event.
- Non-payment makes things **read-only, never gone**.
- Running out of credits holds back **one channel**, not the event.
- A store-bought subscription belongs to that store account, cannot be pooled with other
  organisations and cannot be transferred. Say so **at the point of purchase**.

## Traps specific to this epic

- **Three kinds of limit behave differently** — refused, warned, present-but-unavailable —
  and have to be legible without anybody learning the distinction.
- This is **not** the organiser's own budget (epic 81). The two kinds of money sit next to
  each other in the product and must never share a component, a phrase or an error type.
- One billing account can pay for several organisations. An entitlement check never looks
  at the billing account.
