---
name: writing-php
description: How PHP is structured and written in this repository — where a class goes, the shape every class takes, Psl over the standard library, what an entity may expose, and the migration rules. Use when writing or reviewing anything under services/api.
---

# Writing PHP here

The conventions, and the reason for each. Adopted from the reference project at
`~/bindhq-webapp-main`, which runs this stack at far larger scale; where this repository
does not yet follow one, it says so.

Adjacent skills own their ground: **symfony-api** for resources, errors and access checks,
**writing-tests** for the suite, **writing-migrations** for the schema,
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

## An entity is a data layer, and nothing else

**The only methods on an entity are `getX`, `setX` and `isX`.** If you are about to write
any other name on an entity, it belongs in the caller or in a service.

That rules out four things it is natural to reach for:

- **No static factories.** `User::register(...)`, `Order::fromBasket(...)` — these put the
  decision about how a thing comes into existence inside the thing. Call the constructor,
  and let the service that knows _why_ decide what to pass it.
- **No verbs.** `completeProfile()`, `verifyEmail()`, `changePhone()`, `revoke()`,
  `softDelete()`. Each is a rule wearing a mutator's clothes: `changePhone()` also cleared
  `phoneVerifiedAt`, which is a policy decision, not a write. Name it `setPhone()` and let
  whoever changes the phone decide what else that means, or give that decision a service.
- **No normalisation.** `User::normaliseEmail()` moved to `App\Domain\User\EmailAddress`.
  One definition of what "the same address" means, called by every writer — and the
  entity is not the one place every writer goes through, the service is.
- **No `hasX`.** `hasPassword()` is `null !== $user->getPassword()` at the call site.

**Exempt:** methods a framework names. `getUserIdentifier()`, `getRoles()` and
`eraseCredentials()` are Symfony's interface; `#[ORM\PrePersist]` and `#[ORM\PreUpdate]`
callbacks are Doctrine's. You do not get to rename those, and they are the mechanism, not
domain logic.

**`isX` is allowed to compute**, which is the one place judgement stays. `isVerified()` and
`isComplete()` read several columns and apply a rule to them. They are still answers about
this row's own data, they cannot write, and the alternative — a service injected everywhere
just to ask whether a row is complete — is worse.

### Why

An entity is loaded by Doctrine in contexts you did not write: a fixture, a migration
backfill's `getRepository()`, a hydration during a query, a proxy. Every method on it is
reachable from all of those. A rule placed there is a rule that runs in places that have no
business running it, and a rule placed in a service runs exactly where it was called.

It also keeps `getX`/`setX` honest. Once one method on an entity does something more than
read or write a field, the next reader has to check all of them.

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
- **A timestamp Doctrine can maintain is maintained by Doctrine.** `createdAt` and
  `updatedAt` come from `App\Doctrine\Traits\Timestampable`, which carries the columns,
  `#[ORM\PrePersist]` to initialise them and `#[ORM\PreUpdate]` to move `updatedAt`. The
  alternative is a private `touch()` that every mutator has to remember to call — `User` had
  seven of them, and the eighth mutator anybody adds is the one nobody notices is missing:
  the row stops reporting when it last changed and no test fails.
  - **The entity must carry `#[ORM\HasLifecycleCallbacks]`.** Without it Doctrine never
    looks for the callbacks, so the trait is inert and there is no error of any kind.
    `TimestampableTest` enforces it for every entity using the trait, because nothing else
    can.
  - A `PreUpdate` callback fires only when a **mapped field** is dirty. A change to a
    collection alone does not make the owning entity dirty, so a parent whose only change is
    an added child does not get a new `updatedAt`. If that matters, the parent needs a field
    that changes too.
  - The reference project does this across 25 entities with the same trait-and-attribute
    pair, which is where the shape comes from.
- **Normalisation has exactly one definition, and it is not on the entity.** A second
  writer is a second idea of what the same value means, and a uniqueness constraint only
  holds if every writer agrees — so put it in one function in the scope's namespace
  (`App\Domain\User\EmailAddress::normalise()`) and have every writer call that.

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

## A class that acts is named for the actor, not for the thing it acts on

**If the name is a noun for a thing, that thing has to be able to perform every method on
it.** `EmailAddress::normalise()` fails the test: an email address is a value, and a value
does not normalise anything. The class was a function wearing a value object's name.

```php
// No. None of these can do what they are being asked to do.
EmailAddress::normalise($email)          // an address does not normalise
$tokens->issueFor($user)                 // tokens do not issue themselves
$breachedPasswords->isBreached($plain)   // a set of passwords does not check one
$interactions->record($ask)              // interactions do not record themselves

// Yes. Each name is the thing doing the work.
EmailAddressNormaliser::normalise($email)
$tokenIssuer->issueFor($user)
$breachedPasswordChecker->isBreached($plain)
$interactionRecorder->record($ask)
```

The agent noun is usually the verb plus `-er` or `-or`: Normaliser, Issuer, Checker,
Recorder, Resolver, Calculator, Extractor, Builder. `code-structure` has the vocabulary the
reference project uses and how often, which is the place to look before inventing one.

**A plural noun is the most common form of this mistake**, because it reads as a collection
and is nearly always a service: `Tokens`, `Interactions`, `BreachedPasswords`, `Passwords`.
Every one of those was wrong here for the same reason.

**What stays a noun.** A class that genuinely _is_ the thing, and whose methods are
questions about itself or things it contains:

- `IssuedTokens`, `RegistrationResult`, `Address`, `Suggestion` — values, no behaviour
- `PasswordPolicy::check()` — a policy is a thing you consult, and consulting it is asking
  it about itself
- `SupportedLocales::supports()` — a set answering a question about its own membership
- `AddressLookup`, `ObjectStore`, `Availability` — the capability _is_ the named thing, and
  the methods are what you ask it for

**A past participle is not a noun.** `Registered` was holding a user and a token pair; it is
`RegistrationResult`. If the name reads as an adjective, it is describing something that is
missing from the name.

### The test

Say the call out loud with the subject first. _"The email address normalises the email"_ is
wrong, so the name is wrong. _"The policy checks the password"_ is fine, so it stays.

## A property is named after what it holds

**`$userRepository`, not `$users`. `$passwordHasherFactory`, not `$hashers`.**

A constructor property's name says what the thing _is_, which for an injected dependency
means its type. `$users` reads as a collection of users; it was a `UserRepository`.
`$breached` reads as a boolean; it was a `BreachedPasswordsInterface`.

```php
// No.
public function __construct(
    private UserRepository $users,
    private PasswordHasherFactoryInterface $hashers,
    private BreachedPasswordsInterface $breached,
    private EntityManagerInterface $em,
    private JWTTokenManagerInterface $jwt,
) {}

// Yes.
public function __construct(
    private UserRepository $userRepository,
    private PasswordHasherFactoryInterface $passwordHasherFactory,
    private BreachedPasswordsInterface $breachedPasswords,
    private EntityManagerInterface $entityManager,
    private JWTTokenManagerInterface $jwtTokenManager,
) {}
```

Drop the `Interface` suffix and nothing else. The abbreviation saves four characters at the
declaration and costs a guess at every one of the twenty call sites below it — and
`name-things` already says the same thing from the other direction: a name read in fifty
places earns its letters.

This applies to dependencies. A **local** variable in a three-line scope can be short, and
a genuine collection is still `$users`.

## Types

- A docblock carries only what PHP cannot express: generics, array shapes, `list<>`,
  `@return never`. `@param string $name` next to `string $name` is noise.
- `mixed` does not leave the boundary it entered at. If a value arrives as `mixed`, coerce
  it through `Psl\Type` there and pass the typed result on.
- A backed enum, with its behaviour on it. An enum that is only a list of constants and a
  `match` elsewhere has put its behaviour in the wrong place.

## Tests

**See the `writing-tests` skill.** It owns the four kinds and their base cases, where
doubles live, the database routine, and how to tell a guard from an assertion that can never
fail.

The one rule that belongs here, because it is about how the code is written rather than how
it is tested: **the judgement goes in a pure function with its own test.** The thing worth
testing is the rule, not the wiring around it. A rule reachable only through a controller
and a database is a rule nobody will write the fifth case for.

## Migrations

**See the `writing-migrations` skill.** It owns the nowdoc rule that makes a column list
readable, where a backfill belongs, the order of a backfill against a constraint, why a
generated migration is read before it is run, and what `down()` owes the person who runs it.
