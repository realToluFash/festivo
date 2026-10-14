---
name: writing-php
description: How PHP is structured and written in this repository — where a class goes, the shape every class takes, Psl over the standard library, what an entity may expose, and the migration rules. Use when writing or reviewing anything under services/api.
---

# Writing PHP here

The conventions, and the reason for each. Adopted from the reference project at
`~/bindhq-webapp-main`, which runs this stack at far larger scale; where this repository
does not yet follow one, it says so.

Adjacent skills own their ground: **symfony-api** for resources, errors and access checks,
**code-structure** for where a class lives,
**code-comments** for what may be written in a comment, **locale-parity** for strings,
**name-things** for naming, **making-commits** for landing it.

## Where a class goes

**See the `code-structure` skill.** It owns the three tiers, the sub-namespace vocabulary,
what stays flat, and the procedure for moving a class without breaking the autoloader.

## The shape of a class

```php
<?php

declare(strict_types=1);

namespace App\Address;

use Psl\Str;

final readonly class NominatimProvider implements AddressProvider
{
    public function __construct(
        private HttpClientInterface $http,
        private LoggerInterface $logger,
        private string $endpoint = 'https://nominatim.openstreetmap.org',
    ) {
    }
}
```

- **`declare(strict_types=1)` on every file.** No exceptions.
- **`final readonly` by default.** Then `final`. Then plain, and only with a reason.
  Currently 21 and 14 of each here, which is the right proportion.
- **Constructor property promotion, `private`.** A dependency is not part of the surface.
- **An entity is not `final`** — Doctrine needs to subclass it for proxies. That is the one
  place the default does not apply, and it is the framework's constraint rather than a
  style choice.
- **Immutability by default.** A setter exists because something genuinely changes over
  time, not because a property exists.
- **No fluent setters.** `return $this` is for a builder and nothing else. Chained setters
  read as a transaction that is not one, and hide which call failed.
- **An interface is named `XInterface`.** `AssistantInterface`, `AddressProviderInterface`,
  as the reference does throughout — `EntityInterface`, `AddressInterface`,
  `ConditionIdentifierInterface`. The suffix is worth the letters because the port and its
  adapters are read side by side: `AssistantInterface` with `AnthropicAssistant` and
  `ScriptedAssistant` under it says which is which at a glance, where a bare `Assistant`
  next to `ScriptedAssistant` reads as though one were a special case of the other.
  The folder is `Interfaces/`; the suffix is not redundant with it, because the name is
  what appears at every use site.

## Psl rather than the standard library

```php
use Psl\Str;
use Psl\Type;
use Psl\Vec;

Str\lowercase($email);
Type\shape([...])->coerce($payload);
```

**Import the namespace, never the function.** `use Psl\Str;` then `Str\lowercase()`. A bare
`use function Psl\Str\lowercase;` reads identically to the native function at the call
site, which is exactly the confusion the library exists to remove.

It is not a style preference. The native functions it replaces have return types that
cannot be checked:

- `strpos()` answers `int|false`, and `false` and a legitimate `0` are the same value under
  `==`. `Str\search()` answers `?int`. This is the single most reliable way to misread a
  PHP string, and `NominatimProvider` carries the comment saying so.
- `json_decode()` answers `mixed`. `Psl\Json` and `Psl\Type` answer a shape or throw.
- Array functions silently accept and return `mixed`. `Psl\Vec` and `Psl\Dict` are typed.

**Input is typed at the boundary, once.** `App\Http\Input` coerces a request body through a
`Type\shape()` before anything reads a field, so a malformed payload fails at the edge with
a 422 naming the path rather than deep inside a service with a `TypeError`. A closed shape
_drops_ undeclared fields; `allowUnknownFields: true` keeps them. Know which you want.

## What an entity may expose

- **Never a Doctrine `Collection`.** Return a plain array: `return $this->agents->getValues();`
  Handing out a `Collection` hands out `add()` and `remove()`, so the entity's invariants
  are enforced only by whoever remembers to use the entity's own methods.
- **The constructor takes what the entity cannot exist without.** Not a no-argument
  constructor plus setters, which makes a half-built state reachable and therefore
  something tests will assert about.
- **A child takes its parent as the first constructor argument** and registers with it
  there, so it cannot exist detached and cannot be reparented. There is a trap in this that
  no static check and no unit test can see — removal stops meaning detachment and starts
  meaning deletion, which requires `orphanRemoval: true` on the collection or the row
  silently survives. The reference project's `owning-child-constructors` skill documents it
  in full; read it before converting a pair.
- **Normalisation happens in the entity**, not in a controller or a form. A second writer
  is a second idea of what the same value means, and a uniqueness constraint only holds if
  every writer agrees.

## A repository reads. It does not write

**No `save()`, `remove()`, `persist()` or `flush()` on a repository.** A repository answers
questions about what is stored. Writing is the caller's business, through
`EntityManagerInterface`.

The reference project has 183 repositories and two of them flush, which is the ratio this
rule describes rather than a guess at it.

It matters because `save()` on a repository decides, on the entity's behalf, that this
change is its own transaction. Two of them in one use case are two commits, and the second
one failing leaves the first in place — a half-finished registration with no way to tell
from the row that it is half-finished. The use case is the only thing that knows where the
transaction boundary is, so the use case calls `flush()`, once.

It is also where the method ends up doing more than it says: `save()` grows a normalisation,
then a timestamp, then a side effect, and the entity's invariants are now enforced in a
class whose name says it only looks things up.

```php
// No.
final class UserRepository extends ServiceEntityRepository
{
    public function save(User $user): void { ... }
}

// Yes — the repository answers questions.
final class UserRepository extends ServiceEntityRepository
{
    public function findOneByEmail(string $email): ?User
    {
        return $this->findOneBy(['email' => User::normaliseEmail($email)]);
    }
}
```

A query that does not fit `findBy` goes here as a named method — `findOneByEmail`,
`countActiveSince` — rather than a `QueryBuilder` assembled at the call site. That is the
job.

## Types

- A docblock carries only what PHP cannot express: generics, array shapes, `list<>`,
  `@return never`. `@param string $name` next to `string $name` is noise.
- `mixed` does not leave the boundary it entered at. If a value arrives as `mixed`, coerce
  it through `Psl\Type` there and pass the typed result on.
- A backed enum, with its behaviour on it. An enum that is only a list of constants and a
  `match` elsewhere has put its behaviour in the wrong place.

## Tests

- **A factory, not a fixture file.** The reference has one `EntityFactory` with 210 static
  `makeX()` methods: every parameter nullable, each cascading into the next
  (`$organisation ?? self::makeOrganisation()`), and the id set by reflection so an
  unpersisted entity still has one. A test overrides only the field under test and gets a
  valid object graph with no database. **This does not exist here yet and should.**
- **Prophecy for mocking**, not PHPUnit's own doubles.
- A test that exists to catch one specific regression says which, in one line. That is one
  of the few comments `code-comments` keeps.
- The judgement goes in a pure function with its own test — the thing worth testing is the
  rule, not the wiring around it.

## Migrations

These are the reference project's rules and they are hard-won:

- **A data backfill belongs in the migration that needs it**, never in a one-off command
  somebody runs by hand at deploy time.
- **Write a backfill as raw SQL through `addSql`**, never through an entity or a
  repository. The mapping describes the schema at HEAD, not the schema at this point in the
  chain, so an entity-driven backfill breaks the moment a later migration changes a column.
- **Order: backfill, then add the constraint.** Insert an explicit assert between them —
  `RAISE EXCEPTION` if bad rows remain — only where the constraint's own error would not
  identify them. `SET NOT NULL` on one column already names the table and the column, so it
  needs no assert; one message covering two tables does.
- **Read a generated migration before running it.** `doctrine:migrations:diff` cannot tell
  a rename from a drop and a create, and emits the destructive pair. It also diffs against
  whatever the database currently is, so a database behind on migrations produces a diff
  that recreates tables that already exist.
- What happens to rows that predate the change goes in the story's AC and the pull
  request's Risks, per `docs/architecture/database.md` — not in a comment.
