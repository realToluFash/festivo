---
name: symfony-api
description: The conventions the Soirely API is held to — Doctrine entities and migrations, response and error shape, and the access checks that must be mounted rather than remembered. Use when writing or reviewing anything under services/api.
---

# Symfony API Conventions

What everything under `services/api` is held to. Read before adding an endpoint, an
entity or a migration.

## Access is mounted, not remembered

**Every event-scoped route carries its access check as part of the route definition**, not
as a line somebody remembered to write inside the controller.

This is the single most expensive lesson from the previous implementation. A route that
forgot its check behaved perfectly for everyone allowed in, so nothing caught it — not a
test, not review, not use. The only reliable defence is making the check structural, so a
route without one cannot be registered at all.

Two rules follow from it:

- A sub-resource id is scoped to its parent before it is used. Loading a table by its bare
  id and then checking the event is backwards — a table id from another event will have
  been read before anybody asks whether it should have been.
- An organisation-level check runs before any fast path that would skip it.

## Entities and migrations

- Doctrine entities own the schema; migrations are generated from them and then read before
  they are run. A generated migration is a draft, not a decision.
- **A migration says what happens to rows that predate it.** Not in a comment — in the
  story's AC and the PR's Risks. "The column is nullable" is a schema fact, not an answer
  to what the application does when it reads a null.
- Prefer adding the column over computing the value in two places. The previous build
  approximated a table's dimensions in two different modules because the table had no
  width or height; both approximations drifted and both were wrong. The migration would
  have taken ten minutes.
- A child entity that cannot exist without its parent takes the parent in its constructor.
  An entity that can be built ownerless will eventually be built ownerless.

## Response and error shape

Keep one shape across every endpoint, so a client has one thing to handle:

```json
{ "success": false, "error": "<english sentence>", "code": "<machine_code>" }
```

The `code` is the stable identifier clients translate against — `invalid_credentials`,
`event_not_found`, `seat_already_taken`. The English `error` is the fallback for anything
a client has no translation for.

**A new error code needs its key in all four locale files in the same change.** A client
falling back to English because the key was never added is a regression that passes every
test. See `locale-parity`.

## Realtime

Live updates go over Mercure. Two rules:

- A mutation that changes something another open session is looking at publishes on the
  topic that session subscribes to. Not "eventually consistent via a refetch" — the
  previous build's polling fallback existed because the stream was unreliable, and it hid
  broken publishes for weeks.
- **A topic nothing subscribes to fails silently.** Adding a publish is half the change;
  the other half is the client, and there is no error to tell you the half is missing.
  Check both ends in the same PR.

## Tests

- An endpoint's test covers who is refused, not only who succeeds. The refusal is the part
  that is security-relevant and the part nobody exercises by hand.
- A test asserting against a hand-written fixture of a response proves the fixture is
  self-consistent. Assert against what the serialiser actually produces.
- Business rules belong in testable units, not in controllers. A rule inside a controller
  can only be tested through HTTP, so it usually is not.

## Comments

The previous codebase carried dense explanatory comments and they earned their place —
the reasoning behind a non-obvious decision is worth more in the file than in a commit
nobody will run `git log` for. Keep writing them where they explain **why**.

Delete the ones that restate the code. A comment saying what the next line does is a line
that should be clearer.
