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

| English                   | French                  | Notes                            |
| ------------------------- | ----------------------- | -------------------------------- |
| Settings                  | Paramètres              | Settled: also the app's tab      |
| Home                      | Accueil                 | Settled: the app's tab           |
| Account / Security        | Compte / Sécurité       | Settled: section names           |
| Ways to sign in           | Moyens de connexion     | Settled                          |
| Signed-in devices         | Appareils connectés     | Settled                          |
| Start again               | Recommencer             | Settled                          |
| Organisation              | Organisation            | Settled: section name, same word |
| Sign in                   | Se connecter            |                                  |
| Sign out                  | Déconnecter             |                                  |
| Email                     | Adresse e-mail          |                                  |
| Password                  | Mot de passe            |                                  |
| Continue                  | Continuer               |                                  |
| Cancel                    | Annuler                 |                                  |
| Two-factor authentication | Double authentification | Settled: also "two-factor" alone |
| Recovery code             | Code de récupération    |                                  |

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **17 Oct 2026. "Vous êtes connecté", masculine as the generic form** (`home.signedIn`,
  `settings.signedInAs`, as in `nav.signedInAs` and "Vous restez connecté"). The code has
  no gender for the person, and « connecté·e » breaks screen readers. Ask `[dev]` for a
  slot if a string ever needs to agree.
- **17 Oct 2026. Status marks agree with « demande »**: Annulée, Confirmée, Refusée,
  Terminée, Remplacée. A new mark on the recovery request is feminine singular, one word.
- **17 Oct 2026. The daily recovery limit reads « 3 fois par jour »** (`limitedBody`).
  `replacedNote` says « Cela compte parmi les 3 demandes que vous pouvez faire par jour »
  so that both lines give the same limit.
- **17 Oct 2026. A button named in a sentence is quoted by its French label** in
  guillemets: « Choisissez de nouveau « Continuer avec {{provider}} » » (`proofExpired_*`).
  The person has to find it on the screen.
- **17 Oct 2026. A slot with no plural form** (`messages:proof.required`'s `{minutes}`) is
  written so it reads at the value it carries: « dans les {minutes} dernières minutes ».
- **17 Oct 2026. Section names stand alone as nouns** in running text: « Compte réunit… »,
  « Sécurité réunit… » (`settings.chooseLine`), « Organisation réunit les réglages de
  {{name}} » (`settings.chooseLineWithOrganisation`), « vérifiez Sécurité » (emails).
- **17 Oct 2026. A picker's search field reads « Rechercher un/une … »** in the singular:
  « Rechercher un pays », « Rechercher une devise », « Rechercher un fuseau horaire ».

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
