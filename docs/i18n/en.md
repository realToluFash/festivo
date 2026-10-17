# English at Soirely

Kept by `/soirely-linguist en`. Read it before writing a string in English, and add to it
whenever you decide something a second string will need.

## Variant and register

British English (en-GB). Plain, warm and direct. No contractions in error bodies: "cannot",
not "can't". British spelling: organisation, cancelled, colour. Sentence case for every
label and heading.

The rules every locale shares are in `.claude/skills/locale-parity`.

## Glossary

One way to say each recurring thing, everywhere. Seeded from the catalogues as they stood on
17 October 2026; the linguist reviews each row and marks it settled in Notes.

| Term                      | Notes                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Settings                  |                                                                                                                          |
| Organisation              |                                                                                                                          |
| Sign in                   |                                                                                                                          |
| Sign out                  |                                                                                                                          |
| Email                     |                                                                                                                          |
| Password                  |                                                                                                                          |
| Continue                  |                                                                                                                          |
| Cancel                    |                                                                                                                          |
| Two-factor authentication |                                                                                                                          |
| Recovery code             |                                                                                                                          |
| Carry on                  | Settled 17 Oct 2026: "… to carry on" is the house phrase for resuming (20 strings). Not "continue", which is the button. |
| Signed out (a device)     | Settled 17 Oct 2026: "is signed out" for the state, "has been signed out" in emails. Never "logged out".                 |

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **17 Oct 2026. Marking paid refused (sc-88, shown on sc-1331's "Due now" sheet).**
  "{{name}} has already marked this paid, so nothing has changed." (no name: "This has already
  been marked paid, so nothing has changed."); "This payment has been cancelled, so it cannot be
  marked paid."; "Enter the amount in {{currency}}, the currency this event uses."; "The date paid
  cannot be in the future. Choose today or an earlier date."; "Payments cannot be marked paid on
  this organisation's plan, so nothing has changed." Won over "… a moment ago", which the server
  cannot know. "So nothing has changed" is the house close for a refused change. Never ask for
  an upgrade in a refusal.
- **17 Oct 2026. "From the reminder sent {{date}} · {{payments}} across {{count}} events"**
  (sc-1331 subline). Two counts take two plural keys, and the one-event form drops "across 1
  event". "1 payment" keeps its numeral because it is a count line, not prose.
- **17 Oct 2026. "Your {{provider}} sign-in was more than {{count}} minutes ago, so nothing
  has changed yet. Continue with {{provider}} again to carry on."** (`waysCard.proofExpired_*`,
  web and mobile). A past sign-in is something that "was … ago", not something "… old".
  "Nothing has changed yet" says the requested change is still waiting, not lost. The `_one`
  form reads "more than a minute ago". Asked on sc-510; the keys are with [dev].
- **17 Oct 2026. "Your other device is signed out." / "Your {{count}} other devices are signed out."**
  (`web:devices.everywhereDone_*`, matching `passwordCard.done_*`). A `_one` form names no
  number: "your 1 other device" reads as a machine wrote it. The same goes for
  `devices.everywhereBody_one`. The slot parity guard compares a key across all four
  catalogues, so dropping `{{count}}` from a `_one` form is a [dev] change to all four at once
  (asked on sc-1193).
- **17 Oct 2026. "Asks you to confirm it is you first."** (`web:devices.everywhereHint`). Won
  over "Asks for your password first", which is untrue for an account that signs in only with
  Google or Apple. Name the act of confirming, not the factor, wherever the factor varies.
  The key changes with its test, so it is with [dev] on sc-1193.
- **17 Oct 2026. "Every other device has been signed out."** (`emails:password.changed.devices`,
  and `recovery.changed.body` already uses it). Won over "Your other devices have been signed
  out", which assumes there were some: the email goes even when none were signed in.
- **17 Oct 2026. "… so first check that nobody is using it at an event."** (`web:devices.signInAgain`).
  Won over "check it is not in the middle of an event": a person is at an event, not a device,
  and "in the middle of" does not translate cleanly.
- **17 Oct 2026. "was {{name}}" for a time zone's former name** (`timeZone.was`,
  `timeZone.countryWas`: "India · was Calcutta"). Kept over "formerly", which is clearer but
  nearly three times as long on a phone row that already carries the country. Each locale
  writes its own natural word (es/pt "antes", fr "anciennement"); the name is always the slot.
- **17 Oct 2026. "Choose the country code, then type the number any way you like."**
  (`verifyPhone.numberHelp`). Settled as written by PM on sc-945; it is true for every way the
  code can start, and es/pt already read naturally from it.
