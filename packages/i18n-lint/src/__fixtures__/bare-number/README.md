# bare-number

Deliberately broken. A number written as bare digits: in French on the i18next
catalogue (`{{count}}`, `{{most}}`), in Spanish on the ICU one (`#` and a plain
`{minutes, number}`, which ignore CLDR's minimum grouping, and a `#` behind an
emoji, which takes two UTF-16 units), and in Portuguese on
Symfony's plain one, which swaps `{minutes}` in as it is. `{{number}}` and
`{code}` name rather than count, and pass, as does a `#` outside a plural
(`/settings#two-factor`).

Used by parity.test.ts to prove the check fails, because a guard nobody has
watched fail is a guard nobody should trust.
