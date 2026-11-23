# The deploy path

What every deployed environment runs, sets and alerts on (sc-1612). Ops owns it
(`soirely-ops`); a deploy happens only when the owner asks for it, and only from
merged `main`.

Nothing runs on this path yet: `demo.soirely.com` still runs the old Festivo stack,
and moving it here is a switch-over the owner schedules.

## The server

| Fact                  | Value                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| Environments          | _none yet: one row per environment as each is created_                              |
| Checkout              | a full clone of the repository (not shallow), owned by the deploying user           |
| Docker                | Engine with the compose plugin, v2.24 or later (`--wait`, `env_file` interpolation) |
| Open ports            | 80 and 443 (TCP), 443 (UDP, HTTP/3). Nothing else is published                      |
| `deploy/.env`         | filled from `deploy/env.example`, mode 600, never committed                         |
| `deploy/secrets/jwt/` | `private.pem` and `public.pem`, readable by uid 1000, never committed               |

## Deploying

```sh
deploy/deploy.sh <sha>
```

1. Refuses a commit that is not on `origin/main`, then checks it out.
2. Runs `deploy/preflight.sh`, which prints one line per check below and stops the
   deploy on any `FAIL`. It changes nothing, so it can be run alone at any time.
3. Builds the API and web images from that commit, tagged with it.
4. **Runs the migrations against the new image while the old API still serves**, so the
   new code never serves a schema it does not know. A failed migration stops the deploy
   with the old containers still running.
5. Replaces the containers and waits until every health check passes.

## Runs

| Container                      | What it runs                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proxy`                        | Caddy: TLS for `APP_HOST` and `API_HOST`, certificates from Let's Encrypt                                                                                   |
| `api`                          | the API's prod image                                                                                                                                        |
| `notification-worker`          | `app:notifications:work`, the notification pipeline (sc-104)                                                                                                |
| `scheduler`                    | every line of `services/api/config/crontab` through supercronic, the checks below among them, and `app:two-factor-recovery:expire` every 5 minutes (sc-509) |
| `web`                          | the web client's image                                                                                                                                      |
| `postgres`, `redis`, `mercure` | the stores and the realtime hub, on the internal network only                                                                                               |

**Timeouts at the proxy.** `/api/assistant/*` may take 200 s before the API answers:
seating and floor plan take up to 180 s with the fallback (sc-3987). Every other API
route is given 60 s. The realtime hub has none, as it streams.

**Client addresses.** The API believes `X-Forwarded-For` from the proxy's fixed address
(`172.30.0.2`) only, so it sees the caller's own address. The mail webhook's allowed
ranges are checked against it; a proxy in front of this one (a CDN, a load balancer)
would make every webhook a 401 until its address is trusted too.

## Sets

Every value is generated fresh for each environment. The repository is public, and its
history includes the old `services/api/.env*` files, so no value from it is ever used on
a server: the pre-flight searches the history for each secret and refuses one it finds.

### Soirely's own keys

| Variable                                                                        | Generate                                                                                                                                                                                                                               | Who rotates it, and when                          | What rotating it ends                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_SECRET`                                                                    | `openssl rand -hex 32`                                                                                                                                                                                                                 | ops, on a leak                                    | every link the API signed with it and sent: unsubscribe, "not me" and the other emailed link tokens                                                                                                                                                                                                                    |
| `MERCURE_PUBLISHER_KEY` (the hub's `MERCURE_PUBLISHER_JWT_KEY`)                 | `openssl rand -hex 32`                                                                                                                                                                                                                 | ops, on a leak                                    | nothing a person sees: the API and the hub restart together                                                                                                                                                                                                                                                            |
| `MERCURE_SUBSCRIBER_KEY` (the hub's `MERCURE_SUBSCRIBER_JWT_KEY`)               | `openssl rand -hex 32`, not the publisher's                                                                                                                                                                                            | ops, on a leak                                    | every open live connection, until each client asks for a new token                                                                                                                                                                                                                                                     |
| `JWT_SECRET_KEY`, `JWT_PUBLIC_KEY` (`deploy/secrets/jwt/`) and `JWT_PASSPHRASE` | `openssl rand -hex 32`, then `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -pass pass:<passphrase> -out private.pem` and `openssl pkey -in private.pem -passin pass:<passphrase> -pubout -out public.pem` | ops, on a leak                                    | every access token: people stay signed in through their refresh token                                                                                                                                                                                                                                                  |
| `TWO_FACTOR_KEY`                                                                | `openssl rand -base64 32`                                                                                                                                                                                                              | **nobody. Set once, never rotated on a schedule** | every authenticator: the API opens each stored secret with this one key, so a new value leaves every account with an authenticator unable to finish signing in. Rotating it is a re-encryption no story builds; if a leak ever needs it, that is its own story. Alone it reveals nothing without the database it seals |
| `POSTGRES_PASSWORD`, and the same value in `DATABASE_URL`                       | `openssl rand -hex 32`                                                                                                                                                                                                                 | ops, on a leak                                    | nothing a person sees, if changed in Postgres (`ALTER ROLE`) and here in one deploy                                                                                                                                                                                                                                    |
| `REDIS_PASSWORD`                                                                | `openssl rand -hex 32`                                                                                                                                                                                                                 | ops, on a leak                                    | rate-limit budgets and cached answers, which rebuild on their own                                                                                                                                                                                                                                                      |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`                                                 | `openssl rand -hex 32`                                                                                                                                                                                                                 | ops, on a leak                                    | Meta's webhook, until the new token is entered in Meta's console                                                                                                                                                                                                                                                       |

The local stacks' `REDIS_URL` is read by nothing in the API, which connects by host,
port and `REDIS_PASSWORD`; this path does not set it.

### Addresses and providers

- **`SUPPORT_EMAIL`**: the address the "nobody can confirm this" screen names (sc-509),
  and the web client's own pages. Set explicitly in every environment, even when it is
  the default `support@soirely.com`.
- **`MAIL_WEBHOOK_SECRET` and `MAIL_WEBHOOK_ALLOWED_RANGES`** (sc-4332): the
  provider's published ranges, set beside the secret, never the local stacks' private
  ranges (the pre-flight refuses those). A refused bounce never reaches the rate check,
  so the rate alert cannot catch a wrong value: **after each deploy, send a test webhook
  from the provider and confirm it is recorded.**
- Every other provider's credentials are in `deploy/env.example`, one per line. A
  variable that `env.example` does not list is read by nothing, and the pre-flight
  refuses it: `MERCURE_JWT_SECRET` is gone from the repository for that reason.

## Alerts on

**Waiting on the owner.** The API writes each line below at `critical` to its JSON log
on stderr, which Docker keeps (50 MB × 5 per container). Nothing ships those logs
anywhere yet: the destination is Axiom Cloud, EU Central 1 as the organisation's default
edge, up to $25/month (bm's memo, sc-1612 #1685), and that spend waits on the owner's
approval. Once approved, ops creates the organisation, adds the shipper here, and
proves each alert with a forced failure on a non-production environment
(sc-1612 #1696). Until then this section is the list the alerts are made from.

| Story    | The line's message                                                                                                                                      | Alert                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| sc-117   | `The revoked-session list is unreachable; ended sessions last until their access tokens expire` (`RevokedSessions::UNREACHABLE`), once per failed check | on every line                |
| sc-4332  | `Email bounces are at …` / `Email complaints are at …`, from the hourly `app:mail:check-rates` (over 2% bounces or 0.08% complaints in 24 hours)        | on every line                |
| sc-104   | `Notifications have stopped: …`, `Notifications are behind: …`, `Notifications are failing: …`, from `app:notifications:check` every minute             | on every line                |
| sc-45470 | `Meta refused a WhatsApp message for the account's payment (131042).`                                                                                   | one alert for a run of lines |
| sc-46367 | `WhatsAppSubsidy::CAP_REACHED`, with the month and its USD total in its context, once in a month                                                        | on the line                  |
| sc-80876 | `Anthropic refused an assistant request: the workspace's monthly spend limit is reached.`                                                               | one alert for a run of lines |

## The first deploy's pre-flight

Each line of sc-1612, ticked on the first deploy:

- [ ] `deploy/preflight.sh` passes, every line `ok`.
- [ ] The migrations ran in the deploy's output before the containers were replaced.
- [ ] `docker compose -p soirely logs scheduler` shows `app:two-factor-recovery:expire`
      running every 5 minutes.
- [ ] An assistant seating request that takes over 60 s comes back, and a slow request
      on any other route ends at 60 s.
- [ ] The "nobody can confirm this" screen names this environment's `SUPPORT_EMAIL`.
- [ ] A test webhook from the mail provider is recorded.
- [ ] Each alert above fires on a forced failure in a non-production environment
      (waits on the owner's approval of the log destination).
