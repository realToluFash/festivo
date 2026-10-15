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
  with `openLink`. A standalone build would use `com.soirely.app` and `launchApp`.
