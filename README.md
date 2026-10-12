# Soirely

Event management for the people running the event — the organiser planning it, and the
staff working the floor on the night.

This is a clean restart. The previous implementation (a Go API with four satellite repos)
is preserved at `festivo-backup-pre-symfony-2026-10-11` and is not the base for anything
here; it is reference only. Every line in this repository arrives through a pull request
attached to a Shortcut epic.

## Layout

| path               | what lives there                                                      |
| ------------------ | --------------------------------------------------------------------- |
| `apps/mobile`      | React Native (Expo) — the night: service floor, arrivals, run of show |
| `apps/web`         | Vite + React — **the product**, plus marketing and guest pages        |
| `services/api`     | Symfony — the API, with Mercure for live updates                      |
| `services/support` | Support and QA agent console                                          |
| `infra`            | Docker Compose, deploy, local provider mocks                          |
| `packages`         | shared across both clients: API types and domain rules                |
| `docs`             | Specs and design references                                           |

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
| `storage`  | 4566      | S3, locally (LocalStack)                         |
| `api`      | 8080      | the Symfony API                                  |

Every service has a healthcheck, and `docker compose ps` reports it. Dependents wait on
_healthy_ rather than on _started_ — "it started" and "it can answer" are different facts.

**Stopping:** `docker compose down` keeps your data. `docker compose down -v` destroys the
volumes, which is how you get a clean database — and it is the only time the scripts in
`infra/postgres/init` run again.

**Mercure uses two different keys**, one to publish and one to subscribe. One shared key
would let any subscriber publish, which here would mean a guest's browser could forge a
service-floor update. The API gets the publisher key; clients get the subscriber key.

### The API

Symfony 7.4 LTS on PHP 8.4, served by FrankenPHP — one container rather than nginx plus
php-fpm. **LTS deliberately:** security fixes run to 2029, and a product being built over
months should not be chasing a new framework minor every few weeks.

```bash
curl -s localhost:8080/api/health
```

It reports each dependency as `ok` or `error`, checked by a real round trip rather than by
configuration being present, and answers `503` when anything is down. Stop Redis and ask
again — it names which one and why.

**You do not need PHP installed.** Everything runs in the container:

```bash
npm test                 # the API suite
npm run lint:php         # check
npm run format:php       # fix
```

### Files

Uploads go **straight from the client to the store** on a signed URL — bytes never pass
through the API. A fifteen-megabyte guest list uploaded through PHP would occupy a worker
for the length of somebody's hotel wifi.

LocalStack rather than MinIO: MinIO's images are no longer pullable from Docker Hub, and an
unavailable base image is a stack that cannot be brought up on a new machine.

Two buckets. `soirely-public` is readable by anybody — an invitation page is opened by a
guest with no account. `soirely-private` is not, and holds guest imports and support
attachments.

> **Local storage is more permissive than production.** LocalStack does not enforce a
> public access block, so an anonymous read of a private object succeeds here and would be
> denied by real S3. The block is configured in `compose.yaml` and is what protects
> production — but do not use this stack to check whether something is private.

Re-run the bucket setup after changing it:

```bash
docker compose up storage-init
```

### Addresses

`GET /api/addresses/suggest?q=` and `GET /api/addresses/{id}`, proxied through the API so a
provider key never reaches a browser or a phone — and so rate limiting and caching live on
one side of that boundary rather than in two client implementations.

OpenStreetMap's Nominatim is the first adapter because it needs no key, so the whole path
develops and tests without an account. A commercial provider is another class behind the
same interface and one line of configuration.

Queries shorter than three characters are answered without asking anybody; identical
queries are cached. Autocomplete fires on keystrokes, and every call is billable somewhere.

A provider outage returns `503` with a specific type, distinct from `404`. Autocomplete
being down is never a reason to stop somebody saving a venue they typed out themselves.

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

## Checks on a pull request

Every pull request to `main` is checked, **scoped to what it touched**. A monorepo that
runs the whole estate on a one-line web change wastes minutes on every review and teaches
people to stop reading the result.

| Status          | Runs when                            | What it does                                                                                                   |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Lint and format | always                               | `eslint`, `prettier --check` — cheap, and repository-wide by nature                                            |
| API             | `services/api/**`                    | Brings up Postgres and Redis, builds the image, migrates a throwaway database, runs PHPUnit and `php-cs-fixer` |
| Web             | `apps/web/**`, `packages/**`         | typecheck, tests, production build                                                                             |
| Mobile          | `apps/mobile/**`, `packages/**`      | typecheck, tests, web bundle                                                                                   |
| Packages        | `packages/**`                        | typecheck and tests for the shared packages                                                                    |
| Localisation    | any catalogue, or any client surface | The parity guards and the untranslated-literal scan                                                            |

A change to **shared root configuration** — `package.json`, the lockfile, the eslint or
prettier config, `compose.yaml`, `locales.json`, `scripts/`, the workflow itself — runs
everything, because it changes the meaning of every other job. The lockfile is in that
list deliberately: a resolution change can break a surface whose own files are untouched.

Each surface is a separately named status, so a failure says which one failed without
anybody opening a log.

One more status, **All checks**, always runs and fails if anything that ran did not pass.
It exists because of a trap: a job skipped by its `if` reports as _skipped_, GitHub treats
a skipped required check as **pending**, and requiring the per-surface statuses directly
would leave an API-only pull request waiting forever for a Web check that was correctly
never going to run. Branch protection requires this gate, not the surfaces.

**Draft pull requests ARE checked.** That is GitHub's default and it is kept on purpose:
"no checks appeared" otherwise gets diagnosed as a broken pipeline for an afternoon
before somebody thinks to look at the draft flag.

### Why the API job uses Docker rather than a PHP on the runner

It is about a minute slower than installing PHP directly, and it is what makes _the same
shape on every machine_ true rather than aspirational — CI runs the exact commands from
this README, against the exact image, with the same extensions. A green CI beside a red
laptop is worse than a slow CI.

### Wall clock

A single-surface pull request is one filter job plus one surface job plus lint. The
Node surfaces install from a lockfile-keyed cache and should sit comfortably inside five
minutes; the API surface spends most of its time building the image, and is the one to
watch. The first runs on `main` establish the real baseline — the number is not guessed
here.

### What CI cannot do, and is not configured here

**Branch protection is a repository setting, not a file — and it is NOT configured,
because this plan cannot.** Both the branch-protection API and the newer rulesets API
answer `403 Upgrade to GitHub Pro or make this repository public` for a private repository
on the Free plan. So "a failing check blocks merge" and "`main` cannot be pushed to
directly" are currently **conventions, not guarantees**: the convention is in _How work
happens_ above, and nothing enforces it.

Two ways to make it real — GitHub Pro, or making the repository public. Either way the
command is ready, and `All checks` is the only context it needs:

```sh
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_status_checks[strict]=true \
  -F 'required_status_checks[contexts][]=All checks' \
  -F required_pull_request_reviews=null \
  -F enforce_admins=false \
  -F restrictions=null
```

Three deliberate choices in that. It requires **`All checks`** and nothing else, for the
skipped-is-pending reason above. It does **not** require a review, because a single-person
team requiring its own approval is a rule that gets bypassed rather than followed. And
`enforce_admins=false` keeps an owner override, so a mistake in the workflow itself can
never lock the repository against the person who has to fix it.

The mobile job bundles for web, which proves the module graph resolves. It does **not**
prove the app runs on a device, and nothing in CI does.

### Linting the CI itself

`npm run lint:actions` runs actionlint — which runs shellcheck over every `run:` block —
in Docker, like the PHP tooling, and it is in the pre-commit hook. A CI script is shell
that nobody reviews as carefully as the code it checks: the first draft of this workflow
had an `A && B || C` that is not if-then-else and would have written two different values
into the same output. actionlint caught it.

## Status

Foundation is complete: the toolchain, the compose stack, the API skeleton with its
response and error contracts, object storage, address lookup, the assistant transport, the
web and mobile skeletons, the localisation guards, and CI. Everything else follows it.
