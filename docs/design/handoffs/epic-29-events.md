# Handoff — epic 29 · Events

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/29
- **Page to use:** `29 · Events` in Soirely — Redesign

## What this area is

The event is the container everything else is reached through. Somebody creates one, keeps
it a draft, makes it live, watches it become ongoing, pauses it, and sees it concluded.

## Candidate artboards

- **Events Home** — the list of events, and which one needs attention today
- **Event View** — one event and the areas inside it

## Layouts, and why

**All four.** Both the desktop web and the apps carry all of event management, so the
event shell exists at every size. The narrow web does not: an event link opened in a phone
browser is the app handoff.

## What these screens must honour

- An organiser with several events knows **which needs them today** without opening each.
- The lifecycle states have consequences a guest can see. A paused event and a concluded
  one each need something sensible to show somebody following an old link, in their own
  language, mentioning nothing internal.
- Deleting one takes the guests, the seating, the menu and the history with it. The
  confirmation says so.

## Traps specific to this epic

- An event spans **one day or several**. A single-date design breaks the multi-day case,
  which is normal rather than exotic.
- An event carries a currency and a timezone (sc-98). Dates shown about an event are in
  **the event's** timezone, not the reader's.
- The cover image is the first thing a guest sees, and needs a good-looking default when
  there is none.
