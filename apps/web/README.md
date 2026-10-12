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
arrive with the scopes that own them. `src/session.ts` is a stand-in for
sign-in and is marked as one — Accounts & sign-in replaces its body and must
not change its shape, because the navigation and the permission guard are
written against it.
