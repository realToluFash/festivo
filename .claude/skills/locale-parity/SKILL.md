---
name: locale-parity
description: Every user-facing string goes through translation and exists in all four locales, with plural families and interpolation rather than concatenation. Use when adding or changing any string a user can read, in any of the clients or in a server error.
---

# Locale Parity

Four locales: **en, es, fr, pt**. A string that exists in one and not the others is a bug,
not a follow-up.

## The rule

No string literal anywhere a user can see it. That means all of:

- text children in a component
- `placeholder`, `label`, `title`, `subtitle`, `helper` props
- alert and dialog titles, bodies **and every button label**
- validation messages
- server error codes, under `errors.<code>`
- anything in a constant that is later rendered

A key added to one locale file and not the other three is the defect this skill exists to
prevent. Add all four in the same change.

## Things that look fine and are not

**A label in a module-level constant cannot be translated where it sits.** Status maps,
step labels, option arrays — these are built once at import time, before any translator
exists. Store the key and resolve it where it renders:

```
// wrong                      // right
{ label: 'Pending' }          { labelKey: 'service.pending' }
```

**Never concatenate a sentence.** `'Send to ' + n + ' guests?'` is English word order
baked into code. One string, with slots: `send.confirm` → `"Send to {{count}} guests?"`.

**Counts take plural families**, `_one` and `_other`, not a ternary in the calling code.
Languages have plural rules that are not "one versus everything else".

**Check for a key you are about to overwrite.** A namespace can hold both a count called
`guests` and a heading called `Guests`. Overwriting is silent — the broken one renders as
its own key path, and no test fails.

## Guest names

Never split a name to get a first name. Hosts type titles — Mr., Chief, Alhaji, Dr. —
and the first token of a guest's name is as likely to be a title as a name. Use the full
name, through whatever helper the client provides for it.

## Register

Formal throughout, and consistent:

- English: international spelling, no contractions in error bodies — "cannot", not "can't"
- Spanish: formal, consistent across the file
- French: vouvoiement — "Veuillez…"
- Portuguese: PT-PT vocabulary — "ficheiro", "palavra-passe", "secção"

## Before committing

A guard test should fail on any of these, and running it is faster than reading for them:

- the four files have identical key sets
- every interpolation slot appears in all four
- plural families are complete
- no source file contains a user-facing literal

If that test does not exist yet in the surface you are working in, write it — it is a
dozen lines and it catches the whole class permanently. The previous build added one only
after a sweep missed eleven strings that happened to be wrapped across lines, which a
single-line regex could not see.
