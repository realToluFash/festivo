# Handoff — epic 28 · Organisations and access

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/28
- **Page to use:** `28 · Organisations and access` in Soirely — Redesign

## What this area is

An organisation owns its events, its team and its subscription. People belong to several
and switch between them constantly. There are eight ways in, and one state machine.

## Candidate artboards

- **Roles and Sign-in Rules** — roles, permissions, organisation policy
- **Accounts and Access** — partly: joining and invitations overlap it

## Layouts, and why

**Desktop first, and mostly desktop only.** This is administration, and the narrow web
carries organisation settings, so member management needs a narrow form too. The apps need
only enough to see who is who.

## What these screens must honour

- The **eight routes in are one journey entered at different points** — created, emailed
  invitation, join code, QR scanned by fifteen people at a briefing, verified domain,
  request to join, bulk import, directory provisioning. Design them as one thing and a
  ninth is cheap.
- The five states are visible and distinct: invited, awaiting approval, active, suspended,
  gone. **Awaiting approval must not read as invited.**
- An administrator can see what a role actually grants **before** handing it out.
- The last owner cannot be removed, and the reason is apparent at the moment somebody
  tries.

## Traps specific to this epic

- **A permission can withhold data from somebody who can otherwise edit the event** — a
  coordinator sees the budget and not the margin. If a screen implies that event access
  means seeing everything, that is a disagreement worth raising (see sc-102 and sc-66).
- A join code panel carries an expiry, a use limit, a usage count, rotation and
  revocation. Easy to draw as just a code.
- Somebody locked out of their own organisation is a support call. Design the route that
  avoids it.
