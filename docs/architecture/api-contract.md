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

## Rate limits a person can hit

Every limit a person can reach is `429 too_many_attempts`, with `Retry-After` in seconds
and a `detail` naming the minute it lifts ("Try again at 14:35."), rounded up. A client
shows the time from `Retry-After`, in the reader's timezone, never a figure of its own.

| Endpoint                             | Budget                                                    | Spent by              |
| ------------------------------------ | --------------------------------------------------------- | --------------------- |
| `POST /api/auth/register`            | 10 per IP per hour, fixed window                          | every attempt         |
| `POST /api/auth/login`               | 5 per address and 30 per IP per 15 minutes, fixed windows | a refused password    |
| `POST /api/auth/verify/resend`       | one per 60 seconds per address                            | every code sent       |
| `POST /api/auth/two-factor/recovery` | 3 per account per 24 hours, rolling                       | every request started |

## Verifying an address

`POST /api/auth/verify/email` takes a code, and `GET`/`POST /api/auth/verify/resend` read
and spend the resend cooldown. The limits are constants on `VerificationChallenge`, and
this table is their contract:

| Limit           | Value      | What happens at it                                                                                                                                                                        |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code            | 6 digits   | Any other value is a wrong attempt, `verification_code_invalid`; an empty code costs none                                                                                                 |
| Lifetime        | 15 minutes | `verification_code_expired`, on every try until a new code is sent                                                                                                                        |
| Wrong attempts  | 5 per code | The fifth wrong code, and every try on that code after it (the right one included), is `verification_code_exhausted`. The code in the newest email then works                             |
| Resend cooldown | 60 seconds | Counted from the newest code sent, the registration email included. `GET` answers `cooldownSeconds` without spending it; a `POST` inside it is `429 too_many_attempts` with `Retry-After` |

A client counts down from `cooldownSeconds` or `Retry-After` and never from a number of its
own.

The same `GET` (and a sign-up's `GET /api/auth/register/resend?registration=…`) also
answers `codeState`: `live`, `expired` or `exhausted`, checked in the order a try checks
them, so "Check your email" opens on the right banner without spending a try. No live code,
or a verified address, reads as `live`. A taken address's sign-up reads exactly as a new
one's.

**A code is always a JSON string.** A number (which would lose a leading zero), an array,
`null` or a missing field is a `422 validation_failed` against that field, in the words its
screen uses ("Enter the 6-digit code from the email.", "…from the text.", "…from your app.",
"Enter one of your recovery codes."), and costs no attempt. `App\Http\CodeField` reads every
code this way: email, phone, sign-up, two-factor and the reset's code step.

At most one code is live per address, by a partial unique index on unrevoked challenges, and
resends and tries for one address take its row lock, so requests sent at once are answered
in turn: one resend sends a code and the rest get its cooldown, and the fifth wrong try is
the fifth however many arrive together.

## Verifying a phone

`PUT /api/auth/phone` sets the primary phone from a country and a number typed any way;
it is stored in E.164 with the country beside it, and a new number is texted a code at
once. `POST /api/auth/verify/phone` takes the code, and `GET`/`POST
/api/auth/verify/phone/resend` read and spend the cooldown. **The limits are the email
table's, from the same code** (`ContactVerifier`, `VerificationCodeResender`,
`ResendCooldown`), not a second set.

- A number already verified on another account is `409 phone_taken`, and the current
  number is untouched. One that another account never verified is released to whoever
  sets it.
- A changed number waits beside the primary as a `pending` row and is texted the code; the
  primary, verified or not, is untouched until that code is entered, and only then goes.
  Verification, resend and the cooldown act on the pending number while there is one. A
  second change replaces the pending row, and going back to the primary drops it. A number
  already verified as one of the account's alternatives is promoted at once. The same
  number again changes nothing and sends nothing.
- A number refused for its shape is `422` against `number`, naming the country: required,
  too short, too long, or not a number there.

The details screen (`PATCH /api/auth/complete-profile`) takes the same number as
optional `phoneCountryCode` and `phoneNumber`, under the same rules. An empty number means
no phone and removes the primary one. Its shape refusals are against `phoneNumber`,
alongside the screen's other fields, and nothing is saved or texted until all of them pass.

## Getting back in without the second factor

For a person who has lost both the authenticator and the recovery codes (sc-509). Every
step is `POST` with a JSON body, so neither the sign-in challenge nor the request's handle
is ever in a URL.

- `…/two-factor/recovery/opening` and `…/two-factor/recovery` take the sign-in's
  `challenge`, so only a first factor that passed can ask. The first sends nothing and
  says whether anybody can answer (`nobody`, with `supportAddress`). It also hands back an
  open request under a new handle. The second starts a request, ending any earlier one,
  and sends a code to the verified primary address and one to the verified primary phone
  if there is one. Nobody to answer is `409 recovery_nobody_to_approve`, before anything
  is sent. An account with no verified primary address gets the same
  refusal on purpose: with no address to prove, it ends at support as well, and the onboarding
  gate means a two-factor account always has one.
- `…/recovery/state`, `/resend`, `/text-instead`, `/prove` and `/cancel` take the request's
  `recovery` handle. The codes keep the email table's limits, one cooldown for the pair,
  and the phone code goes as Verify phone's does (WhatsApp first, sc-750). `/prove` needs
  both codes: a wrong one is `verification_code_invalid` with a violation on `emailCode`
  or `phoneCode`, and neither is spent until both match.
- A proved request ends at **the moment it was proved + 7 × 24 h**. It reads as `expired`
  from that instant on, whether or not `app:two-factor-recovery:expire` has run yet.
  `asked` and `expires` are written for the reader by `UserMailer::deadline`, the one
  format the emails use too: "Saturday, Oct 24 at 14:20 WAT", or "13:20 UTC" with no zone.
- `GET /api/auth/recovery-requests` lists what the signed-in person may answer: requests
  from members of an organisation they own (and admin, once sc-66 seeds it), their own
  included as `own`. `…/{id}/approve` and `…/{id}/turn-down` answer it. One answer closes
  it, and any later one is `409 recovery_request_closed`. Your own request is `403`.
- Approval turns two-factor off, spends every recovery code, ends every session, and sets
  `twoFactorSetupPrompt` on the account until two-factor is on again or
  `DELETE /api/auth/two-factor/setup-prompt` declines it.
- `…/recovery/not-me` takes the `request` and `token` from any email's "This wasn't me"
  link. It cancels every open request and ends every session. The `/cancel` on the waiting
  screen does the same.

## Authentication

A bearer access token on every request, renewed from a refresh token the client keeps.
Where each of those lives differs between the browser and a native client, and that is the
one decision here that cannot be changed quietly later — see
[sessions.md](sessions.md), which also covers who may call this API from a browser.

**An access token can be refused before it expires.** When its session ends, by signing out
from it or from another device, a password change or reset, or a replayed refresh token,
the next request carrying it is `401 unauthenticated`, the same response an expired token
gets, because a client can do only one thing about either: refresh, and sign in again if
that fails. The list of ended sessions fails open, so during a Redis outage an ended session
works until its token expires, at most fifteen minutes (sessions.md, sc-117).

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
