# The database

Postgres, reached through Doctrine. Entities own the schema; migrations are generated
from them and then **read before they are run** — a generated migration is a draft, not a
decision.

## Conventions

|              |                                                                   |
| ------------ | ----------------------------------------------------------------- |
| Tables       | `snake_case`, **plural** — `guests`, `events`, `org_members`      |
| Columns      | `snake_case`, derived by the underscore naming strategy           |
| Primary keys | **UUID v7**, never a sequence                                     |
| Timestamps   | `TIMESTAMP WITHOUT TIME ZONE`, always UTC                         |
| Enums        | stored as `VARCHAR` with a check constraint, mapped to a PHP enum |
| Money        | integer minor units plus a currency column. Never a float         |

**Plural rather than singular.** A table holds many rows, and the plural reads correctly
in the place it is most often written: `FROM guests`, `JOIN org_members`. It also sidesteps
a trap — `user` is a reserved word in Postgres, so a singular `user` table has to be
quoted everywhere forever, including in hand-written SQL, where the query that forgets
fails at runtime rather than at boot. `users` needs no quoting.

**UUID v7 rather than v4 or a sequence.** A sequential integer leaks how many customers
you have and how fast you are growing, and makes one tenant's ids guessable from another's.
A v4 scatters inserts across the index. v7 is time-ordered, so it indexes like a sequence
and tells an outsider nothing.

## A person's addresses are rows, not columns

**Sign-up and sign-in deal with one email address and one phone number.** Later, from
account settings, a person may add alternatives — **capped at two of each** — so neither is
a column on `users`. `email_addresses` and `phone_numbers` each hold the address, when it
was verified, and whether it is the primary one.

### Primary identifies. An alternative only reaches.

This is the distinction the whole shape rests on:

|                             | Primary | Alternative |
| --------------------------- | ------- | ----------- |
| Signs you in                | yes     | **no**      |
| Receives account mail       | yes     | no          |
| Read by `isVerified()`      | yes     | no          |
| Reachable for notifications | yes     | yes         |
| Counts as claimed           | yes     | yes         |

An alternative address is a way to reach somebody, not a second way to _be_ them. Letting
one sign in would mean adding an address to your account quietly mints a second set of
credentials for it — so `UserRepository::findOneByPrimaryEmailAddress()` filters on the
flag, and that is the only query sign-in may use.

**"Is this address already taken" is a different question** and spans every address:
`EmailAddressRepository::findOneByAddress()`. Registration asks that one, so registering
with an address that is already somebody else's alternative is refused with the same clean
409 rather than reaching the unique constraint. Collapsing the two queries is what would
turn an alternative into credentials.

**Taken means taken by an account that proved itself.** An address held only by an account
that never verified any address is released: the new registration deletes that account and
takes it. Such an account owns nothing, and refusing would let a typo keep somebody else's
address hostage. Only an account with at least one verified address gets the 409 — for any
of its addresses, verified or not.

### What is enforced, and where

- **An address is globally unique**, not unique per user — a unique index. Two accounts
  claiming one address is how a password reset reaches the wrong person.
- **Exactly one primary each**, through a partial unique index over the rows where the flag
  is true. `writing-migrations` has the Doctrine side, which is easy to get subtly wrong.
- **At most two of each per user**, enforced by the service that adds one, because a row
  count per user is not something an index can say. sc-113 owns it.
- **`getUserIdentifier()` is the user's id**, not an address. The primary flag can move and
  an address can be replaced, so an address is not a stable name for an account — and the
  identifier is what the access token carries.

The alternative shape — `email_verified_at` and `phone_verified_at` on `users` — is what
Laravel, Rails' devise and Auth0 do, and it is correct for them because one identifier is
all they promise. django-allauth and Clerk use rows for the same reason we do. The deciding
question is only ever whether a person can have more than one.

The verification _challenge_ — the code, its expiry, the attempt count, the resend cooldown
— is separate again, and belongs to whichever story builds verification rather than here.

## Every migration states what happens to existing rows

Not in a comment — in the story's acceptance criteria and the pull request's **Risks**.

"The column is nullable" is a schema fact, not an answer. The question is what the
application does when it reads that null, and it has to be answered before the migration
lands rather than discovered by the first customer whose data predates it.

## Add the column

If the application needs a value, store it. The previous build had no width or height on
its tables, so two different modules each approximated a size from the seat count, drifted
apart, and were both wrong. The migration would have taken ten minutes.

A value computed in two places is two values.

## Soft delete, with a window

Use the `SoftDeletable` trait. `SoftDeleteFilter` is **enabled by default**, so deleted
rows are absent from every ordinary read without anybody thinking about it. Seeing them is
deliberate and visible:

```php
$em->getFilters()->disable('soft_delete');
```

That default is the whole mechanism. Excluding deleted rows at each query is a rule every
read has to remember, and the read that forgets leaks a deleted guest into a list — which
reads as the deletion not having worked.

Anything a user can destroy is soft-deleted and recoverable for a defined period. Support
cannot help with a hard delete — "it's gone" is the entire conversation — and the people
who need help most are the ones who deleted something an hour before an event.

Hard deletion happens on a schedule after the window, or on an explicit erasure request.

## Audit

One call, through `Auditor::record()`. It picks up the request's correlation id and IP
itself, so an entry is never missing them because somebody did not know they existed.

`Auditor::diff()` builds the changes map and keeps only what differs. Record **before and
after** — "role changed" is not an answer to "changed from what?", and the before is the
half nothing can reconstruct later.

The actor's name is stored as text, as it was at the time. Resolving it at read time
answers who that id belongs to _now_, which is a different question, and after the account
is deleted it answers nothing.

`AuditEntry` has no setters and the application cannot delete one. A trail the application
can edit answers "who changed this" with "somebody who could also change the answer".

Every state change records who, what, when and from where — **including changes made by a
support agent**. An agent action that is not audited is indistinguishable from a breach.

## Extensions

Created by `infra/postgres/init`, not by a migration: they need superuser and the
application's user is not one. That script runs only on an empty volume, so
`docker compose down -v` is the only thing that re-runs it.

`uuid-ossp`, `citext`, `pg_trgm`.

## The test database

The same database with `_test` appended — a suffix rather than a different name, so nobody
points the suite at the development one by editing a single word.

```bash
npm run test:db     # drop, create, migrate
npm test            # run the suite
```

Each test runs inside a transaction that is rolled back, so nothing a test writes survives
into the next one. Without that, tests pass in isolation and fail in a suite — or worse,
pass in a suite because of something an earlier test left behind.
