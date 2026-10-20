# Membership and access

Two different grants, deliberately kept apart, and one state machine that every way of
joining enters at a different point.

## The two grants

|                  | **Organisation membership**     | **Event access**            |
| ---------------- | ------------------------------- | --------------------------- |
| What it is       | belongs to your company         | works one event             |
| Lifetime         | persistent                      | bounded by the event        |
| Carries          | role, permissions, billing seat | a job on the night          |
| Needs an account | yes, always — see below         | not necessarily             |
| Example          | a planner on staff              | a waiter hired for Saturday |

**Joining an organisation must not be the only way to reach an event.** The previous build
conflated these and had to re-scope personnel to the organisation afterwards, then gate
member management behind a new permission to stop event staff editing the company roster.

A hired waiter should never become a member of your company. A venue coordinator should
be able to see one event without joining anybody's organisation.

A third grant will be wanted eventually — **cross-organisation collaboration**, where a
caterer's or venue's organisation is granted scoped access to an event without either side
absorbing the other. It is out of scope for now, but the two grants above should not make
it impossible.

## Two records, because an invitation has no account

**An invitation is its own record. No account and no membership exist until it is
accepted.**

This is the decision that shapes everything below, and it replaces an earlier version of
this document in which `invited` was a membership state and an invitee got a dormant
account pre-created for them. That model put one person in two places — a membership row
saying `invited` and an account row saying "not activated yet" — and made `users` stop
meaning "somebody who can sign in", so every authentication path had to remember the
difference. It is the invariant that holds until the eighth code path.

It is also what the identity providers do and not what applications do, for a reason:
Entra, Cognito and Supabase all create the user object at invite time because **the
directory is their product** and a pending person must be listable and referenceable before
they accept. Ours is not. Clerk, Jetstream and the rest keep the invitation separate and
create the user at acceptance.

### The invitation

No account required. It carries the organisation, the email, the role, who sent it, and the
token.

```
  pending ──┬──▶ accepted    creates or reactivates the membership
            ├──▶ declined
            ├──▶ revoked     by an admin
            └──▶ expired
```

### The membership

**Every membership row has a real account.** There is no nullable user, and no state that
means "we are waiting for somebody to exist".

```
            ┌────────────────────────────────┐
            ▼                                │
  pending_approval ──▶ active ──▶ suspended ─┘
                          │
                          └──▶ left / removed ──▶ active
```

Every channel below enters this machine at `active` or `pending_approval`. Model it that
way and a new channel is cheap; model each one bespoke and you end up with five slightly
different notions of "pending" that drift.

### What this gets right that the other model did not

- **Two organisations inviting the same stranger** is two invitation rows and no argument
  about which organisation owns the account. Under the dormant model it needed an
  `invited_by_org_id` on the account to break the tie, which is an organisation's claim on
  a person who has not agreed to anything.
- **Acceptance is matched on the signed-in account's email**, which the abuse rules below
  already require. The invitation holds the address, so the comparison has something to
  compare against.
- **`users` means what it says.** A row there is somebody who registered.
- **Revoking is deleting a row**, not reasoning about whether an account may now sign in.

## Channels

A channel differs only in who initiates, what gets verified, and where it lands.

| Channel                    | Initiator         | Lands in                              | Good for                                           |
| -------------------------- | ----------------- | ------------------------------------- | -------------------------------------------------- |
| **Create it**              | user              | `active` as owner                     | the founder path                                   |
| **Email invitation**       | admin             | an invitation; `active` on acceptance | you know exactly who                               |
| **Join code**              | admin             | `active` or `pending_approval`        | you don't know who, or there are twenty of them    |
| **QR code**                | admin             | same as a join code                   | a staff briefing where fifteen people scan at once |
| **Domain auto-join**       | user, implicitly  | `active` or `pending_approval`        | a verified company domain                          |
| **Request to join**        | user              | `pending_approval`                    | the inverse of an invitation                       |
| **Bulk import**            | admin             | invitations, one per address          | migrating a staff list                             |
| **Directory provisioning** | identity provider | `active`                              | enterprise, and it deprovisions too                |

### Which of these are for which grant

The join code and QR matter most for **event access**, not organisation membership. That
is the real on-the-night workflow: a supervisor reads out a code, or holds up a phone, and
the crew are on the floor in a minute without anybody collecting email addresses.

Email invitation, domain join and directory provisioning are **organisation membership**.

## Every channel needs an exit

Deprovisioning is the mirror of provisioning and is almost always forgotten. Directory
provisioning earns its place precisely because it does both: somebody leaving the company
loses access without anybody remembering to revoke it.

## Abuse, per channel

- **Join and QR codes** — enough entropy to resist guessing, a short expiry, a use cap, and
  rate limiting. A four-character code with no cap is an open door, and the door opens onto
  a guest list full of personal data.
- **Domain auto-join** — the public-provider blocklist is mandatory, or one organisation
  claims every `gmail.com` signup. Verification must be DNS, not "we sent the address an
  email".
- **Request to join** — do not confirm an organisation exists to somebody who is not in it.
- **Invitation tokens** — single use, expiring, and acted on by the **signed-in account's
  email**, not by possession of the token alone. Otherwise a leaked link lets somebody
  decline an invitation that was not theirs.

## What support needs

- The member list with roles, and every pending invitation with its delivery status
- The audit trail: who invited whom, who changed a role, who removed somebody
- To restore an owner when the last one has left — the lockout that cannot be self-served
- To issue **emergency event access** mid-event, which is time-critical in a way nothing
  else here is
- To undo an organisation deletion inside its recovery window
