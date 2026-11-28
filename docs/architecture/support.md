# Support

**Support affordances ship with each scope, not after it.** A scope is not finished when
the feature works. It is finished when somebody can fix it for a customer at seven o'clock
on a Saturday.

The previous build shipped the support queue and its escalation flow, then carried
resend, reset, clear-MFA, suspend and refund as a fast-follow that stayed on the list. The
result was a console that could only read, and an agent whose every conversation ended
with "I'll pass that on".

## What every scope must provide

Seven things, and each is a design decision that is nearly free now and painful later.

1. **A correlation id the user can see.** Error screens show it; agents search by it. It
   turns "it broke around four" into one request.
2. **An audit trail on every state change** — who, what, when, from where. Agent actions
   included, and distinguishable as such.
3. **Soft delete with a recovery window** on anything destructive. After a hard delete,
   "it's gone" is the whole conversation — and the people who most need help are the ones
   who deleted something an hour before an event.
4. **A delivery log for anything sent to a person** — status, channel, provider response,
   and _why a channel was skipped_. Expect this to be the largest single source of tickets.
5. **An entitlement override**, so a customer can be unblocked mid-event without a deploy.
6. **Scoped impersonation** — see what they see. Consented, audited, read-only by default.
7. **An undo for every bulk operation.** An import that went wrong is one ticket, not four
   hundred.

## Two lanes

Everything else can wait an hour. **A broken service floor at seven on a Saturday cannot.**

That is a separate queue with its own alerting and its own response target — not a priority
flag on the normal one, because a flag gets triaged alongside billing questions.

## What an agent needs on screen

**One timeline per account, organisation and event.** Signed up → verified → joined an
organisation → created an event → sent 412 invitations, 11 bounced → upgraded → started
service. That is what turns a ten-minute investigation into a ten-second read.

**Search that accepts any identifier** — email, phone, event name, correlation id, message
id, invoice number. The customer will offer whichever one they happen to have, and making
them find a different one is the first thing that makes support feel like an obstacle.

## Per scope

| Scope               | What breaks                                                    | Must see                                                           | Must do                                                                                                  |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Accounts**        | cannot sign in, no code arrived, lost the second-factor device | verified states, linked identities, failed attempts, code delivery | resend, force-verify, send a reset, **clear the second factor**, unlock a rate limit, change an email    |
| **Orgs & access**   | locked out, the last owner left, invitation never arrived      | members, roles, pending invitations and their delivery, audit      | restore an owner, change a role, resend or revoke, **undo a deletion**, **issue emergency event access** |
| **Events**          | deleted by mistake, ended early                                | state and transition history                                       | **restore**, reverse a transition                                                                        |
| **Guests**          | invitation not received, import went wrong, duplicates         | per-guest delivery log, import run history                         | resend, correct an RSVP, **undo an import run**, merge duplicates                                        |
| **Venue & seating** | layout lost, assisted assignment went wrong                    | **version history**                                                | restore a version                                                                                        |
| **Menu & dietary**  | choices lost, menu changed after guests chose                  | choice history                                                     | restore                                                                                                  |
| **Staffing**        | staff locked out **on the night**                              | assignments, access state                                          | issue emergency access                                                                                   |
| **Service floor**   | plate stuck, screen stale, updates not arriving                | live connection state, recent publishes, plate history             | force a session refresh, correct a state                                                                 |
| **Messaging**       | "my guests never got it"                                       | delivery log, channel breakdown, **why a channel was skipped**     | resend, resend on another channel, credit back                                                           |
| **Plans & billing** | double charge, upgrade not applied                             | subscription, payments, meter, rail                                | refund, credit, **temporary entitlement override**, extend a trial                                       |
| **AI assistance**   | a bad or expensive answer                                      | the prompt and the response                                        | refund credits                                                                                           |

Run of show and Insights are thinner: history and restore.

## Rules for agent actions

- **Read-only by default.** Every action is named, permissioned and audited.
- **Raw database access is never the answer.** An action that only exists as a SQL query is
  an action with no audit trail, no permission check and no record that it happened.
- **An agent sees what the ticket needs**, not everything. Guest lists are personal data
  belonging to somebody who never agreed to show them to a support agent.
