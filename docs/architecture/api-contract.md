# The API contract

**API Platform**, serving plain JSON, with errors as RFC 7807 problem documents.

## Why API Platform

Three reasons specific to this product, in the order they mattered:

1. **It generates the OpenAPI document**, which is how `packages/api-client` learns the
   shape of the API. Hand-written client types are a second copy of a fact, and two copies
   of a fact diverge.
2. **Mercure publishing is declarative.** `mercure: true` on a resource publishes on write.
   The previous build's worst realtime failure was a publish that silently never happened —
   no error, no log, just a screen that never updated. Removing the chance to forget
   removes the class.
3. **Lists are the bulk of the work.** Six hundred guests with search, filters by RSVP and
   dietary and group, sorting and pagination — declarative rather than written per endpoint.

### What it does not do for us

**The service floor is not CRUD.** "Mark this plate served", "assign this table to Mary",
"chase this ticket" are commands. They stay plain controllers alongside the resources. That
is a supported mix, not a workaround.

**It does not enforce our access rule.** `security` on an operation is optional in API
Platform, and ours is that a route without a declared policy must fail at boot. That needs
a check walking its resource metadata — the same work as for plain controllers, in a
different place. See sc-64.

## Plain JSON, not JSON-LD

JSON-LD is API Platform's default and the right one for a public, self-describing API. This
one has two known clients that we also write, and `@context`/`@id`/`@type` on every object
is weight they would strip and ignore. The OpenAPI document is how they learn the shape.

## Errors

RFC 7807, `Content-Type: application/problem+json`:

```json
{
  "type": "https://soirely.com/errors/not_found",
  "title": "We could not find what you asked for.",
  "status": 404,
  "detail": "No guest with that id.",
  "correlationId": "018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f"
}
```

- **`type`** is the stable identifier a client branches and translates on. It never changes
  once released. Two different `409`s are the same status and entirely different problems;
  the type is what tells them apart. The URI is an identifier, not a promise to serve a page
  there.
- **`title`** is the human sentence, from the catalogue, in the reader's language.
- **`detail`** is this particular instance of the problem. **Present on a `4xx`, never on a
  `5xx`** — that message is ours and routinely quotes a query, a path or a connection
  string.
- **`correlationId`** ties the response to the server logs for the same request.
- **`violations`** carries per-field validation failures, each with `propertyPath`,
  `message` and `code`, so a form marks the offending input rather than showing one banner.

Every type comes from `App\Http\ErrorCode`. It is an enum, not a set of strings, so the
list is closed and a test can walk it. **A code added without a message in all four locales
fails `ErrorCodeCatalogueTest`** — a guard worth having because the failure is otherwise
invisible: no exception, no log line, just `not_found` rendered as a title on a guest's
screen.

## Pagination

API Platform's, not a hand-rolled one. Fifty per page by default, two hundred maximum, and
the client may ask for a different size within that.

## What never appears in a response

- A stack trace, a file path or a line number, in **any** environment
- The text of a `5xx` exception
- Anything that distinguishes "this exists but is not yours" from "this does not exist"

## Errors are JSON in every environment

Including dev. Symfony's default is an HTML error page, which a mobile client parses as
nothing at all — so the one case a client most needs to understand would be the one it
cannot read, and its error path would never be exercised until production.
