# Localisation

Four locales: **en, es, fr, pt**. A string that exists in one and not the others is a bug,
not a follow-up.

## One declaration

`/locales.json` at the repository root is the single statement of which languages this
product speaks. The API reads it, and `apps/web` and `apps/mobile` read the same file.

It has to be repeated in a couple of places that cannot read JSON at the right moment — a
PHP constant on the request path, and Symfony's `enabled_locales`. Each of those works
perfectly while disagreeing with the others, so **a test fails when any of them drifts**,
naming which one.

Adding a language is: one entry in `locales.json`, one catalogue per domain, and the
constant. The test tells you if you miss one — including the case where a locale is
declared but has no catalogue at all, which would render raw keys to anybody who selected
it.

## Two resolution orders, deliberately different

Conflating them is the bug this design exists to prevent. An organiser working in English
who invites a Portuguese-speaking guest must produce a **Portuguese** invitation.

### A response — the request locale

1. An explicit `?locale=` parameter
2. `Accept-Language`, matched against the supported set
3. The authenticated account's stored preference
4. English

The explicit parameter comes first because somebody whose account is in French still needs
to produce an English error to paste into a support ticket. The header comes before the
account preference because a screen asks in the language it is showing, and a language
picker switch asks before the account has saved it (sc-9267, decided 24 Oct): a date the
server writes into an answer read before the save would otherwise sit in the old language
inside a sentence in the new one. The stored preference answers only a request that names
none of the four. `AccountLanguage::shown()` is the one place this order lives; a new
field the server writes for the reader goes through it, not through `of()`.

### Anything sent to a person — the recipient locale

1. The recipient's own stored preference
2. The event's default language
3. English

**Never the sender's.** Resolving outbound language from the request would send every guest
the language of whoever happened to press the button.

## Matching is on the language, not the tag

`pt-BR`, `es_ES` and `FR` all resolve. A Brazilian reader gets Portuguese rather than
English, which is the entire point — exact-tag matching is how that goes wrong.

A locale outside the supported set is **never selected**. The failure is not an error; it
is a page of raw translation keys, which looks like text and is not.

## A listener's priority is part of the behaviour

`RequestLocaleListener` runs at **34**, and the number matters twice:

- **Above `RouterListener` (32)**, because an unmatched route throws its 404 from there.
  A locale listener below it never runs for exactly the requests a confused person is most
  likely to be reading — every wrong-URL error comes back in English while negotiation
  looks correct everywhere else.
- **Above `LocaleListener` (16) and `LocaleAwareListener` (15)**, because the first reads
  the `_locale` attribute and the second pushes the locale into the translator. Running
  after them sets a locale nothing reads.

Both of those were discovered by the responses being English while every other check
passed. Neither produces an error.

## Guards

All failing tests rather than conventions, because every failure here renders _fluently_
in the wrong way. None of them throws, none produces a log line, and the reader who
notices is the one reading the language nobody on the team reads.

### One implementation, every surface

`packages/i18n-lint` owns them and drives them from a registry of surfaces — `apps/web`,
`apps/mobile`, the API's error catalogues. Adding a surface adds its checks.

That consolidation is the point. There were three copies of "the same key set in every
locale", one per app, with three subtly different ideas of what parity meant — so three
places to forget, and no answer to "is this checked everywhere?".

| Check                           | What it catches                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| A catalogue per declared locale | A locale declared in `locales.json` with no file renders raw key paths to anybody who selects it |
| Identical key sets              | A key in English and missing elsewhere renders as its own path — fluent-looking rubbish          |
| No empty messages               | An empty message renders as nothing, which reads as a layout bug                                 |
| Identical interpolation slots   | `{{count}}` in one locale and `{{total}}` in another leaves a hole in a sentence                 |
| Complete plural families        | `_one` with no `_other` falls back for every number except one — the plural most readers see     |

Each of those is proved to fail by a deliberately-broken fixture under
`packages/i18n-lint/src/__fixtures__`. A guard nobody has watched fail is a guard nobody
should trust.

**A word more than one surface keeps its own copy of reads the same in each.** The API
refuses a custom role named after a seeded role in any language from its own copy of the
seeded labels, so `SHARED_WORDS` in `surfaces.ts` lists every copy and a test fails, naming
the locale and each reading, when one of them changes alone.

The server keeps **`ErrorCodeCatalogueTest`** as well, which is not duplication: it walks
the `ErrorCode` enum — closed, and invisible to anything outside PHP — so it alone can
catch a _code with no message_ and a _message for a code that no longer exists_.

A missing key is additionally **logged once per key, domain and locale**, because the
fallback renders fine and nothing else would say so.

### No user-facing literals

The check that catches what nothing else does: a string that renders perfectly in
English, has no key, and is simply absent in the other three languages.

It is **parsed, not pattern-matched**. The previous build's sweep used a single-line
regex; it could not see prose wrapped across several lines of markup, eleven strings
passed every check, and they shipped. A parser has no lines — a JSX text node spans
however much of the file it spans — so wrapped prose is the same node as prose on one
line and there is nothing to miss. It also removes the false positives a `>…<` pattern
invites: `=>`, `Array<string>` and `a > b` all contain the characters such a pattern looks
for, and none of them is text.

It flags text sitting in markup, and a literal in a prop a person reads — the list of
those props is in `surfaces.ts`. It does not flag punctuation or decoration (`←`, `·`,
`—`, `×`, a number), because those are identical in every language and flagging them
trains people to add exemptions, which is how a guard stops being read.

**Exemptions live in one list, in `surfaces.ts`, and each carries a reason.** Not
suppression comments scattered through the code: those are invisible in review, they
accumulate, and nobody ever audits whether they are still needed. Two tests keep the list
honest — one fails on an exemption with no real reason, and one fails on an exemption that
no longer suppresses anything, so the list shrinks on its own.

There is exactly one today: the mobile boot-failure screen, which renders when
localisation itself failed to initialise and therefore has no translator to render it
with.

## Writing a message

- **Never concatenate a sentence.** `'Send to ' + n + ' guests?'` is English word order
  baked into code. One string, with slots.
- **Counts take plural families**, not a ternary at the call site. Plural rules are not
  "one versus everything else" in every language.
- **A label in a module-level constant cannot be translated where it sits** — it is built
  at import time, before any translator exists. Store the key, resolve at render.
- **A string a reader sees goes through `t()` with no exceptions you decide yourself.** If
  something genuinely cannot be translated, it goes in `LITERAL_EXEMPT` with a reason,
  where somebody else can disagree with it.

## Register

Consistency matters as much as coverage, and it is what a machine translation gets wrong.

|            |                                                                                 |
| ---------- | ------------------------------------------------------------------------------- |
| English    | international spelling; no contractions in error bodies — "cannot", not "can't" |
| Spanish    | formal throughout                                                               |
| French     | vouvoiement — "Veuillez…"                                                       |
| Portuguese | PT-PT — _ficheiro_, _palavra-passe_, _secção_                                   |
