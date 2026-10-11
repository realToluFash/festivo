# The database

Postgres, reached through Doctrine. Entities own the schema; migrations are generated
from them and then **read before they are run** — a generated migration is a draft, not a
decision.

## Conventions

|              |                                                                   |
| ------------ | ----------------------------------------------------------------- |
| Tables       | `snake_case`, singular — `guest`, `event`, `org_member`           |
| Columns      | `snake_case`, derived by the underscore naming strategy           |
| Primary keys | **UUID v7**, never a sequence                                     |
| Timestamps   | `TIMESTAMP WITHOUT TIME ZONE`, always UTC                         |
| Enums        | stored as `VARCHAR` with a check constraint, mapped to a PHP enum |
| Money        | integer minor units plus a currency column. Never a float         |

**UUID v7 rather than v4 or a sequence.** A sequential integer leaks how many customers
you have and how fast you are growing, and makes one tenant's ids guessable from another's.
A v4 scatters inserts across the index. v7 is time-ordered, so it indexes like a sequence
and tells an outsider nothing.

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

Anything a user can destroy is soft-deleted and recoverable for a defined period. Support
cannot help with a hard delete — "it's gone" is the entire conversation — and the people
who need help most are the ones who deleted something an hour before an event.

Hard deletion happens on a schedule after the window, or on an explicit erasure request.

## Audit

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
