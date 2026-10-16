# How a session is held

A session is two tokens. The **access token** is a JWT, good for fifteen minutes, and
every request carries it. The **refresh token** is a random 256-bit value stored as a
SHA-256 hash, good for thirty days, rotated on every use, and a replay of a used one
revokes the whole chain it belongs to.

Where the client **keeps** those two is the decision this page records, because it is the
one that cannot be changed quietly later.

## The decision

**The access token lives in memory. The refresh token is carried in a cookie the page
cannot read, set by the API itself.**

This is the "token-mediating backend" of RFC 10017 (_OAuth 2.0 for Browser-Based
Applications_, BCP 212), with the Symfony API as the mediator rather than a separate
service. The RFC presents three architectures in decreasing order of security — a
backend-for-frontend, a token-mediating backend, and a browser-based client holding
everything — and this is the middle one.

A client says which it wants, per request:

```json
{ "email": "ada@example.com", "password": "…", "refreshTokenIn": "cookie" }
```

| `refreshTokenIn` | Who asks for it | What comes back                                                                                                                                                     |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cookie`         | `apps/web`      | `accessToken` in the body. The refresh token is a `Secure`, `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`, and **does not appear in the body at all**. |
| `body` (default) | `apps/mobile`   | `accessToken` and `refreshToken` in the body. No cookie is set.                                                                                                     |

`POST /api/auth/register`, `/login`, `/refresh` and `/logout` all take the field.
`IssuedTokensResponse` is the one place that acts on it.

## Why not a backend-for-frontend

A BFF is the RFC's first recommendation and it is the right call for a product that can
afford another deployable. This one cannot yet, and the gap between the two is narrow
while the cost is not:

- **It would be a new service to build, deploy, monitor and keep in step.** Every route
  the API gains, the BFF has to proxy, and a routing table in two places drifts.
- **The API is already the natural mediator.** Setting a cookie in Symfony is a few lines
  in a class that already exists. A BFF adds a hop in front of every request.
- **`packages/api-client` stays one thing.** Both clients call the API directly and only
  the credential differs. With a BFF the web client talks to something else entirely and
  that package stops being shared.
- **It is reversible upward.** A BFF would set the same cookie, so this is most of the
  groundwork rather than a detour.

## Why not localStorage

Because `HttpOnly` is the only thing that survives a cross-site script. A token in
`localStorage` can be read and sent elsewhere, and it stays valid for its full lifetime
wherever it lands — for the refresh token, thirty days of someone else's sessions.

It is worth being precise about the ceiling, though. **`HttpOnly` stops exfiltration, not
abuse.** A script running in the page can still call the API as the signed-in person for
as long as the page is open; what it cannot do is take the session away with it. That is
a real difference and a smaller one than it sounds, which is why the content security
policy below matters more than this choice does.

## The hostnames this depends on

**The web app and the API share a registrable domain, in every environment. That is
decided rather than assumed** — `soirely.com` and `api.soirely.com`, and whatever the
equivalent pair is wherever else this runs.

`SameSite=Strict` is what makes it matter. The cookie is sent only to the same _site_ as
the page, and a site is the scheme plus the registrable domain: `soirely.com` and
`api.soirely.com` are one, `soirely.com` and `soirely-api.com` are two. The second
arrangement would force `SameSite=None`, which discards the cross-site request forgery
protection the attribute exists for.

`requireSameSiteApi` in `apps/web/src/sameSite.ts` refuses to start the application when
the configured `apiBaseUrl` breaks the rule, and says so on the page. The failure is
otherwise quiet in the worst way: sign-in works, the next fifteen minutes work, and then
every refresh fails with nothing connecting it to the hostname somebody typed. The check
is schemeful too, because browsers are — an `https` API served to an `http` page is
cross-site however well the hostnames match — and it allows a relative `apiBaseUrl`, which
is same-origin by construction.

If the API ever has to live elsewhere, two answers are better than relaxing the cookie:
serve it through the web container's nginx at `/api`, which makes it same-origin and makes
the question disappear, or move to a full BFF.

## Cross-site request forgery

Three things answer it, and the first two are the ones that matter:

1. **`SameSite=Strict`.** The cookie is not sent on a cross-site request at all, so a
   forged one arrives with nothing to spend.
2. **The request must be JSON with no unknown fields.** `Input::body` parses the raw body
   as JSON and `Psl\Type\shape` rejects unknown keys, and an HTML form cannot be made to
   produce that — a `text/plain` form always appends `=` somewhere, and absorbing it needs
   a field the shape refuses. `RefreshTokenCookieTest` holds a test for this with the
   cookie present, asserting the forged request is refused **and that the token survives
   unspent**.
3. **The cookie is scoped to `/api/auth`**, so it is not attached to anything else, and
   the client only sends `credentials: 'include'` on refresh and sign-out.

## Who may call the API from a browser

`config/packages/nelmio_cors.yaml`, with `allow_credentials: true` because a cross-origin
request sends no cookie without it. Origins are **exact strings**, never a regex: with
credentials allowed, an unanchored pattern is the one mistake worth putting out of reach,
because `^https://soirely\.com$` missing its `$` also matches
`https://soirely.com.example.net`. `CrossOriginTest` tries that string and three other
near misses.

`Retry-After` and `Link` are in `expose_headers`. A header a browser cannot read is a
header the client does not have, and `Retry-After` is the entire content of "try again at
14:32" on a rate-limited sign-in.

## The content security policy

A policy is worth more than the storage choice above, because an active cross-site script
defeats every storage option and a policy is what stops the script running.

`apps/web/nginx.conf` includes `/etc/nginx/soirely-security-headers.conf`, which the
container's entrypoint writes at start-up. It is generated rather than committed because
`connect-src` has to name the API and Mercure origins and those differ per deployment;
nginx refuses to start if the file is missing, which is the right direction for that to
fail in. The snippet is included in **every** `location` as well as the server block,
because a location that adds a header of its own discards everything inherited.

Two things to know before changing it:

- **`style-src` has no `'unsafe-inline'`**, and that directive governs inline `style`
  attributes as well as `<style>` elements. A `style={{…}}` prop renders nothing in a
  deployed build while working perfectly in `vite dev`, where no policy is served. The
  `react/forbid-dom-props` rule in `eslint.config.mjs` is what keeps that from being
  found in production instead of at commit time.
- **Google Fonts is the one third party the page loads** — the stylesheet from
  `fonts.googleapis.com`, the font files it names from `fonts.gstatic.com`. Self-hosting
  Instrument Sans and JetBrains Mono would remove both sources and is the better end
  state.
- Images are `'self' data:` only. The first avatar served from object storage will be
  blocked, loudly, with the origin named in the console — add it to `img-src` then.

`Strict-Transport-Security` is deliberately absent. TLS terminates upstream, so it belongs
on the terminator where its `max-age` sits beside the certificate it depends on.

## What a reload does

Nothing, from the person's point of view. The access token is gone, the cookie is not, so
the first request after a reload goes out unauthenticated, comes back `401`, and
`ApiClient` renews from the cookie and retries it. One wasted request per page load and no
sign-in screen, which is the right way round.

## Lifetimes

Both are configuration in `services/api/.env`, in seconds:

| Variable            | Default   | What it bounds                                                          |
| ------------------- | --------- | ----------------------------------------------------------------------- |
| `JWT_TOKEN_TTL`     | `900`     | how long an ended session keeps working; see the next section           |
| `REFRESH_TOKEN_TTL` | `2592000` | how long a device may go unused before it has to sign in again, 30 days |

A refresh issues a new token with the full lifetime, so a device in use never expires.
Lowering `REFRESH_TOKEN_TTL` applies to tokens issued from then on; rows already stored
keep the expiry they were issued with.

## The sign-in limit

Two fixed windows of fifteen minutes, in `config/packages/rate_limiter.yaml`: **5 refused
passwords per address** and **30 per network address**. Only a refused password spends
either. A correct one spends nothing, so somebody signing in on several devices is never
locked out by it.

Past either, `POST /api/auth/login` answers `429 too_many_attempts` with `Retry-After`, and
does not check the password at all. The time is the window's end, so it does not move while
nobody is trying, and the right password at that time signs in. The clients round it up to
the minute they show and lift the lock themselves when it arrives.

The budgets live in Redis (`cache.rate_limiter`), so every API container counts against the
same one. In the test environment they are in memory; `cache.yaml` says why.

## Pruning spent sessions

`bin/console app:prune-refresh-tokens` deletes every `refresh_tokens` row whose `expires_at`
has passed, revoked or not, in batches of 1,000 (`RefreshTokenPruner::BATCH_SIZE`).
`--dry-run` counts them and deletes nothing. Two runs at once are safe: each batch skips
rows the other has locked.

It never deletes a row that is revoked but not expired. That row is how a replayed token is
told apart from an unknown one: delete it and a replay no longer revokes the chain, so the
thief keeps the newest token, and the response looks exactly the same.

**Nothing schedules it yet.** Where it runs (host cron, a scheduled container, or
Messenger's scheduler) is an open decision on sc-114.

## The access token's fifteen minutes

Ending a session cannot take effect sooner than the access token in hand expires, because
nothing consults a server to use one. `JWT_TOKEN_TTL=900` is that window and
`TokenLifetimeTest` holds it there. **sc-117** closes it to zero — the access token carries
its session id and a Redis set lists the sessions revoked in the last fifteen minutes, one
`SISMEMBER` per request — and until it lands, "sign out this device" is honest about
taking up to fifteen minutes. The wording for that is in sc-115 and sc-116.

## Where a native client keeps its half

`apps/mobile/src/tokens.ts`: the access token in memory, the refresh token in the
platform keystore through `expo-secure-store` — Keychain on iOS, Keystore-backed storage on
Android, written `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` so a session is not restored onto
another device from a backup. That is better than the browser's cookie rather than a
compromise with it: nothing else on the device can read it, and there is no cross-site
request forgery to answer for.

**The keystore is not everywhere.** `expo-secure-store` has no implementation on web, where
this app also runs through React Native Web, and a device can refuse the keystore. Both
fall back to memory for the launch, so the session ends when the app closes. The honest
outcome: the alternative is writing a thirty-day credential somewhere readable.

## Signing in with Google

`POST /api/auth/oauth/google` takes an ID token and the raw nonce, and answers as password
sign-in does. The client runs the provider's authorization-code flow with PKCE, sending the
provider the nonce's SHA-256 (hex) and keeping the nonce itself, which it gives the API.

- **The token is checked in full** (`OpenIdTokenVerifier`): RS256 only, the signature
  against the provider's published keys, the issuer, an audience that is one of our client
  ids, and the expiry, with a minute's leeway. Any failure is `401 oauth_token_invalid`.
- **The nonce binds the token to the client that asked for it.** A token whose `nonce`
  claim does not equal the hash of the nonce sent with it is refused, so a captured token
  replays nowhere. **A token with no `nonce` claim is accepted**, because a sandbox or a
  test may issue one; Google always includes it when the client asked.
- **Keys are cached for an hour and fetched again once** when a key id is unknown or a
  signature fails. The local sandbox rotates its key under the same id on restart, and a
  verifier that trusted its cache would refuse every token after that.
- **Who it is.** A `provider_identities` row (provider, `sub`) seen before signs that
  account in. Otherwise a **verified** address matching an account's **primary** address
  links to it, and only when that account verified the address itself; an account that
  never did is released, as registration releases it, so a password typed by somebody else
  cannot stay in. Otherwise a new account, with the address already verified and no
  password. A token whose address the provider did not verify is refused.

## What is not built yet

- **Signing in with Apple.** The button is drawn and does nothing until sc-59.
- **An organisation.** `apps/web/src/session.ts` reads the account from `GET /api/auth/me`
  and that part is real; the organisation and the permissions beside it are still a
  stand-in, marked as one, because epic 28 is where organisations get a record.
