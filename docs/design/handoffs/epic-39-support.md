# Handoff — epic 39 · Support

**If you have not already read `README.md` and `SHARED.md`, read them now, before this
file.** Both are in this folder. `README.md` says what this work is and where the design
lives; `SHARED.md` carries the house style, the mechanics that fail silently, the forbidden
list, how to link an artifact to a story, and how to report back.

If they were pasted in along with this file, you already have them — do not read them
again. Either way, **this file carries only what is specific to this epic, and is not
enough on its own.**

- **Epic:** https://app.shortcut.com/soirely/epic/39
- **Artifact title to use:** `Soirely — Support`

## What this area is

A separate internal application. Seven o'clock on a Saturday, a customer's service floor
has stopped and there are two hundred people in a room. An agent has minutes.

## Candidate artboards

- **Support Console** — the queue, the search, the history and the actions

## Layouts, and why

**Desktop only, and dense.** Used all day by a handful of people who will be expert within
a week. Optimise for their speed over their first impression. It should feel like the same
company's product without being styled as though a customer were reading it.

## What these screens must honour

- **Two kinds of work that must not look alike**: an ordinary request, and an event failing
  while it is happening. The second is not a priority flag on the first.
- The search takes **whatever the customer happens to have** — email, phone, event name, a
  correlation id, an invoice number — and may answer with an account, an organisation, an
  event or a single message.
- One history per account, read top to bottom, dense enough to scan and detailed enough to
  land on one moment.
- Actions carry **confirmation proportional to how hard they are to undo**. Nothing is one
  careless click away, and nothing takes six.
- **Impersonation is impossible to miss, impossible to forget**, read-only by default, and
  stoppable in one action.

## Traps specific to this epic

- The powerful actions are the point of the console, so a design that hides them is as
  wrong as one that scatters them.
- Every action is recorded with who and why, and an agent's action stays distinguishable
  from the customer's own.
- An agent reads far more than they type, and keeps several things open at once.
