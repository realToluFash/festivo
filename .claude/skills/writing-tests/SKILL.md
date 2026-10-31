---
name: writing-tests
description: How tests are written and run in services/api — the four kinds and their base cases, where doubles live, the database routine, and how to tell a guard from an assertion that can never fail. Use when adding or changing a test, or when a suite is green and something is still broken.
---

# Writing tests here

**writing-php** owns how a class is written and **code-structure** owns where it lives. This
owns the suite.

## Running it

```bash
just test-api                 # the whole API suite
just test-api RequestLocale   # one class
just prepare-database-test    # drop, recreate, migrate
just check                    # everything CI runs
```

**Never `php bin/phpunit` or `vendor/bin/phpunit` directly.** Without `APP_ENV=test` the
kernel boots in `dev`, where `framework.test` is off, and 67 of 178 tests fail on
_"You have requested a non-existent service `test.service_container`"_ — which reads as a
broken suite rather than a wrong command. `just test-api` and `npm run test:api` set it.

**`just prepare-database-test` drops and recreates.** It does not migrate in place. A
database migrated in place keeps whatever a since-deleted migration created, and the suite
then passes against a schema no fresh environment will ever have.

## The four kinds, and the base case for each

| Kind           | Extends                        | What it is for                                          |
| -------------- | ------------------------------ | ------------------------------------------------------- |
| **Unit**       | `PHPUnit\...\TestCase`         | a rule, in isolation, with no container and no database |
| **Functional** | `App\Tests\FunctionalTestCase` | the container: a service against a real database        |
| **API**        | `App\Tests\ApiTestCase`        | an HTTP request, status code and response body          |
| **Server**     | `PHPUnit\...\TestCase`         | a real FrankenPHP process, for what kills PHP itself    |

```php
final class AddressLookupTest extends TestCase            { ... }   // tests/Unit/
final class AuditTest extends FunctionalTestCase          { ... }   // tests/Functional/
final class RequestLocaleTest extends ApiTestCase         { ... }   // tests/Functional/
final class FatalErrorAnswerTest extends TestCase         { ... }   // tests/Functional/
```

A Server test starts `frankenphp php-server` on a free port and drives it over HTTP. It is
for a fatal error, a memory or time limit, anything that only `public/index.php` and the
runtime see: `ApiTestCase`'s client never goes through the front controller, so the same
test moved onto it passes without PHP ever dying.

`FunctionalTestCase` boots the kernel in `setUp`; `ApiTestCase` creates the client there.
A subclass with its own `setUp` calls `parent::setUp()` first.

**Pull services through `self::service()`, never `self::getContainer()->get()`.**
`ContainerInterface::get()` answers `?object`, so the service arrives as something no
analyser can check and a wrong id surfaces as a TypeError several lines later.

```php
$this->em = self::service(EntityManagerInterface::class);          // typed, asserts on fetch
$factory = self::serviceById('limiter.assistant_chat', RateLimiterFactory::class);
```

`serviceById` is for a service whose id is not a class name. Both live in
`tests/Traits/ServiceAccessTrait.php`, which carries
`@phpstan-require-extends KernelTestCase` so the analyser can resolve the methods it calls
on its host.

**Create the client once.** A second `self::createClient()` in the same test boots a second
kernel and silently discards the first one's container, so a service the test configured is
no longer the one the request uses. `ApiTestCase` gives you `$this->client`.

## Doubles

**A double is a named class in `tests/Double/`, not an anonymous class.**

```php
// tests/Double/CountingAddressProvider.php
final class CountingAddressProvider implements AddressProviderInterface
{
    public int $suggestCalls = 0;
    ...
}
```

An anonymous class returned from a helper typed as the interface erases everything the
double adds. `tests/Unit/AddressLookupTest.php` did exactly that and six assertions on
`$provider->suggestCalls` were unverifiable — the analyser reported
_"Property `$suggestCalls` does not exist on interface `AddressProviderInterface`"_, and
nothing else had noticed, because the code works. A named class puts the counters in the
type.

Use a hand-written double when the double has behaviour — a counter, a queue of answers, a
throw on the third call. PHPUnit's `createMock` is for the case where you only need the
interface satisfied.

## The factory that does not exist yet

The reference project at `~/bindhq-webapp-main` has one `EntityFactory` with 210 static
`makeX()` methods: every parameter nullable, each cascading into the next
(`$organisation ?? self::makeOrganisation()`), and the id set by reflection so an
unpersisted entity still has one. A test overrides only the field under test and gets a
valid object graph with no database.

**Build this with the first entity graph that has more than two edges.** Until then a
constructor call in the test is clearer than a factory with one method. Do not write
fixture files for it: a fixture file is shared state that every test then has an opinion
about, and the fifth test to need a different value edits it for the other four.
`src/Doctrine/DataFixtures/AppFixtures.php` is for a usable development database, not for
the suite.

## The database

`dama/doctrine-test-bundle` is registered in `config/bundles.php` for the test environment
and wired as a PHPUnit extension in `phpunit.dist.xml`. Every test runs in a transaction
that is rolled back, so a test may write freely and the next one sees none of it. Nothing
needs cleaning up in `tearDown`.

Two things this makes tempting and wrong:

- **Do not assert on an auto-increment value or on row order without an `ORDER BY`.** The
  rollback does not reset a sequence.
- **An order assertion sorts on a unique key, or ends its `ORDER BY` with one.** The
  `occurred_at` columns are `TIMESTAMP(0)`, so rows written in one test tie, and a tie
  comes back in any order. Break it with the UUIDv7 `id`, which is time-ordered.
- **Code that opens its own transaction** sees a transaction already open. If something
  needs to commit for real, it cannot be tested this way, and that is worth saying in the
  test rather than working around.

`tests/Functional/DatabaseIsolationTest.php` holds the two promises nobody checks: that the
suite is pointed at a database whose name ends `_test`, and that the mapping reaches a real
table. The cost of either being false is somebody's local data.

## A guard has to be able to fail

**After writing a test that protects something, break the thing and watch it go red.** An
assertion that cannot fail is worse than no test: it is a claim that something is checked.

This caught three separate false guards in one afternoon. The token-drift test only failed
once a hex was hand-edited into the generated file. A locale case written as
`['fr;q=abc,es;q=0.1', 'No hemos encontrado']` passed against both the bug and the fix,
because a malformed quality cast to `0.0` already lost the sort — it had to expect French
to discriminate. And `ActorReadableTest` only proved it covered four locales once
`actor.agent` was deleted from the French catalogue.

Say in the report which assertion you broke and what it printed.

## What a green suite does not tell you

- **`lint:container` is the gate after moving or renaming a class.** php-cs-fixer was clean
  and all 168 tests passed while the container could not compile, because autowiring is
  where a wrong class name surfaces and the tests were not exercising that service.
- **`just static-analysis` reads signatures, which no test does.** It found a truncated
  docblock, a dependency injected and never used, and an env var handed to a provider
  without being checked against the values the provider accepts.
- **A mock can pass against a payload the server never sends.** Assert the response shape
  against the server source, not against a fixture written by hand.

## Shape

- **`#[Test]`, not a `test` prefix.** The attribute is imported from
  `PHPUnit\Framework\Attributes\Test`.
- **The method name is a sentence about the behaviour**, not about the method under test:
  `aQueryTooShortToMatchIsNeverAsked`, `itDoesNotLeakCredentialsFromADsn`,
  `theConfiguredBudgetRunsOut`.
- **A data provider yields named cases** and declares its shape:
  `/** @return iterable<string, array{string, string}> */`, then
  `yield 'brazilian portuguese' => ['pt-BR,en;q=0.5', 'Não encontrámos'];`. The name is what
  a failure prints.
- **`failOnDeprecation`, `failOnNotice` and `failOnWarning` are all on.** A deprecation is a
  failure here, so a library upgrade surfaces in the suite rather than in a log nobody
  reads.
- **One behaviour per test.** A test asserting four things reports the first failure and
  hides three.
- **A test that exists to catch one specific regression says which, in one line.** That is
  one of the few comments `code-comments` keeps — the rest of the suite needs none, because
  the method names are sentences.
- **An API test sends an empty body as `{}`, never `Json\encode([])`.** That writes `[]`, a
  list, which `Input::body` refuses whole (sc-9412), so the request never reaches the
  behaviour under test. Encode `[] === $fields ? new stdClass() : $fields`.

## Four locales, every time

Anything user-facing exists in `en`, `es`, `fr` and `pt`. `ErrorCodeCatalogueTest` and
`ActorReadableTest` are the pattern: every case has a label in every locale, no locale
carries a label for a case that no longer exists, and no two cases read the same in any
locale. A new enum whose values reach a person gets the same three tests.

## A way back in the app gets a Maestro flow

A navigation control added to an app screen gets a Maestro step for each way it can go back,
and one for where it shows no control: `apps/mobile/.maestro/`, named for the story, written
to its README's rules. The web's version of the same control has a test beside its route; the
app's has no suite that walks the stack, so without the flow nothing checks it. Two pull
requests in a row shipped an app back control with no step (#1108, #1110).

## Browser checks only on request

Never drive the app in a browser to confirm something unless asked. `tsc --noEmit`, the
targeted suite, and the rule extracted into a pure function with its own test are what
survive the session.
