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
2. The authenticated account's stored preference
3. `Accept-Language`, matched against the supported set
4. English

The explicit parameter comes first because somebody whose account is in French still needs
to produce an English error to paste into a support ticket. The account preference comes
before the header because a person's stored choice outranks whatever browser they are on.

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

Three, all failing tests rather than conventions:

- **Every error code has a message in all four locales.** `ErrorCodeCatalogueTest` walks
  the `ErrorCode` enum, which is closed, so it can.
- **Every domain has the same key set in every locale**, and no empty messages.
- **A message has the same placeholders in every locale.** A slot present in one and absent
  in another breaks at render time in one language only — the one nobody on the team reads.

A missing key is additionally **logged once per key, domain and locale**, because the
fallback renders fine and nothing else would say so.

## Writing a message

- **Never concatenate a sentence.** `'Send to ' + n + ' guests?'` is English word order
  baked into code. One string, with slots.
- **Counts take plural families**, not a ternary at the call site. Plural rules are not
  "one versus everything else" in every language.
- **A label in a module-level constant cannot be translated where it sits** — it is built
  at import time, before any translator exists. Store the key, resolve at render.

## Register

Consistency matters as much as coverage, and it is what a machine translation gets wrong.

|            |                                                                                 |
| ---------- | ------------------------------------------------------------------------------- |
| English    | international spelling; no contractions in error bodies — "cannot", not "can't" |
| Spanish    | formal throughout                                                               |
| French     | vouvoiement — "Veuillez…"                                                       |
| Portuguese | PT-PT — _ficheiro_, _palavra-passe_, _secção_                                   |
