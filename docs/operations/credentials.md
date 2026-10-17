# Production credentials

One section per external service the product calls in production (the Pre-Launch epic,
sc-552). Each says what the credential is, where each part of it goes, who can rotate it and
how, and when it expires. Development and staging never use these; the local stack has a
stand-in for every service (`compose.yaml`).

## Google sign-in (sc-554)

The company's Google Cloud project holds three OAuth clients. Its consent screen asks for
`openid`, `email` and `profile` and nothing more.

| Client  | Registered with                                                       | Its id goes in                                                         |
| ------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Web     | the production web origin's callback, and no other redirect           | the web's `SOIRELY_GOOGLE_CLIENT_ID`, the API's `OAUTH_GOOGLE_WEB_CLIENT_ID` |
| iOS     | the bundle id `com.soirely.app`                                       | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, when the app is built              |
| Android | the package `com.soirely.app` and the release signing key's SHA-1     | `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, when the app is built          |

- **All three ids go in the API's `OAUTH_GOOGLE_CLIENT_IDS`**, because each is an audience
  a token the API accepts may carry. A client id is not a secret.
- **Only the web client has a secret**, `OAUTH_GOOGLE_WEB_CLIENT_SECRET`. It is in the
  production secret store and nowhere else: not in the repository, not in a build, not in a
  chat. The API redeems the web's code with it (`docs/architecture/sessions.md`).
- **No production client lists a localhost or staging redirect.** A redirect a production
  client accepts is a place its codes can be sent.

### Who can rotate it

An administrator of the Google Cloud project who can also write to the production secret
store. The project has at least two administrators, so the secret never depends on one
person being reachable.

### Rotating the web secret

A Google OAuth client holds two secrets at once, so the secret is rotated without a moment
when sign-in fails:

1. In the Google Cloud console, APIs & Services, Credentials, open the web client and add a
   secret. Copy it at once: Google shows it only when it is made.
2. Put it in the secret store as `OAUTH_GOOGLE_WEB_CLIENT_SECRET`, and redeploy the API.
3. Sign in with Google on the web. If that fails, the API is not using the new secret yet:
   stop here, with the old secret still enabled.
4. Disable the old secret, sign in on the web again, then delete it.

After a suspected leak, do step 4 as soon as step 2 is deployed rather than waiting.

The iOS and Android clients have no secret. Replacing one means a new client, its id in a
new build of the app, and the old id kept in `OAUTH_GOOGLE_CLIENT_IDS` until that build is
the only one in use.

### Expiry

The secret does not expire. Google deletes a client that has gone unused for six months,
which a client made for an app not yet released can reach before launch: smoke-test each
client once it is made, and again in the month before launch.
