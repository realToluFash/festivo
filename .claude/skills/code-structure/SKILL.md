---
name: code-structure
description: Where a class goes in services/api — the three tiers, the sub-namespace vocabulary, what stays flat, and the procedure for moving a class safely. Use before adding a class, when a folder starts collecting unlike things, or when moving anything between namespaces.
---

# Where a class goes

Adopted from `~/bindhq-webapp-main`, which runs this layout across 52 modules. **writing-php**
owns how a class is written; this owns where it lives.

## Three tiers, and the test for which one

| Tier                       | What belongs                                         | Examples here                                                                                       |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Domain/<Concept>/`        | a product scope — something the business talks about | `Domain/User/`, `Domain/Guest/`, `Domain/Event/`, `Domain/Budget/`                                  |
| `<Capability>/` at root    | a technical capability several scopes use            | `AI/`, `Address/`, `Storage/`, `Audit/`, `Http/`, `Locale/`, `Translation/`, `Health/`, `Doctrine/` |
| `Integrations/<Provider>/` | an adapter to somebody else's service                | `Integrations/Anthropic/`, `Integrations/Nominatim/`                                                |

**The test:** would a non-engineer at this company recognise the word? "Guest", "Budget",
"Venue" — `Domain/`. "Storage", "Locale", "Http" — a capability. Named after a company that
is not us — `Integrations/`.

The reference's `Domain/` holds only business concepts — Agency, Agent, Claim, Contract,
Policy, Quote, Task, Team, User — and keeps `Security/`, `System/`, `Util/`, `Encryption/`,
`File/`, `Email/`, `Api/` at root. Follow that: **`Audit` and `Health` are capabilities, not
domain concepts**, and `scopes.md` calls address lookup and object storage Foundation
plumbing outright.

`Domain/` does not exist yet. It appears with the first product scope, and sc-54's register
endpoint and password policy are its first occupants: `Domain/User/Controller/`,
`Domain/User/Password/`.

## Inside a module: concept first, then role

A module groups by what a thing **is**. The vocabulary, by how often the reference uses it:

`Controller` 29 · `Model` 27 · `Form` 25 · `Interfaces` 18 · `Exception` 17 · `Traits` 13 ·
`Helper` 13 · `Factory` 11 · `Repository` 9 · `Listener` 9 · `Enum` 9 · `Command` 7

So:

```
AI/
  Availability.php  Interactions.php  ScriptedAssistant.php  SystemPrompt.php
  Controller/   Exception/   Factory/   Interfaces/   Model/
```

**`Service` appears only 4 times in 52 modules.** That is deliberate: they name the role —
`Calculator`, `Extractor`, `Resolver`, `Helper` — or leave the class at the module root.
**Do not create a `Service/` folder, and never a `Services/` root.** A folder called
`Service` is layer-first wearing a different hat, and it tells a reader nothing: every class
in a module is a service.

A class that _is_ the capability stays at the module root. `AddressLookup`, `HealthChecker`,
`Availability`, `ObjectStore`, `Auditor` are not in subfolders, because the module is named
for what they do.

## What stays flat at `src/`

|               | Why                                                                             |
| ------------- | ------------------------------------------------------------------------------- |
| `Entity/`     | Doctrine maps one directory, and entities are the vocabulary every module reads |
| `Repository/` | one per entity, named for it                                                    |
| `Enum/`       | **every enum in the product, in one place.** `ls src/Enum` is the list          |

The reference splits enums — a root `Enum/` for shared ones and nine module-level `Enum/`
folders for local ones. We deliberately do not: discoverability won. The cost is that a
scope's private enum will sit next to `ErrorCode`. If that starts to grate the rule becomes
"shared at root, local in the module", but do not pre-empt it.

## The things that have no home anywhere else

- **A controller goes with the thing it serves** — `AI/Controller/`, `Address/Controller/`,
  `Domain/Guest/Controller/`. Never a flat `src/Controller/`. There is no such folder and
  adding one back undoes this.
- **A listener goes with what it listens about** — `Http/Listener/` for correlation ids and
  exception rendering, `Locale/Listener/` for resolving a request's language.
- **An adapter goes under `Integrations/<Provider>/`**, and the port it implements stays in
  the capability's `Interfaces/`. A second geocoder is then
  `Integrations/Google/PlacesProvider.php` with nothing in `Address/` changing.
- **Exceptions belonging to a port stay with the port.** `ProviderUnavailable` is in
  `Address/Exception/` and not with the Nominatim adapter, because the controller catches it
  and `AddressLookup` declares it — it is the port's vocabulary, not one provider's.

## Moving a class: the procedure

Follow this in order. Every step below exists because skipping it broke the build.

1. **`git mv`**, so blame follows the file.
2. **Rewrite references to the full name**, longest match first, with a negative lookahead:
   `App\AI\Assistant` is a prefix of `App\AI\AssistantFactory`, and a naive replace turns
   the factory into `App\AI\Interfaces\AssistantFactory`.
3. **Set every namespace declaration from the file's path**, rather than editing the ones you
   think moved. Rewriting references does not touch a file's own `namespace` line, and a
   class in a new folder still declaring its old namespace fails as _"cannot redeclare"_ — in
   the autoloader, not at the edit.
4. **Add imports for former siblings.** This is the one that bites hardest. Classes in one
   namespace reference each other with no import; split them and those bare names silently
   resolve to the _new_ namespace, which has no such class. It cost three separate breakages
   in one afternoon: the three request listeners, then `NominatimProvider`'s five Address
   types, then `AssistantFactory` reaching for `ScriptedAssistant`.
5. **Let the formatter remove the surplus.** `no_unused_imports` is on, so add generously.
   Two exceptions it will not catch, because the token looks used: a name matching an enum
   case (`use App\Entity\User` next to `case User = 'user'`) and a name appearing only in
   prose. Check those by hand.
6. **Keep a docblock-only import.** `@throws AddressNotFound` and `@return list<Suggestion>`
   are real references; a script that strips comments before looking will delete the import
   they need.
7. **Update `config/services.yaml`** — service ids, aliases, factories and `!php/const` all
   name classes.

## Verifying a move

In this order, because each catches what the previous one does not:

```bash
docker compose exec -T api php bin/console lint:container       # autowiring
docker compose exec -T api php bin/console debug:router         # attribute routes
docker compose exec -T api php bin/console doctrine:schema:validate
npm run test:api
```

**`lint:container` is the gate, not the test suite.** After one of the moves above,
`php-cs-fixer` was clean and all 168 tests passed while the container could not compile —
because autowiring is where a wrong class name surfaces, and the tests were not exercising
that service. A green suite is not evidence that a move worked.

## Enforcing it

`mago guard` turns this document into a check: named layers and rules per namespace, in
`perimeter` mode. The reference uses it to keep its analytics module out of its
transactional one. For us it is how `scopes.md`'s seventeen scopes stop being a convention —
right now nothing prevents `Domain/Guest` reaching into `Domain/Budget`. Worth adopting with
the rest of mago; until then this is enforced by reading.
