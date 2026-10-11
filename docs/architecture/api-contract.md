# The API contract

One shape, every endpoint. A client that has to recognise a different envelope per
endpoint ends up with a different error path per endpoint, and most of those never get
exercised until something breaks in front of a user.

## Success

```json
{ "success": true, "data": { "id": "018f3a4c-…", "name": "Adaeze Okonkwo" } }
```

`data` is whatever the endpoint returns — an object, a list, or `null` for a `204`.

## Failure

```json
{
  "success": false,
  "error": "We could not find what you asked for.",
  "code": "not_found",
  "correlation_id": "018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f"
}
```

- **`code`** is the stable, `snake_case` identifier a client branches and translates on. It
  never changes once released. Two different `409`s are the same HTTP status and entirely
  different problems; the code is what tells them apart.
- **`error`** is a human sentence. It is a **fallback**, not the message a user should
  normally see — a client with the code translated shows its own wording.
- **`correlation_id`** ties the response to the server logs for the same request.

Every code lives in `App\Http\ErrorCode`. It is an enum, not a set of strings, so the list
is closed and a test can walk it. Codes invented at the call site cannot be enumerated,
cannot be translated ahead of time, and drift into near-duplicates — `not_found`,
`notfound`, `resource_missing` — that mean one thing to a person and three to a `switch`.

**A code added without a message in all four locales fails `ErrorCodeCatalogueTest`.** That
guard exists because the failure is otherwise invisible: no exception, no log line, no
failing request — just `errors.not_found` rendered on a guest's screen in Portuguese.

## Validation

```json
{
  "success": false,
  "error": "Some of the information provided is not valid.",
  "code": "validation_failed",
  "fields": {
    "email": { "code": "not_an_email", "message": "That is not an email address." }
  }
}
```

`fields` lets a form mark the offending input rather than showing one banner above
everything. One violation per field: an input carrying four stacked messages is not more
helpful than one carrying its first.

## Pagination

Decided once, here. The previous build returned three different pagination shapes and
every client carried three readers for them.

```json
{
  "success": true,
  "data": {
    "items": [],
    "meta": { "page": 2, "per_page": 50, "total": 412, "total_pages": 9 }
  }
}
```

A cursor-paged list carries `next_cursor` and **omits `total`** rather than reporting
zero — a zero reads as "no results" to anything rendering a count.

## What never appears in a response

- A stack trace, a file path or a line number, in **any** environment
- The text of a `5xx` exception. That message is ours and routinely quotes a query, a path
  or a connection string. It goes to the log; the caller gets the catalogue's wording and
  the correlation id that joins the two
- Anything that distinguishes "this exists but is not yours" from "this does not exist"

A `4xx` may carry its own message, because it describes what the caller did.

## Errors are JSON in every environment

Including dev. Symfony's default is an HTML error page, which a mobile client parses as
nothing at all — so the one case a client most needs to understand would be the one it
cannot read, and its error path would never be exercised until production.
