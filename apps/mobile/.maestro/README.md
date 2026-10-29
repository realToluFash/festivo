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

`sign-in-screen-language` picks the one passed as `LANGUAGE`, by its chip, before
`sign-in-any-language`. `sign-in-screen-english` runs it with `LANGUAGE: English`, for a phone
a run in another language left signed out: `sign-in`'s first wait is on the English 'Email'.
`text-size-signed-out` starts with it too, so a change to the chip row lands in one flow.

Two flows tap one control by `testID`, passed as `ID`: `scroll-tap` scrolls to it from above
or below, for a step inside another flow; `ownership-tap` takes a screenshot of what follows
and turns off the retry, for a button whose request is held.

Signing in, each on its own outcome:

| Flow                   | Needs                                         | Leaves the app on                             |
| ---------------------- | --------------------------------------------- | --------------------------------------------- |
| `register-check-email` | `NAME`, `EMAIL` (a fresh address), `PASSWORD` | Check your email, after a sign-up on Register |
| `verify-email`         | the same                                      | A few details, verified with the newest code  |
| `verify-email-refused` | the same                                      | Check your email, a new code counting down    |
| `sign-in-locked`       | `EMAIL`, a fresh address                      | sign-in, past the limit                       |
| `signed-out-elsewhere` | a session ended from another client           | sign-in, with "You were signed out"           |

Every new account starts from a sign-up (sc-512), so the verify-email flows register `EMAIL`
themselves through `register-check-email`, which switches the app to English first. The address
must be fresh: one an account already holds is sent no code, and `verify-email` fails.
`sign-in-locked` and `signed-out-elsewhere` match English text, so the phone must be in English
first (`sign-in-screen-english`).

`verify-email` reads the code from Mailpit with `scripts/latest-code.js`.

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

A check that needs the API held asks the harness through `batch/helper.js` with
`ASK: /api?to=paused`, `/api?to=stopped` or `/api?to=up`. It answers once the QA stack's `api`
service is there, and `up` once it is healthy again. Hold it after the screen before has
loaded: Events keeps its rows, so a row tapped with the API paused holds only Event View's
reads. Every check starts with the API up, whatever the one before it left.

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
- **On iOS, Return gets past a text field, never `hideKeyboard`**, which stops a flow on
  an iPhone with "Couldn't hide the keyboard". Press `pressKey: Enter`: Return moves to the
  next field, sends the form where the field's Return sends it, and puts the keyboard away
  where it sends nothing. On Android, Enter can type into the field instead (sc-18648), so
  a flow uses `hideKeyboard` and then the tap. Split the two by platform, as
  `batch/sign-in-form.yaml` does. The one exception is a check whose outcome is the
  keyboard put away by hand: `checks/sc13408-change-dismiss.yaml` and
  `checks/sc13408-choose-dismiss.yaml`, and the `sc9674-*` checks, whose outcome is what the
  keys do after a refused send: on an iPhone they put the keys away with a tap on blank page,
  `tapOn: point: '2%,45%'`, since `hideKeyboard` hangs there. That point is for a phone only: on a
  tablet it lands in the settings split list and opens another section. Their Android copies,
  `sc9674-a-*`, press `pressKey: back` instead.
- **Expo Go is the app**, so `appId` is `host.exp.Exponent` and the flow opens the project
  with `openLink`. A standalone build would use `com.soirely.app` and `launchApp`. On Android
  the package is `host.exp.exponent`, in lower case. Write iOS's: `qa-env.mjs maestro --android`
  runs from a copy of this whole directory with Android's, so a `runFlow` or `runScript` path
  still resolves. In that copy each `openLink: ${METRO_URL}…` asks the harness to open the link
  in Expo Go by its package, since Maestro's names none and can land on Expo Go's own home.
- **Scroll to what can sit below the fold.** Maestro on Android sees only what is on
  screen, so an `extendedWaitUntil` or `assertVisible` on a line under a phone's fold passes
  on the iPhone and times out there. Use `scrollUntilVisible`, which does not scroll when the
  line is already in view.
- **On a tablet, a section's title is also a row in the split list** beside every settings
  page, so a wait that ends on `{{t:settings.organisation}}` ends on the list, not the page.
  Wait on a line only the page has, such as its intro or a field's `testID`.
