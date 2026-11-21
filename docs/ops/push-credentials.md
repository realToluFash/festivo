# Push credentials

The runbook for the keys and accounts push needs outside development (sc-19684). The values
in `compose.yaml` and `.env.example` are development keys, public in this repository, and
never run on a deployed environment.

| Variable             | Who makes it | Where it lives                                     |
| -------------------- | ------------ | -------------------------------------------------- |
| `VAPID_PUBLIC_KEY`   | ops          | the environment's secret store                     |
| `VAPID_PRIVATE_KEY`  | ops          | the environment's secret store                     |
| `VAPID_SUBJECT`      | ops          | `mailto:support@soirely.com`                       |
| `EXPO_PUSH_API_BASE` | ops          | `https://exp.host` in every deployed environment   |
| `EXPO_ACCESS_TOKEN`  | owner        | empty unless Expo's enhanced push security is on   |
| `EAS_PROJECT_ID`     | owner        | the EAS build environment, read by `app.config.ts` |

The api and the notification worker both read the first five from the deploy compose's api
environment (sc-1612). Each deployed environment has its own VAPID pair: a pair is never
shared between the demo and production.

## Generating the VAPID pair

Once per environment, in that environment's api container, with nothing recording the
terminal:

```sh
php -r 'require "vendor/autoload.php"; foreach (Minishlink\WebPush\VAPID::createVapidKeys() as $name => $key) echo $name, "=", $key, PHP_EOL;'
```

Put `publicKey` into `VAPID_PUBLIC_KEY` and `privateKey` into `VAPID_PRIVATE_KEY` in the
secret store, then clear the terminal. Neither value goes into the repository, a log, a
comment or a ticket; name them by variable only.

## Rotating the VAPID pair

A browser subscription is bound to the public key it was made with, so a new pair stops
every existing web push at once. Rotate only when the private key is known or suspected to
have leaked. Never on a schedule, and never to tidy up.

1. Generate the new pair as above and replace both values in the secret store together.
2. Deploy the api, which restarts the notification worker with it.
3. Expect refusals, not expiries. A push service answers 403 to a send signed with a key the
   subscription was not made with (RFC 8292 §4.2). For each old target the worker logs
   `Web Push answered 403.` and keeps the target. That is the rotation working, not a bad
   deploy: never put the old pair back because of it.
4. A member's old target clears when they next open the web client signed in:
   `apps/web/src/webPush.ts` sees the key has changed, unsubscribes the old endpoint and
   subscribes again, without asking for permission again. The next send to the old endpoint
   gets 410 and the target is dropped.
5. A member who never comes back keeps a refused target until their session ends. Every
   target belongs to a session, and `app:prune-refresh-tokens` (daily, 03:00 UTC, see
   `docs/architecture/sessions.md`) ends a session 30 days after its last use, taking its
   targets with it. So the 403s stop by themselves within about 31 days, and nothing needs
   deleting by hand.
6. Tell the owner the same turn, with the reason, since members miss web pushes until they
   come back.

## The owner's accounts

These belong to the company and are created by the owner. Ops cannot make them.

1. **EAS project** for `apps/mobile`, in the company's Expo account. Its id is
   `EAS_PROJECT_ID`, read by `app.config.ts`; without it the app registers for no push. Set
   it as an EAS environment variable in the `preview` and `production` environments, and
   export it in the shell that runs `eas build`, which evaluates the config locally first.
   The build profiles are in `apps/mobile/eas.json`.
2. **APNs key** (`.p8`, key id, team id) from the company's Apple Developer account,
   uploaded to the EAS project's iOS credentials.
3. **FCM v1 service account** from the company's Firebase project, with only the Firebase
   Cloud Messaging role, uploaded to the EAS project's Android credentials.

## Check before the first push

`compose.yaml` falls back to the development pair when `VAPID_PUBLIC_KEY` or
`VAPID_PRIVATE_KEY` is unset, so a deploy compose that reuses its api environment and misses
one boots on the private key in this repository without complaint. Before anyone is asked
for push on a deployed environment, sign in on it and read `webPushKey` from
`GET /api/auth/push-targets`. If it equals the `VAPID_PUBLIC_KEY` default in `compose.yaml`,
stop: the environment is running the development pair. Set both variables and deploy again.

## Smoke test after a deploy

1. In a desktop browser, sign in, allow notifications, and trigger a notification for that
   member: it arrives as a web push.
2. On an iPhone and an Android phone, install a build of the `preview` profile
   (`eas build --profile preview`, from `apps/mobile`) and do the same. It is a release
   build with the EAS project's credentials, so it receives push the way the store build
   will. Expo Go cannot receive remote push, so it proves nothing here.
3. Check the notification worker's logs for `Web Push answered` and Expo errors in the
   first minutes.
