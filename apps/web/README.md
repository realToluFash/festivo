# apps/web

Where the product is used. Planning an event is desk work — four hundred
guests, a seating plan, a menu, a budget — so this is built for a wide screen
and a keyboard. The mobile app is for the night.

It serves three audiences from one application, separated in the routing tree:

| Tree        | Who                                                       | Authentication                              |
| ----------- | --------------------------------------------------------- | ------------------------------------------- |
| `/`         | anybody, including people who have never heard of Soirely | none                                        |
| `/app`      | the signed-in product                                     | account, scoped to an organisation          |
| `/i/:token` | a guest with an invitation                                | none — and they will never install anything |

Separated structurally rather than by a flag, because a flag is something that
can be forgotten on a new route.

## Running it

```sh
npm install                            # from the repository root
npm run dev --workspace @soirely/web   # http://localhost:5173
npm run build --workspace @soirely/web # typecheck, then a production build
npm run test --workspace @soirely/web
npm run typecheck --workspace @soirely/web
```

`npm run dev` reads `public/config.json`, which points at `http://localhost:8080`
— the API from `docker compose up`.

## Configuration is read at boot, never baked

**The API URL is not in the bundle.** It is fetched from `/config.json` before
the first render, and the container writes that file from its environment at
start-up. So one built image works in every environment, and pointing it
somewhere else is a variable rather than a rebuild.

| Variable              | Required | What it is                                                         |
| --------------------- | -------- | ------------------------------------------------------------------ |
| `SOIRELY_API_URL`     | yes      | Where the API is **from the browser**, not from inside the network |
| `SOIRELY_MERCURE_URL` | no       | Where Mercure is, from the browser                                 |
| `SOIRELY_ENVIRONMENT` | no       | A name, so a support conversation can establish which deployment   |

A missing `SOIRELY_API_URL` stops the container. That is deliberate: a default
would be a browser quietly talking to the wrong host, which looks like an
outage and is far harder to find than a container that refused to start.

This is the one lesson carried forward most literally. The previous build took
the URL as a Vite build argument, so it ended up inside the JavaScript;
changing it in compose did nothing, with no error and no warning, and cost an
afternoon. `src/config.ts` says so at the top, and `configIsNotBaked.test.ts`
fails if an API URL is read through `import.meta.env` again.

## The session, and the headers it depends on

**The access token is held in memory. The refresh token is a cookie this page
cannot read**, set by the API — see `docs/architecture/sessions.md` for why
that and not `localStorage`. `src/tokens.ts` is the whole of the client's half.

**The API shares a domain with this app, in every environment**, because that
cookie is `SameSite=Strict` and a browser sends it nowhere else. A
`SOIRELY_API_URL` on an unrelated domain stops the application at boot with that
sentence on the page, rather than signing everybody out fifteen minutes later —
`src/sameSite.ts`.

The container also writes `/etc/nginx/soirely-security-headers.conf` at
start-up, which `nginx.conf` includes in the server block **and in every
location** — a location that adds a header of its own discards everything
inherited, so the cache rules would otherwise serve the bundle with no policy.
It is generated rather than committed because `connect-src` has to name the API
and Mercure origins. nginx refuses to start if it is missing.

**`npm run dev` serves no policy at all**, because there is no nginx in front of
Vite. So anything the policy forbids works locally and fails in a deployed
build, and two of those are worth knowing:

- **An inline `style` prop renders nothing**, because `style-src` has no
  `'unsafe-inline'` and that directive governs style attributes too. The
  `react/forbid-dom-props` rule fails the commit instead.
- **A new third-party host is blocked** — a font, an image origin, an analytics
  endpoint. The console names the directive; add the origin to the entrypoint.

## Localisation

`en`, `es`, `fr`, `pt`. The supported set comes from `/locales.json` at the
repository root — the same file the API reads — so it is declared once.

Resolution is the stored override, then the browser, then English. The switcher
is on the public pages too: somebody who cannot read the marketing copy cannot
sign up, so putting it behind the sign-in is a language barrier in front of the
one page that has to work for everybody.

See `docs/architecture/localisation.md` for the rules the catalogues are held
to.

## What is deliberately not here

Every domain feature. This is the shell; guests, seating, menus and the rest
arrive with the scopes that own them.

`src/session.ts` is **half real**. Who is signed in comes from `GET
/api/auth/me`, asked once per page load from the gate in `AppLayout` — and
because the access token lives in memory, that first request after a reload is
the one the refresh cookie pays for. The organisation beside it is still a
stand-in and says so in the file: it is named after the business the person
registered, there is exactly one, and the permissions are the pair the shell
was built against. Organisations get a record in epic 28.
