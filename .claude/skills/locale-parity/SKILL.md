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

**The developer writes the English; the linguist writes the rest.** In a feature, put the
English text in all four catalogues, then leave a comment on the story:
`[l10n] (from dev)` followed by the keys added or reworded. The linguist files the
translation ticket (`soirely-linguist`, section 3), and `scripts/locale-status.mjs` finds any
key nobody mentioned. Rewording an English string leaves the other three alone. The sweep
marks them stale.

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

**A merge from main can bring back copy that main changed.** A conflict in a catalogue
resolved to the branch's side reverts main's wording. A test on the branch that asserts the
old string merges with no conflict at all and turns main red after it lands. So after every
merge of main, list what main changed and grep the branch for the old text:

```sh
git diff <base before the merge> origin/main -- '**/i18n/locales/en.json' | grep '^-  *"'
git grep -n "<each old string>" -- apps packages services
```

## Guest names

Never split a name to get a first name. Hosts type titles — Mr., Chief, Alhaji, Dr. —
and the first token of a guest's name is as likely to be a title as a name. Use the full
name, through whatever helper the client provides for it.

## Register

Each language's own guide is `docs/i18n/<locale>.md`, kept by the linguist. Formal
throughout, and consistent:

- English: British spelling, no contractions in error bodies — "cannot", not "can't"
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
