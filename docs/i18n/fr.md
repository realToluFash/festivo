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
- iPhone, iPad, Android
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **18 Oct 2026. The power to change roles is « une personne qui peut modifier {{area}} »**
  (`rolesScreen.lockedLine`, `describeSeededReadOnly`), with « Membres et rôles » standing
  alone as a noun. A read-only twin keeps its editing line's words: « choisit ce qu'il
  permet » after `describeSeeded`'s « choisissez ce qu'il permet », and `describeCustom`
  without « Il peut être supprimé ». Role lines agree with « rôle », masculine (sc-2472).
- **18 Oct 2026. A role named in a sentence is « le rôle Propriétaire »** (`messages:roles.*`,
  sc-2150). The name stays a label after « le rôle », so nothing agrees with the person:
  « C'est la seule personne à avoir le rôle Propriétaire », never « le seul propriétaire »,
  which assumes a man. On the Roles screen itself the bare label stands, as in `ownerNote`.
  A role "holds" as « comprend », as in `lockedIntro_*`; "built-in" is « intégré »; "change"
  is « modifier » and "remove" « supprimer », as the grid and buttons say. "Leave it
  unassigned" is « ne l'attribuez à aucun membre », which avoids « personne… personne ».
  A refusal shared with a web key takes the web's French (`nameBlank`, `nameTaken`,
  `removeNoReplacement`).
- **18 Oct 2026. A length limit says what to do: « Raccourcissez le nom à {count} caractères
  maximum. »** (`messages:roles.name_too_long`, after en's "Shorten the name to {count}
  characters or fewer."). « N caractères maximum » is the form people read in every French
  form. The API catalogue has no plural family, and the limit (40) is always well above 1.
- **18 Oct 2026. Menu, Messages, Budget and Organisation stay as they are** on the Roles grid
  (`web:rolesScreen.area.*`): they are the French words, listed in `same-as-english.json`.
- **18 Oct 2026. The new-device email** (`emails:newDevice.*`): subject « Nouvelle
  connexion à Soirely », short for a phone inbox; the body makes the device the subject,
  « Un appareil qui ne s'était jamais connecté à votre compte Soirely vient de s'y
  connecter », as the English does since #125. Fact lines follow `twoFactorRecovery.fact.*`
  (« Quand : », « Appareil : »); "Network address" is « Adresse réseau », not « Adresse
  IP ». "From Security" becomes an act, « ouvrez Sécurité et déconnectez… », and the
  footer is « Vous recevez ce message parce que… », as in the other emails (sc-1283).
- **18 Oct 2026. The app as a device is « Application Soirely sur … ».** « Application
  Soirely sur iPhone », « … sur iPad », « … sur un téléphone Android », « … sur une
  tablette Android » (`devices.app*`, `password.device.app*`). « sur » as in `devices.agent`
  (« Safari sur iPhone »); « Application » rather than « appli » for the register; the
  article before « téléphone » and « tablette » because they name a kind of device, where
  iPhone and iPad are names (sc-1283).
- **18 Oct 2026. A device name is never the subject of an agreeing participle.** Device
  names are masculine (« Safari sur iPhone ») or feminine (« Application Soirely … »), so
  `devices.ended` reads « Appareil déconnecté : {{name}}. », agreeing with « Appareil »
  rather than « {{name}} est déconnecté » (sc-1283).
- **18 Oct 2026. "Sign out everywhere else" is « Déconnecter les autres appareils »**
  (`devices.everywhere`, its title with « ? »). The device is what is signed out, as in
  `devices.signOut`; « partout ailleurs » reads as places. Its confirm buttons follow the
  card's `end`/`keep`: « Le/Les déconnecter », « Le/Les laisser connecté(s) », and
  « Déconnecter les {{count}} » when this device goes too. "Nothing was signed out" is
  « Aucun appareil n'a été déconnecté ». "Whoever has it" is « la personne qui l'a », as
  in `devices.checkWarning`.
- **18 Oct 2026. A re-proof hint names the act, not the factor**: « Vous confirmerez
  d'abord que c'est bien vous » (`devices.everywhereHint`), because a Google or Apple
  account confirms with its provider, not a password.
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
  `waysCard.code`, `devices.everywhereCode`): it is the French word, listed in `same-as-english.json`.
