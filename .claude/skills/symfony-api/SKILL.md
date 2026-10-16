---
name: symfony-api
description: The conventions the Soirely API is held to — Doctrine entities and migrations, response and error shape, and the access checks that must be mounted rather than remembered. Use when writing or reviewing anything under services/api.
---

# Symfony API Conventions

What everything under `services/api` is held to. Read before adding an endpoint, an
entity or a migration.

## It is API Platform

Resources are Doctrine entities carrying `#[ApiResource]`. The OpenAPI document it
generates is what `packages/api-client` builds the client types from, so **the API's shape
is defined by the entity and its operations**, not by a controller.

Three things follow:

- **Do not hand-write a CRUD controller.** If you are writing `GET /guests` by hand, the
  resource is not configured.
- **Commands are different and stay controllers.** "Mark this plate served", "chase this
  ticket" — these are not resource operations and should not be contorted into them.
- **A policy is optional in API Platform and mandatory here.** The resource class declares
  one, and a resource without one stops the router loading. See the access rule below.

Errors are RFC 7807 problem documents. See `docs/architecture/api-contract.md`.

## Input is coerced, never cast

PHP answers bad input with a falsy value and a silent coercion, and its types stop at the
function signature. `json_decode` returns `null` for a malformed body and for the literal
`null`. A declared `string $country` accepts an integer. `strpos` returns `0` and `false`
and only `===` tells them apart. Every one of those is a defect that typechecks, and the
previous build shipped several — a cache-key builder declaring `string ...$parts` was handed
a null country code, PHP coerced it on the way in, and it surfaced three frames later as a
500 that never mentioned the country.

So `php-standard-library` is a production dependency, and the rules below are not optional.

**Every boundary declares the shape it needs.** A handler never reaches into `$request`:

```php
$input = Input::query($request, Type\shape([
    'q' => Type\optional(Type\string()),
    'country' => Type\optional(Type\nullable(Type\string())),
]));
```

`Input::body()` and `Input::query()` are in `src/Http/Input.php`. A body that is not JSON
is a 400 — there is no field to blame. A readable request of the wrong shape is a 422
carrying the failing path as a violation. Neither is a 500, and neither silently coerces.

**Leave shapes closed.** `allowUnknownFields` defaults to `false`, and on `coerce()` that
_drops_ undeclared fields rather than refusing them — which is the behaviour you want: a
client's tracking parameter is not an error, and the handler receives declared keys only.
Pass `allowUnknownFields: true` only when a payload must travel onwards intact; it keeps
whatever was sent, so never spread that result into an entity.

**Bodies coerce, they do not assert.** `assert()` closes the shape but would refuse
`{"latitude": 51}` for a declared float, because JSON has one number type and that decodes
to an int. The coordinate was sent correctly; refusing it would be the bug.

**A provider's response is input too.** Coerce it at the adapter, never at the call site —
see `NominatimProvider::result()`. Declare the fields the adapter actually reads, and make
_required_ the ones whose absence means the integration is broken rather than the result
being thin. `display_name` is required there for exactly that reason: optional, a renamed
key read as a blank address line instead of as an error.

**Which Psl replaces what** — listed where it removes a footgun, not to rename a function:

| Instead of                                | Use                                           | Because                                                                                                        |
| ----------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `json_decode` / `json_encode`             | `Psl\Json\decode` / `Psl\Json\encode`         | They throw. `RawDecodingTest` fails the build if either appears in `src/`.                                     |
| `strpos`                                  | `Psl\Str\search`                              | Answers `?int`, not `int` or `false` — where the legitimate `0` and the failure are the same value under `==`. |
| `substr`, `trim`, `strtolower`, `explode` | `Psl\Str\slice`, `trim`, `lowercase`, `split` | Total: nothing returns `false` for you to forget.                                                              |
| `array_map` + `array_values`              | `Psl\Vec\map`                                 | Already a list, so the second call cannot be left off.                                                         |

**Where raw PHP stays**, deliberately:

- Doctrine hydration. The entity's property types are the contract there.
- Symfony's own surfaces — `Request`, `Response`, the container. Coerce what comes _out_ of
  them; do not wrap them.
- `RequestLocaleListener` reads the `locale` query parameter directly. It runs at priority
  34, before the error envelope exists, and a bad locale must fall back rather than fail the
  request.

`declare(strict_types=1)` is on every file, enforced by php-cs-fixer's `declare_strict_types`
rather than by anybody remembering it.

## Dependencies

`composer.json` pins `config.platform` to the PHP version and extension set the **container**
runs, not whatever the tooling image happens to have. Composer runs through
`scripts/php-tool.mjs`, whose image ships a newer PHP than FrankenPHP does, so without the
pin every dependency resolves against a platform nothing deploys on — a package requiring
`^8.5` installs cleanly and then fails inside the API container, naming a class rather than
the cause.

Two rules follow:

- **Run composer from `services/api`**, not the repository root. The tool mounts the working
  directory, so from the root it writes a second, empty `composer.json` beside the real one.
- **An extension the image installs is declared in `require`.** They were not, so nothing
  noticed that the resolver had neither `intl` nor `bcmath` available.

## Access is mounted, not remembered

**Every event-scoped route carries its access check as part of the route definition**, not
as a line somebody remembered to write inside the controller.

This is the single most expensive lesson from the previous implementation. A route that
forgot its check behaved perfectly for everyone allowed in, so nothing caught it — not a
test, not review, not use. The only reliable defence is making the check structural, so a
route without one cannot be registered at all.

It is built: `docs/architecture/access-control.md`. Every controller, or every API Platform
resource class, carries one of `#[PublicAccess]`, `#[Authenticated]`,
`#[InOrganisation(Permission::…)]` or `#[InEvent(Permission::…)]`, and a route without one
stops the router loading, naming the route. There is no `access_control` in
`security.yaml`, and there must not be one again.

Two rules follow from it:

- A sub-resource id is scoped to its parent before it is used: mark the argument
  `#[InThisEvent('tableId')]` and give its repository `findOneInEvent()`. Loading a table by its bare
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
