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
3. Until each member next opens the web client signed in, their pushes fail and the old
   target is dropped as expired. On that next load `apps/web/src/webPush.ts` sees the
   key has changed, unsubscribes and subscribes again. Nobody is asked for permission again.
4. Tell the owner the same turn, with the reason, since members miss web pushes until they
   come back.

## The owner's accounts

These belong to the company and are created by the owner. Ops cannot make them.

1. **EAS project** for `apps/mobile`, in the company's Expo account. Its id goes into the
   build environment as `EAS_PROJECT_ID`; without it the app registers for no push.
2. **APNs key** (`.p8`, key id, team id) from the company's Apple Developer account,
   uploaded to the EAS project's iOS credentials.
3. **FCM v1 service account** from the company's Firebase project, with only the Firebase
   Cloud Messaging role, uploaded to the EAS project's Android credentials.

## Smoke test after a deploy

1. In a desktop browser, sign in, allow notifications, and trigger a notification for that
   member: it arrives as a web push.
2. On an iPhone and an Android phone, install a development build made from the EAS
   project and do the same. Expo Go cannot receive remote push, so it proves nothing here.
3. Check the notification worker's logs for `Web Push answered` and Expo errors in the
   first minutes.
