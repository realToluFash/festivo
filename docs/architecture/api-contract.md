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
  On a `4xx` it is a catalogue sentence in the same language as the `title`, as is each
  violation's `message`: a refusal is thrown with a key from `translations/messages.*.json`
  and its slots (a violation carries its own as `parameters`, which are never sent), and
  `ProblemRenderer` words it for the request. A sentence that reaches a refusal fails
  `RefusalsAreKeyedTest`, which names its file and line, whether it is written there,
  formatted, held in a variable, a constant or a property, or passed down through a helper.
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
and a `detail` naming the minute it lifts ("Try again at 14:35 UTC."), rounded up. The
minute is UTC and says so, whoever asks and from wherever: a limit hit signed out has no
account to take a zone from, and the clients write their own time from `Retry-After`. The
sentence and the minute are one catalogue entry with a `{time}` slot, never two joined in
code; the slot carries the zone after the minute, where `time.dateAt` places one. A
client shows the time from `Retry-After`, in the reader's timezone, never a figure of its
own.

Where a budget is spent by a wrong secret (a password or a code), the wrong try that spends
the last of it is itself answered with the pause, not with that place's wrong-secret error,
so nobody spends one more try to learn the time. Every try after it, the right secret
included, gets the pause unchecked until the window ends. A right secret spends nothing.

A limit that can last past the day it was hit names the day as well as the minute, by
`UserMailer::deadline`'s words, in the language of the `detail`: the request's, else
English, never the account's saved one. The two-factor recovery's
(`POST /api/auth/two-factor/recovery`) names it in the account's zone ("Try again Sunday,
Oct 18 at 17:09 WAT.", or "UTC" with no zone), and the same words come as a `retryAt`
member, because **Get back in without your authenticator** quotes them. A client quotes
`retryAt` as it is, and falls back to `Retry-After` only when it is absent. Only the
recovery carries `retryAt`. Any other such limit names it in UTC ("Try again Monday 26 Oct
at 16:32 UTC."), in its `detail` only (sc-12379): no screen quotes it, and whoever reads a
raw `detail` reads it from anywhere. `Retry-After` stays in seconds either way (RFC 9110
§10.2.3).

| Endpoint                                            | Budget                                                                        | Spent by                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| `POST /api/auth/register`                           | 10 per IP per hour, fixed window                                              | every attempt            |
| `POST /api/auth/login`                              | 5 per address and 30 per IP per 15 minutes, fixed windows                     | a refused password       |
| `PATCH /api/auth/password`, `POST /api/auth/proof`  | 5 per account per 15 minutes, fixed window, one budget for both               | a wrong current password |
| `POST /api/auth/password/set/code`                  | 5 per account per 15 minutes, fixed window, across resends                    | a wrong code             |
| Two-factor codes, wherever asked                    | 5 per account per 15 minutes, fixed window                                    | a wrong code             |
| `POST /api/auth/verify/resend`                      | one per 60 seconds per address                                                | every code sent          |
| `POST /api/auth/two-factor/recovery`                | 3 per account per 24 hours, rolling                                           | every request started    |
| `POST /api/auth/sessions/others`                    | 5 per account per 15 minutes, fixed window                                    | every proved call        |
| `POST /api/auth/emails`, `/phones`                  | 10 per account per hour, fixed window, shared                                 | every add asked for      |
| `POST /api/orgs`                                    | 5 per account per hour, fixed window                                          | every organisation made  |
| `POST /api/request-links/ask`                       | 5 per account and 100 per organisation per 24 hours, fixed windows            | every request made       |
| `GET /api/addresses/suggest`, `/api/addresses/{id}` | 60 per IP at once, refilled at 30 a minute, token bucket, one budget for both | every request            |
| `POST /api/assistant/chat`                          | 20 per IP at once, refilled at 10 a minute, token bucket                      | every request            |

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

## Alternative addresses and numbers

From Settings > Account (sc-113). **A primary identifies; an alternative only reaches.**
Only the primary address signs anybody in (`findOneByPrimaryEmailAddress()`), and a phone
never does: the primary phone is the one on the profile and the one texted.

- `POST /api/auth/emails` (`address`) and `POST /api/auth/phones` (`countryCode`,
  `number`) link one unverified and not primary, normalised as registration and
  `PUT /api/auth/phone` normalise, and send its code. `201` with the row.
- **Two of each per account, primary included** (`LinkedContacts::MOST`), held by the
  service under the account's row lock: a third is `409 address_limit_reached`, the
  detail naming the limit. A pending replacement number is not counted.
- **One answer for a held address**, this account's or another's: `409 already_linked`,
  the same bytes either way, so the endpoint is no oracle for who has an account.
- `PATCH …/emails/{id}/primary` and `…/phones/{id}/primary` move the flag in one
  transaction, reading the current primary under the account's row lock. An unverified row
  is `409 address_not_verified`.
- The email route also takes `proof` from `POST /api/auth/proof`, because it changes the
  address that signs in and recovers the account. Without a live one it is
  `403 proof_required`, before the id is looked at. The phone route takes none.
- `DELETE …/emails/{id}` and `…/phones/{id}`: the primary is `409 primary_address`, the
  only verified row is `409 last_verified_address`. `204` otherwise.
- An id that is not this account's, or not an id, is `404 not_found`, never `403`.
- The verify endpoints take the row by id: `address` on `POST /api/auth/verify/email`
  and `/verify/resend` (`?address=` on its `GET`), `phone` on `/verify/phone`, its resend
  and `/text-instead` (`?phone=` on the `GET`). Without one, they act on the primary
  address, or the number awaiting its code, as before.
- Every add, promotion and removal is audited (`email.added`, `email.primary`,
  `email.removed`, and the same for `phone.`), with the value before and after.

## Getting back in without the second factor

For a person who has lost both the authenticator and the recovery codes (sc-509). Every
step is `POST` with a JSON body, so neither the sign-in challenge nor the request's handle
is ever in a URL.

- `…/two-factor/recovery/opening` and `…/two-factor/recovery` take the sign-in's
  `challenge`, so only a first factor that passed can ask. The first sends nothing and
  says whether anybody can answer (`nobody`, with `supportAddress`). It also hands back an
  open request under a handle of this device's own: the request is the account's and the
  handle the device's (`two_factor_recovery_handles`), so another device's handle keeps
  working. The second starts a request, ending any earlier one as `replaced`,
  and sends a code to the verified primary address and one to the verified primary phone
  if there is one. Nobody to answer is `409 recovery_nobody_to_approve`, before anything
  is sent. An account with no verified primary address gets the same
  refusal on purpose: with no address to prove, it ends at support as well, and the onboarding
  gate means a two-factor account always has one.
- `…/recovery/state`, `/resend`, `/text-instead`, `/prove` and `/cancel` take the request's
  `recovery` handle. The codes keep the email table's limits, one cooldown for the pair,
  and the phone code goes as Verify phone's does (WhatsApp first, sc-750). `/prove` needs
  both codes: a wrong one is `verification_code_invalid` with a violation on `emailCode`
  or `phoneCode`, and neither is spent until both match. Once the request is proved,
  `/prove`, `/resend` and `/text-instead` are `409 recovery_request_proved`: it is waiting
  for an answer, so a client opens its waiting screen. `409 recovery_request_closed` is
  only for one that has ended (approved, turned down, expired or cancelled). Every step
  from the handle of a request a newer one replaced is `409 recovery_request_replaced`
  ("A newer request was started on another device. Start again to ask from here."). All
  three carry `requestStatus`.
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

## Creating another organisation

`POST /api/orgs` (sc-390), for any account through the onboarding gate, takes `name`,
`countryCode` and the device's `timezone`, and founds the organisation as sign-up does: the
caller is its Owner, with the seeded roles, the currency follows the country and the
contact address is the caller's primary email. A timezone the API does not recognise, or
none, gives `UTC`. A refusal names only `name` and `countryCode`, the fields the form
has. `201` answers `{organisation}`, the membership as `GET /api/orgs` lists it, and the
entry `organisation.created` is audited on the new organisation.

## Roles and permissions

An organisation's roles (sc-66). Every organisation is created with five, in this order:
Owner, Administrator, Event manager, Coordinator and Read-only (`seededAs`). Their
permissions are defaults written once at creation, then the organisation's to change.

- `GET /api/orgs/{id}/permissions`, for any active member: the caller's effective
  permissions. `GET /api/orgs` carries the same list on each membership, so a client
  renders only the controls it can use.
- `GET /api/orgs/{id}/roles` (`members.read`): every role with `permissions`, `holders`,
  `fixed` (Owner) and `removable` (a custom role), and `areas`, the registry grouped as
  the grid draws it.
- `POST …/roles` (`members.manage`) makes a custom role from `name` and `permissions`;
  `PATCH …/roles/{roleId}` changes either; `DELETE …/roles/{roleId}` removes a custom one.
- Owner refuses an edit or a delete with `409 owner_role_fixed`. A seeded role can be
  edited but not renamed (`422` on `name`) or removed (`409 seeded_role_kept`).
- A role name is trimmed, required, at most 40 characters, and unique in the organisation
  ignoring case, the seeded labels included: a clash is a violation on `name` with code
  `role_name_taken`. An unknown permission is a violation on `permissions`.
- Deleting a role that people hold needs `replacement`, a role in the same organisation,
  or it is `422` on `replacement`; its holders move to it first.
- A caller grants, withdraws and moves people onto only what their own role holds: a
  permission they lack, added or removed, or a replacement holding one, is
  `403 grant_not_held`, and nothing changes.
- A role id from another organisation is `404`. Demoting the last active owner is
  `409 last_owner` (`RoleAssignment`).

## Answering a request to join

Somebody who asked through the request link or the company domain is a membership in
`pending_approval` (sc-392). Only a caller holding `members.manage` sees one: for anybody
else `GET /api/orgs/{id}/members` leaves them out entirely.

- Each pending member in that list carries `removesAt`: `at`, the moment it was asked
  - 30 × 24 h (`memberships.request_expires_at`), and `written`, that instant for the
    caller by `UserMailer::deadline` ("Wednesday, Nov 11 at 09:40 WAT", or UTC, labelled).
    Every other member has `removesAt: null`.
- `POST /api/orgs/{id}/members/{membershipId}/approve` (`members.manage`) takes `roleId`
  and answers `204`: the membership is `active` in that role, audited
  `membership.approved`. The role is held to `RoleManager::mayGrant`, so a role the caller
  could not grant is `403 grant_not_held`.
- `POST …/members/{membershipId}/turn-down` (`members.manage`) answers `204`: the
  membership ends `left_or_removed`, audited `membership.turned_down`, and the person is
  emailed in their language without being told who.
- A request already answered, or past its instant, is `409 join_request_answered` for
  either. A pending membership is not a member: `PATCH` and `DELETE` on
  `…/members/{membershipId}` are `404` for it.
- A request is removed at its instant whether or not `app:join-requests:run` (every
  minute) has run yet: the list and both answers remove any lapsed request in the
  organisation first, recorded as of the instant, with no actor, audited
  `membership.request_expired`, and the person is emailed. The same job emails everybody
  holding `members.manage` when requests arrive, at most once in any 24 hours per
  organisation (`organisations.join_requests_noticed_at`).

### Claiming an organisation with no active Owner (sc-6640)

- `GET /api/orgs/{id}/owner-claim` (`members.read`) answers `{ownerClaim}`: `null` unless
  the caller is an active Administrator and every Owner is `suspended`. Otherwise
  `{state, domain, claim, stopped, lapsed}`, `state` one of `no_owner`, `open` (record not
  found), `found` and `closed` (a claim was stopped: self-serve is over for good). `claim`
  carries `record` (`{type, name, value}`) for the claimant alone, and every instant as
  `{at, written}` in the caller's zone. `domain` is the one the caller's claim would be for:
  their verified primary address's, when the organisation lists it; otherwise the
  organisation's own (proved first), which the address refusal names.
- `POST /api/orgs/{id}/owner-claim` takes no body: the claim is for the domain of the caller's
  verified primary address. It answers `201` with the banner. Refused
  `409 owner_claim_address` (the caller's verified primary address is elsewhere),
  `owner_claim_managed` (another organisation proved it), `owner_claim_open`,
  `owner_claim_closed`, `owner_claim_unavailable` (an Owner is active), or `403` for anybody
  but an active Administrator.
- `POST …/owner-claim/check` looks the claimant's record up at once and answers the banner
  with `found`. `POST …/owner-claim/stop` is any signed-in account's route, allowed to an
  active Administrator or a suspended Owner (who reads the claim as `paused[].ownerClaim` on
  `GET /api/orgs`), never to the claimant (`409 owner_claim_own`); `409 owner_claim_ended`
  once it has ended. An account with no membership in the organisation gets `404 not_found`,
  as on every other `/api/orgs/{id}` route.
- `app:owner-claims:run` (every minute) passes a claim at `found + 72 h` if the record is
  still published there, lapses it at that instant if not, lapses an unfound one at
  `started + 7 × 24 h`, and looks an unfound record up hourly. The banner, Members and the
  check settle a due claim first. The record is asked of DNS over HTTPS at
  `DNS_TXT_ENDPOINT` (smocker in the local stack).

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
