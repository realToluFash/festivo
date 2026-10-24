# Handoff — epic 33 · Run of show

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/33
- **Artifact title to use:** `Soirely — Run of show`

## What this area is

The timeline of the night: items with durations, owners and dependencies. During the
event, three different people need three different things from it.

## Candidate artboards

- **Run of Show** — the schedule, and likely the stage and presenter views

## Layouts, and why

**All four, plus two screens that are neither.** The **stage display** is read from twenty
metres with almost no chrome. The **presenter console** is read at a glance under stage
lighting. Both are their own frames, not a layout of the schedule.

## What these screens must honour

- Now, next, and **how far behind the night is running**. An overrun is the normal state.
- An item can be marked started, done or skipped.
- The room's own screen shows guests what is happening and what is coming, and looks
  graceful when nothing is scheduled.
- Times are 24-hour, in the event's timezone.

## Traps specific to this epic

- A schedule spans **more than one day and more than one room or stage**. A single-track
  design breaks both.
- The presenter's view and the organiser's view are different jobs. Drawing one and
  labelling it both is the likely mistake.
- A cue somebody reads aloud is not the same as a note only staff see.
