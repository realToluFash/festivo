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

## Recovering a password

`POST /api/auth/password/forgot` always answers `202 {}`, so it cannot be used to find out
who has an account: a password account is emailed a link, an account with no password is
told how it signs in, and an unknown address is sent nothing. The answer is also the same
in time: the lookup and the email happen on `kernel.terminate`, after the response has
gone (`AfterResponse`, the one home for work the client must not wait for), so a
registered address is no slower to answer. Under
FrankenPHP that needs `FinishResponseListener`, which ends the response first: Symfony
only does so itself for FastCGI and LiteSpeed. It is limited per
address (keyed on what was typed) and per IP, and a refusal states a time.

- **The link** carries 32 random bytes, kept only as their SHA-256, and works once for
  `PasswordResetToken::LIFETIME_MINUTES` (10), shorter than a verification code's 15.
  `POST /api/auth/password/reset/check` says whose link it is, or `reset_link_invalid`
  (404), `reset_link_used` or `reset_link_expired` (410), each with its own page.
- **The reset** (`POST /api/auth/password/reset`) takes registration's rules
  (`NewPasswordRules`), and a refused password changes nothing. A new one spends every
  link the account was sent, revokes every refresh token, signs this device in, and emails
  a notice saying when. Access tokens already issued run out on their own, within their
  lifetime, until sc-117 ends them at once.
- **Two-factor** (sc-60) will ask for the code before this device is signed in.

## Registering

A password sign-up does not sign in, and does not make the account. `POST /api/auth/register`
answers `202 {registration, email}` for every address, new or held by an account, with the
same shape and in the same time: the password is hashed either way, and every email goes
after the response (`RegistrationMail`, through `AfterResponse`). The handle lasts 24 hours and works once.

- **New address:** the code goes to it. `POST /api/auth/register/verify` with the handle and
  the code makes the account, its address verified, and signs it in. An unverified holder of
  the address is released then, as before. Wrong, exhausted and expired codes follow sc-56.
- **Taken address:** a code is made and never sent, so every guess reads as wrong, and the
  address is emailed "You already have a Soirely account" instead, at most once an hour.
- Resend (`/api/auth/register/resend`) keeps sc-56's 60-second cooldown. Until the code is
  entered nothing exists to sign in to, so sign-in answers `invalid_credentials`.
  `app:prune-pending-registrations` deletes expired attempts.

Google and Apple sign-up are unchanged: the provider vouches for the address.

## Signing in with Google

`POST /api/auth/oauth/google` answers as password sign-in does. Both clients run the
provider's authorization-code flow with PKCE, sending the provider the nonce's SHA-256 (hex)
and keeping the nonce itself, which they give the API. What they send differs:

- **The app** redeems its own code, as a native client may without a secret, and sends the
  ID token with the raw nonce.
- **The web** sends the code, its PKCE verifier and the redirect URI with the raw nonce, and
  the API redeems the code with the client secret (`HttpCodeRedeemer`). A browser is a
  public client and cannot keep a secret (RFC 6749 §2.1); PKCE binds the code to the
  browser that asked (RFC 7636). The ID token that comes back takes the same checks.
- **Production values:** `OAUTH_GOOGLE_ISSUERS` is `https://accounts.google.com,accounts.google.com`,
  `OAUTH_GOOGLE_JWKS_URI` is `https://www.googleapis.com/oauth2/v3/certs`,
  `OAUTH_GOOGLE_TOKEN_URI` is `https://oauth2.googleapis.com/token`, and the client ids and
  the web client's secret come from the owner's Google Cloud project.

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

## Signing in with Apple

`POST /api/auth/oauth/apple` is the Google endpoint with Apple's issuer, keys and client ids:
the same checks, nonce binding and account paths. What differs is what Apple sends.

- **The name comes once.** Apple puts no name in its ID token and hands the client one only
  on the very first authorisation, so the client sends it as `name`. It fills a blank name
  and never overwrites a stored one, so a later sign-in without it changes nothing.
- **On web Apple answers with `form_post`** whenever the name or email is asked for, which a
  page cannot receive. It posts to `POST /api/auth/oauth/apple/return`, which sends the
  browser on, with a 303, to the web's `/oauth/apple` carrying `code`, `state` and `user`.
  The target is the configured web origin, never one read from the request. The web then
  hands the code to the API, as for Google.
- **On iOS the native sheet** gives an ID token signed by the real Apple, so development
  trusts Apple's issuer and keys and Expo Go's bundle id beside the sandbox's.
- **Revoking and coming back** keeps Apple's `sub`, so it is the same account, not a second.
  A private-relay address is an address like any other.
- **Production values:** `OAUTH_APPLE_ISSUERS` is `https://appleid.apple.com`,
  `OAUTH_APPLE_JWKS_URIS` is `https://appleid.apple.com/auth/keys`, `OAUTH_APPLE_TOKEN_URI`
  is `https://appleid.apple.com/auth/token`, and the client ids are the Services ID (web) and
  the bundle id (iOS). Apple's client secret is not a fixed string but a JWT signed with the
  team's Sign in with Apple key, which expires within six months and has to be issued again.

- **Android.** Apple will not redirect to an app's custom scheme, and returns the name only
  by `form_post`, so on Android the app starts an attempt with the API first
  (`POST /api/auth/oauth/apple/attempts`, its state and PKCE challenge), then opens Apple in
  Custom Tabs. Apple posts to `/api/auth/oauth/apple/return`, which recognises the app's
  state, keeps Apple's code, and 303s to the verified App Link `OAUTH_APPLE_APP_LINK` with a
  one-time handle (60 seconds, `AppleAppAttempt::HANDLE_SECONDS`). The app trades the handle
  and its PKCE verifier at `POST /api/auth/oauth/apple/handle`, and the API redeems the code
  as it does the web's. Neither the code nor tokens travel in the App Link URL. A state the
  API never saw is the web's, as before.

## Two-factor authentication

An account with two-factor on is never issued tokens by its first factor alone.
`SignInGate` stands where password sign-in, Google and Apple sign-in let an existing
account in, and with a factor active it answers `202` with a `twoFactorChallenge` (a
single-use token kept as its SHA-256, for `TwoFactorChallenge::LIFETIME_MINUTES`, 5)
and nothing about the account. `POST /api/auth/two-factor/verify` takes the challenge
with a `code` or a `recoveryCode` and only then issues tokens.

- **Codes** are RFC 6238: six digits, thirty-second steps, SHA-1, a 160-bit secret.
  A code is accepted **one step either side of now** (`AuthenticatorCodes::DRIFT_STEPS`),
  so a clock up to thirty seconds out still works. The step a code was accepted for is
  kept, and a code for that step or an earlier one is refused as a wrong code, so a
  code cannot be replayed inside its own window.
- **The secret is encrypted at rest** with libsodium's secretbox, keyed by
  `TWO_FACTOR_KEY` (32 bytes, base64). It has to be readable to check a code, so it
  cannot be hashed. The value in `.env` is for development; production sets its own, and
  changing it strands every enrolled factor.
- **Attempts** share one budget per account across sign-in, setup and turning it off:
  five wrong codes in a fixed **fifteen-minute** window (`two_factor_account`) pause
  code entry until the window ends, and the refusal is `too_many_attempts` with the time.
  Each check holds a row lock on the factor from the peek to the charge, so parallel
  requests queue rather than all passing the peek, and a replay sees the newest step.
- **A password reset** asks for the code before anything changes: with two-factor on,
  `reset/check` says so, `POST /api/auth/password/reset/code` takes an app code or a
  recovery code for that link (sharing the attempt budget), and only then does
  `POST /api/auth/password/reset` set the password, end every session and sign this device
  in. Until the code passes, the old password and every session stand.
- **Setup** stays off until a code from the new secret matches, so a misconfigured app
  cannot lock anybody out. Activating returns ten recovery codes, shown once. Each is
  forty bits, so it is kept as a salted slow hash (the password hasher), as NIST SP 800-63B
  5.1.2.2 asks of look-up secrets under 112 bits. Making new codes takes the current factor
  and deletes every old one, so an old code is refused exactly as a wrong one is. Turning it off takes an app code or an unused recovery code, and emails
  the address.

## What is not built yet

- **Signing in with Apple.** The button is drawn and does nothing until sc-59.
- **An organisation.** `apps/web/src/session.ts` reads the account from `GET /api/auth/me`
  and that part is real; the organisation and the permissions beside it are still a
  stand-in, marked as one, because epic 28 is where organisations get a record.
