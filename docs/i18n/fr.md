# French at Soirely

Kept by `/soirely-linguist fr`. Read it before writing a string in French, and add to it
whenever you decide something a second string will need.

## Variant and register

France French (fr-FR). _Vouvoiement_ throughout: "Veuillez…". France typography: a
non-breaking space before `: ; ? !` and inside « guillemets ».

The rules every locale shares are in `.claude/skills/locale-parity`.

## Glossary

One way to say each recurring thing, everywhere. Seeded from the catalogues as they stood on
17 October 2026; the linguist reviews each row and marks it settled in Notes.

| English                   | French                  | Notes |
| ------------------------- | ----------------------- | ----- |
| Settings                  | Paramètres              |       |
| Organisation              | Organisation            |       |
| Sign in                   | Se connecter            |       |
| Sign out                  | Déconnecter             |       |
| Email                     | Adresse e-mail          |       |
| Password                  | Mot de passe            |       |
| Continue                  | Continuer               |       |
| Cancel                    | Annuler                 |       |
| Two-factor authentication | Double authentification |       |
| Recovery code             | Code de récupération    |       |

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **17 Oct 2026. Signing out is immediate; no delay is promised.** "Tous vos autres
  appareils ont été déconnectés." (password-changed email, after #110's "Every other
  device"; "Tous" carries the "every"). Since sc-117 an ended
  session stops at once, so no string may say a device "peut continuer à fonctionner".
- **17 Oct 2026. "Il devra se reconnecter pour continuer"** for a device the person signs
  out (`devices.signInAgain`). The device is the subject, as in `devices.ended`. Since
  #110 the check is about the people using it: "vérifiez d'abord que personne ne s'en sert
  pendant un événement", not "au milieu d'un événement", which reads as being physically in
  one.
- **17 Oct 2026. "Code" stays "Code"** as a field label (`twoFactor.code`,
  `waysCard.code`): it is the French word, listed in `same-as-english.json`.
