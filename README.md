# Soirely

Event management for the people running the event — the organiser planning it, and the
staff working the floor on the night.

This is a clean restart. The previous implementation (a Go API with four satellite repos)
is preserved at `festivo-backup-pre-symfony-2026-10-11` and is not the base for anything
here; it is reference only. Every line in this repository arrives through a pull request
attached to a Shortcut epic.

## Layout

| path               | what lives there                                     |
| ------------------ | ---------------------------------------------------- |
| `apps/mobile`      | React Native (Expo) — organiser and staff app        |
| `apps/web`         | Vite + React — marketing site and guest-facing pages |
| `services/api`     | Symfony — the API, with Mercure for live updates     |
| `services/support` | Support and QA agent console                         |
| `infra`            | Docker Compose, deploy, local provider mocks         |
| `docs`             | Specs and design references                          |

One repository rather than five, because a scope of work does not respect a stack
boundary. Adding a field to the guest model touches Symfony, the mobile app and the web
guest page; as separate repos that is three pull requests that have to land in order, and
nothing to review them against each other. Here it is one.

## Running it locally

```bash
npm run setup          # node deps, PHP deps, git hooks, and .env from .env.example
docker compose up -d   # the stack
```

| Service    | Host port | What it is                                       |
| ---------- | --------- | ------------------------------------------------ |
| `postgres` | 5432      | the database                                     |
| `redis`    | 6379      | cache and queues                                 |
| `mercure`  | 3000      | the hub that carries live updates to clients     |
| `mailpit`  | 8025      | mail sink — every email the API sends lands here |
| `smocker`  | 8088      | SMS mock — UI; mock endpoint on 8086             |
| `oidc`     | 8089      | stands in for Google and Apple sign-in           |

Every service has a healthcheck, and `docker compose ps` reports it. Dependents wait on
_healthy_ rather than on _started_ — "it started" and "it can answer" are different facts.

**Stopping:** `docker compose down` keeps your data. `docker compose down -v` destroys the
volumes, which is how you get a clean database — and it is the only time the scripts in
`infra/postgres/init` run again.

**Mercure uses two different keys**, one to publish and one to subscribe. One shared key
would let any subscriber publish, which here would mean a guest's browser could forge a
service-floor update. The API gets the publisher key; clients get the subscriber key.

### Nothing reaches a real provider

Mail, SMS and sign-in all go to local containers. No provider credentials are needed to
develop or test any of it, and switching to a real provider is a change to `.env` only.

- **Mail** — <http://localhost:8025>
- **SMS** — <http://localhost:8088>, with captured requests under History
- **Sign-in** — discovery at `localhost:8089/{google,apple}/.well-known/openid-configuration`

Mint a token to test sign-in against:

```bash
curl -s -XPOST http://localhost:8089/google/token \
  -d grant_type=password -d username=x -d password=y \
  -d scope=openid+email+profile -d client_id=soirely-dev
```

Its claims come from `infra/oidc/oidc.json` — edit, then `docker compose restart oidc`.

The SMS mock returns a provider-shaped `201`. Sending to **+1 500 555 0000** returns a `400`
instead, so the failure path can be exercised deliberately. After editing
`infra/smocker/mocks.yml`:

```bash
docker compose up smocker-init
```

To work against a physical device, add its address to `MERCURE_CORS_ORIGINS` in `.env`.

## How work happens

1. **An epic is a scope of work**, not a stack. "Auth" is one epic covering the Symfony
   endpoints, the mobile screens and the web pages together.
2. **A story is a pull request.** Branch off `main`, open a PR, reference the Shortcut
   story so it moves itself through the workflow.
3. `main` is always deployable and is never committed to directly.

Shortcut workspace: https://app.shortcut.com/soirely

## Status

Nothing is built yet. The Foundation epic lands the toolchain, CI and the compose stack;
everything else follows it.
