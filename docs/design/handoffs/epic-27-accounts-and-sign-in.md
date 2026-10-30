# Handoff — epic 27 · Accounts and sign-in

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/27
- **Artifact title to use:** `Soirely — Accounts and sign-in`

## What this area is

Somebody signs up, proves who they are, and gets back in when they have lost access.
Email and password, or Google or Apple. A code to verify an email address and a phone
number. Optionally a second factor, after which that becomes the thing they might lose.

## Candidate artboards

- **Accounts and Access** — the likely home for sign-up, sign-in and verification
- **Roles and Sign-in Rules** — partly: it is mostly organisation policy (epic 28), but
  provider-only sign-in and session timeout are felt here

## Layouts, and why

**All four.** Authentication is the exception to the layout table in the skill: it is the
one thing a phone browser does besides billing and settings. These are the same design at
four sizes rather than four different designs.

## What these screens must honour

- **Every refusal says what to do next**, not only what went wrong.
- **Nothing dead-ends.** Somebody who has forgotten everything gets back in without
  emailing support.
- A code field takes a paste of the whole code, advances by itself, and submits on
  completion.
- A phone field is international by default: a country selector, a dial code, formatting as
  typed.
- Backup codes are shown once, with a copy and a download, and a confirmation step that
  proves the second factor works.

## Traps specific to this epic

- **The return paths carry the weight.** Most people sign up once and then not for months,
  so a forgotten password, a new phone and a lost authenticator are the screens that
  matter most. If the design draws the happy path and not these, that is the first thing
  to build.
- Google and Apple buttons are brand-governed: correct marks and wording, and a
  platform-native variant on iOS.
- An organisation can require provider-only sign-in or time sessions out. Somebody meeting
  either needs to understand why rather than think it is broken.
