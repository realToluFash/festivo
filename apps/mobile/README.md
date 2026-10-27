# apps/mobile

The night, from a pocket. Planning happens at a desk in `apps/web`; this is the
surface for running the event — checking people in, working the floor, seeing
what is next.

An Expo application on expo-router, running on iOS, Android and web from the
same source.

## Running it

```sh
npm install                               # from the repository root
npm run start --workspace @soirely/mobile # then press i, a, or w
npm run ios     --workspace @soirely/mobile
npm run android --workspace @soirely/mobile
npm run web     --workspace @soirely/mobile

npm run typecheck --workspace @soirely/mobile
npm run test      --workspace @soirely/mobile
```

## Pointing it at the API

The base URL comes from configuration, never a literal. It is read by
`app.config.ts` from the environment and bundled:

| Variable                  | What it is                                                  |
| ------------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`     | Where the API is **from the device**                        |
| `EXPO_PUBLIC_ENVIRONMENT` | A name, so a support conversation can establish which build |

**On a simulator or emulator** nothing needs setting — the fallback is
`http://localhost:8080`, which reaches the host machine.

**On a real device** `localhost` is the phone itself, so it reaches nothing. The
phone and the computer must be on the same network, and the variable has to be
the computer's address on it:

```sh
# macOS — the address on the current Wi-Fi network
ipconfig getifaddr en0

EXPO_PUBLIC_API_URL=http://192.168.1.50:8080 npm run start --workspace @soirely/mobile
```

The home screen says out loud when nothing configured the URL, because the
alternative symptom is a request that times out with no explanation.

> **Why this differs from `apps/web`.** The web client reads its API URL from a
> file at boot so that one built image serves every environment. A mobile bundle
> IS the artefact — built per environment and shipped through a store or an
> update channel — so there is no later moment at which a file beside it could
> be rewritten. Both rules agree on the part that matters: never a literal in a
> source file.

## The three layouts

`useLayout()` reports `phone`, `tabletPortrait` or `tabletLandscape`.

It decides on the **smaller window dimension and the orientation, never width
alone**. Width alone makes a phone in landscape report as a tablet: a 956pt-wide
iPhone is wider than an 834pt-wide iPad in portrait, and the two want completely
different layouts. The smaller dimension is what actually distinguishes the
devices, because it does not change when the device is turned.

The judgement lives in `src/layout/classify.ts` as a pure function with no React
Native import, which is what lets the tests reach it. `src/layout/useLayout.ts`
is the hook that feeds it `useWindowDimensions()`.

`app/layouts.tsx` renders all three branches and is **removable in one commit** —
delete the file and the link to it in `app/index.tsx`. It exists because the
three layouts are the thing most often retrofitted and most expensive to
retrofit, and the branches are structurally different rather than one layout
rescaled: landscape earns a persistent detail pane, portrait stacks the detail
below the list, the phone shows one at a time.

## Building a screen

**Use `Screen` from `src/components/Screen.tsx`.** Not a bare `View`.

Android enforces edge to edge — the toggle no longer exists in this SDK, so the
layout always owns the area behind the system bars. That makes the safe-area
wrapper load-bearing rather than polite: it is the only thing keeping content
out of the status bar and off the gesture bar. A screen built on a bare `View`
looks correct on the simulator it was written on and puts a button under the
home indicator on the next device.

It takes `edges`, so a screen wanting the bottom inset but not the top — a
docked footer under a full-bleed header — can say so.

## Text, fonts, and the crash this app is built to avoid

**Use `Text` from `src/components/Text.tsx`, and ask for a `weight`.**

Two shapes crashed the previous build on React Native Web, because of how the
font mapper resolves weights:

| Never                           | Instead                              |
| ------------------------------- | ------------------------------------ |
| a `Text` nested inside a `Text` | sibling `Text` elements in a `View`  |
| a `Text` with `onPress`         | a `Pressable` wrapping a `Text`      |
| `fontFamily` in a style         | `fontWeight`, via `weight('medium')` |

Neither crashing shape fails on iOS or Android, so the pattern gets written,
reviewed, merged and shipped, and only the web build falls over.
`src/textGuard.test.ts` fails on either, naming the file and the line — and it
is a scanner rather than a per-line regex because the previous sweep used a
single-line pattern, could not see markup **wrapped across lines**, and eleven
cases passed every check and shipped.

Our `Text` does not accept `onPress` at all, so the wrong thing is a type error
rather than a runtime crash on one platform.

No custom font face is registered yet; weights resolve to the platform font.
That is deliberate — a typeface is a design decision, and inventing one in the
skeleton would make it a choice by whoever wrote the skeleton. The mechanism and
the rule are what Foundation owes the design.

## Localisation

`en`, `es`, `fr`, `pt`, awaited before the first render — rendering first shows
a French reader a flash of English, which reads as a broken product rather than
as loading.

Resolution is the stored override, then the device, then English. The supported
set comes from `/locales.json` at the repository root, the same file the API and
the web client read.

Plural rules come from `@formatjs/intl-pluralrules`, forced in `src/intl.ts`:
Hermes does not ship a full ICU, so without it `_one`/`_other` silently resolves
to the key path on device while working perfectly in a browser, and an older
ICU never picks `_many` for a million in Spanish, French or Portuguese.

## Tests

Vitest, not jest-expo, and that is a constraint rather than a preference:
everything worth testing here is a pure function over data or over source text,
so nothing needs React Native loaded and the repository keeps one test runner.

**The rule that follows: anything a test needs to reach must not import
`react-native`.** Hence `classify.ts` beside `useLayout.ts` — the judgement in
one file, the hook that feeds it in another.

## Known advisories

`npm audit` reports high-severity findings against `@expo/metro`, `@expo/cli`
and `@expo/config-plugins` — the bundler, the dev CLI and the prebuild plugins.
They are counted as production because `expo` is a production dependency, but
none of that code is in the JavaScript that ships to a device.

`npm audit fix` resolves none of them in range; only `--force` does, and that
breaks the SDK's own version alignment. So they stay until Expo bumps them, and
the trade is written down here rather than silently accepted.
