# Maestro flows

Simulator and emulator tests for QA, driven by [Maestro](https://maestro.dev). One flow
per outcome, named for the story it belongs to.

These are for a QA pass, not for CI: they need a booted simulator and a running bundler,
and they are slow. The checks that belong in CI are pure functions and the suites beside
them — see `.claude/skills/writing-tests`.

## Running one

```sh
just up                                   # the API, which the app talks to
npm run ios --workspace @soirely/mobile   # the bundler, in Expo Go on the simulator
just qa-mobile sign-in                    # a flow, by file name
```

Maestro needs a Java runtime. `java -version` failing means
`brew install --cask temurin@21` first.

## Shared flows

The steps every QA pass repeats. Each finds its controls by `testID`, so it runs in any
language, and starts with `return-home.yaml`, which closes an open sheet and taps Home, so
it runs alone on a signed-in phone (`qa-env.mjs maestro <name>`) or as a step after any other
(`- runFlow: <name>.yaml`) without relaunching Expo Go or signing in. Each ends with one
screenshot. `shared-flows-chained-*` run them one after another, as a batch would.

| Flow                       | Leaves the app on                | Screenshot                   |
| -------------------------- | -------------------------------- | ---------------------------- |
| `sign-out`                 | the sign-in screen               | `mobile-signed-out`          |
| `open-settings`            | Settings                         | `mobile-settings`            |
| `open-switcher`            | Your organisations               | `mobile-switcher`            |
| `open-create-organisation` | the Create an organisation sheet | `mobile-create-organisation` |
| `return-home`              | Home                             | none                         |
| `switch-organisation`      | Home, in the organisation `ORG`  | none                         |

`sign-in-screen-english` picks English on the sign-in screen, for a phone a run in another
language left signed out: `sign-in`'s first wait is on the English 'Email'.

Two flows tap one control by `testID`, passed as `ID`: `scroll-tap` scrolls to it from above
or below, for a step inside another flow; `ownership-tap` takes a screenshot of what follows
and turns off the retry, for a button whose request is held.

A flow a tester writes is posted to `[ops]` on the story they were testing, and ops commits
it here.

## Checks, run as a batch

`checks/` holds checks: each opens one screen, asserts what it shows and takes its
screenshots. `qa-env.mjs batch` runs a list of them in one Maestro run on one signed-in
session (`batch/session.yaml`), reloading the bundle before each (`batch/reset.yaml`), so a
check never relaunches Expo Go and never signs in. `--cold` runs each alone from a relaunch.

A check is written like a flow, and also:

- **No `launchApp` and no sign-in.** It opens its screen with `openLink`, or by taps from a
  screen it opened that way. The batch has already signed the account in.
- **Text in the batch's language, as `{{t:key}}`**: `visible: '{{t:settings.title}}'`, the key
  from `apps/mobile/src/i18n/locales/en.json`, in single quotes. The harness writes each
  language's string in. `{{t:any:key}}` matches any of the four, and `{{t:key|email}}` puts the
  account's address where the string has `{{email}}`.
- **`takeScreenshot: <name>`, on one line.** The harness prefixes the check and language, so
  `settings` in a Spanish batch lands in `.qa/<batch>/settings.es-settings.png`.

Two-factor sign-in is `sign-in-two-factor.yaml`. It asks the harness for each code
(`batch/helper.js`), so it runs inside a batch, which holds the account's `TOTP_SECRET`.

## Writing one

- **Target `testID`, never prose.** A flow that taps `"Sign in"` taps whichever "Sign in"
  it finds first and breaks in Spanish. Add a `testID` to the control instead and tap that.
- **Take a screenshot at every state worth reporting**, named and nothing else:
  `takeScreenshot: mobile-signed-in`. Maestro refuses a path that leaves its own run
  folder, so `just qa-mobile` points that folder at `.qa/<flow>/` and the file lands in
  `.qa/<flow>/mobile-signed-in.png`, which is where a QA report collects its evidence.
- **One flow, one outcome.** A flow that signs in and then changes a password reports one
  failure for two features.
- **Reach the bundler through `${METRO_URL}`**, never a literal port: the QA stack's
  bundler is on 18081, and both `just qa-mobile` and `qa-env.mjs maestro` pass it in.
  Mailpit, the same, through `${MAILPIT_URL}`.
- **Pass data in**, with `-e`: an account comes from `node scripts/qa-account.mjs`, so no
  flow holds credentials.
- **Expo Go is the app**, so `appId` is `host.exp.Exponent` and the flow opens the project
  with `openLink`. A standalone build would use `com.soirely.app` and `launchApp`. On Android
  the package is `host.exp.exponent`, in lower case. Write iOS's: `qa-env.mjs maestro --android`
  runs from a copy of this whole directory with Android's, so a `runFlow` or `runScript` path
  still resolves.
- **Scroll to what can sit below the fold.** Maestro on Android sees only what is on
  screen, so an `extendedWaitUntil` or `assertVisible` on a line under a phone's fold passes
  on the iPhone and times out there. Use `scrollUntilVisible`, which does not scroll when the
  line is already in view.
- **On a tablet, a section's title is also a row in the split list** beside every settings
  page, so a wait that ends on `{{t:settings.organisation}}` ends on the list, not the page.
  Wait on a line only the page has, such as its intro or a field's `testID`.
