# Design handoffs

One brief per epic, for giving the work of **matching an epic's stories to screens** to
somebody — or something — that does not have the context in its head.

Each handoff asks for the same three things: find out which stories the design already
covers, design the missing screens in the existing language, and link each story to the
artboard that covers it.

## How to use one

Paste three files into a fresh session, working in this repository, in this order:

1. **`README.md`** — this file. What the work is, and where the design lives.
2. **`SHARED.md`** — the house style, the mechanics that fail silently, the forbidden list,
   how to link an artifact to a story, and how to report back. The same every time.
3. **`epic-NN-*.md`** — the stories, the candidate artboards, which layouts apply and why,
   what those screens must honour, and the traps specific to that area.

A per-epic file on its own is **not enough**: it names the traps and leaves out the rules.

The split exists so the house style is written once. Fifteen copies of it would be fifteen
things to keep in sync, which is the drift this whole folder is meant to prevent. If you
change how this work is done, change `SHARED.md`.

## The handoffs

| Epic                                      | Area                     | Artboards today                                                  |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| [27](epic-27-accounts-and-sign-in.md)     | Accounts and sign-in     | Accounts and Access · Roles and Sign-in Rules                    |
| [28](epic-28-organisations-and-access.md) | Organisations and access | Roles and Sign-in Rules                                          |
| [29](epic-29-events.md)                   | Events                   | Events Home · Event View                                         |
| [30](epic-30-guests.md)                   | Guests                   | Guests and Service · Guest Import · Guest RSVP                   |
| [31](epic-31-venue-and-seating.md)        | Venue and seating        | Menu and Seating · Seating and Assistant on Tablet               |
| [32](epic-32-menu-and-dietary.md)         | Menu and dietary         | Menu and Seating · Guest RSVP                                    |
| [33](epic-33-run-of-show.md)              | Run of show              | Run of Show                                                      |
| [34](epic-34-staffing.md)                 | Staffing                 | Staffing                                                         |
| [35](epic-35-service-floor.md)            | Service floor            | Service · Guests and Service                                     |
| [36](epic-36-messaging.md)                | Messaging                | Messaging                                                        |
| [37](epic-37-plans-and-billing.md)        | Plans and billing        | Billing                                                          |
| [38](epic-38-ai-assistance.md)            | AI assistance            | Assistant · Seating and Assistant on Tablet                      |
| [39](epic-39-support.md)                  | Support                  | Support Console                                                  |
| [40](epic-40-insights.md)                 | Insights                 | Insights                                                         |
| [41](epic-41-marketing-site.md)           | Marketing site           | Public Pages · Guest RSVP                                        |
| [81](epic-81-budget-and-costs.md)         | Budget and costs         | **none** — five exist outside the design project, needing review |

The artboard column is a **guess from the names**, not a verified mapping. Verifying it is
step one of every handoff, and the answer is the useful part: there are 21 artboards and
far more stories, so some areas are drawn and some are not.

Foundation (epic 26) has no handoff. It is plumbing, and the one story in it that concerns
the design is sc-80, the design context itself.

## Where the design actually is

The Claude Design project `b64da70f-d60f-4ad6-90a4-efe6d387caa8`, read through the
`DesignSync` tool's read methods. Its `CLAUDE.md` is the record of what is settled, and of
what was discarded — `Foyer` among them.

The tokens live here, in `docs/design/tokens.mjs`, as one source generating both clients'
copies. `.claude/skills/screen-from-design/SKILL.md` is how a screen gets built from any of
this once it is designed.
