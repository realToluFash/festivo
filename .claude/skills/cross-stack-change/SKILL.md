---
name: cross-stack-change
description: How one change lands across the Symfony API, the mobile app and the web client in a single pull request — the order to build it in, where the contract lives, and the drift that one repository does not automatically prevent. Use when a story touches more than one of services/ and apps/.
---

# Cross-Stack Change

One repository was chosen so that a change spanning the API and its clients is **one pull
request**. This is how to actually get that benefit, because a monorepo makes the change
possible to review together — it does not make it correct.

## Why they are in one PR

A reviewer needs to see the endpoint and the screen that calls it at the same time, because
the only interesting question is whether they agree. Split across repositories that
question had no reviewable answer, and the usual outcome was an API that shipped weeks
before anything called it, then changed again when the client finally arrived.

If you are tempted to split a cross-stack story "so the API can land first", ask what the
API is for in the interim. Usually the honest answer is nothing, and the split exists to
make the PR smaller rather than to make anything work sooner.

## The order to build it in

1. **Decide the contract first and write it down** — the route, the request shape, the
   response shape, the status codes, who is refused. Put it in the story or the PR
   description before writing either side.
2. **Build the server side to that contract**, with its tests.
3. **Build the client side against the server's own source** — see the next section, which
   is the part that goes wrong.
4. **Verify them together** before opening the PR.

## The drift one repository does not prevent

Having both halves in one checkout does not make a client test prove anything about the
server. The previous build was bitten by exactly this: a mobile test asserted against a
hand-written fixture, the fixture was shaped like what somebody expected, and the server
sent something else. Every test passed and the screen was empty.

**Assert the client against the response shape the server actually produces.** In practice:

- Derive the client's types from the server's serialisation, do not hand-write them twice.
  Where they must be written twice, add a test that fails when they disagree.
- A fixture in a client test is only trustworthy if something checks it against the server.
  An untested fixture is a guess that typechecks.
- Casting a wire value to a client type — `as SomeType` — tells the typechecker to stop
  looking at exactly the boundary most likely to be wrong. The previous build lost three
  attempts at a bug to one of these: the database stored `rectangular`, the renderer
  branched on `rect`, and a cast sat between them saying it was fine.

## Checklist before opening the PR

- [ ] The contract is written down somewhere a reviewer will see it
- [ ] Server tests cover the endpoint, including who is refused
- [ ] Client tests assert against the real response shape, not a hand-written fixture
- [ ] No cast bridging a wire type to a client type without a test behind it
- [ ] Any new user-facing string is in all four locales — see `locale-parity`
- [ ] A migration, if there is one, states what happens to rows that predate it
- [ ] Anything that changes on screen for one user, and should for another, publishes on a
      Mercure topic the client is actually subscribed to

That last one has its own failure mode worth naming: a publish with no matching subscriber
does not error. It does nothing, silently, and the screen simply never updates. Check both
ends, every time.

## Commits inside the PR

Still `making-commits` rules: one commit per outcome, not one per directory. A commit
containing the entity, the endpoint and the screen that uses it is right, because none of
the three is usable alone.

Use a scoped prefix — `feat(api):` — only when the commit genuinely touches one surface.
A commit with no scope is the signal that it spans them.
