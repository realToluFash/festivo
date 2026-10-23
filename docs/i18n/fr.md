# French at Soirely

Kept by `/soirely-linguist`. Read it before writing a string in French, and add to it
whenever you decide something a second string will need.

## Variant and register

France French (fr-FR). _Vouvoiement_ throughout: "Veuillez…". France typography: a
non-breaking space, U+00A0, before `: ; ? !` and inside « guillemets », except in an SMS
(sc-2504, under Decided phrasings). The typographic apostrophe ’, U+2019, never the straight
', except in an SMS (sc-7455, under Decided phrasings).

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
| Primary (address, number) | Principale / principal  | Settled 18 Oct: agrees with noun |
| Other addresses, numbers  | Les autres adresses     | Settled 18 Oct: never secondaire |
| Phone number              | Numéro de téléphone     | Settled 18 Oct: any number       |
| Mobile number             | Numéro de portable      | Settled 18 Oct: the SMS field    |
| Remove (from the account) | Retirer                 | Settled 18 Oct: not Supprimer    |
| Linked (to an account)    | Associé                 | Settled 18 Oct: as `waysCard`    |
| Unverified                | À vérifier              | Settled 18 Oct: no agreement     |
| Account mail              | Les e-mails du compte   | Settled 18 Oct                   |
| Sign-in rules             | Règles de connexion     | Settled 19 Oct                   |

## Never translated

- Soirely
- iPhone, iPad, Android
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **23 Oct 2026. Ownership and leaving** (`ownership.*`, web and app,
  `messages:organisation.transfer_owner_required`, `emails:ownershipTransferred.*`, sc-7715).
  The act is « transférer la propriété », the organisation « cédée ». « Propriétaire » with no
  article is epicene, so « devenir propriétaire », « rester propriétaire » and « est désormais
  propriétaire » agree with nobody; with an article it is « le rôle Propriétaire » or « une
  personne ayant le rôle Propriétaire », never « le nouveau propriétaire ». "The new owner" is
  « la personne qui deviendra propriétaire », the legend « Transférer à », the email subject
  « Changement de propriétaire pour {organisation} ». Both people are told by « Un e-mail vous
  le confirmera, à vous et à {{name}} », never « chacun » or « tous les deux ». Deleted
  counts are all masculine (événements, invités, membres), so « seront supprimés » holds at
  any count; French `one` covers 0, « 0 événement », which is right.

- **21 Oct 2026. The apostrophe is ’, U+2019** (sc-7455), in every value of every catalogue,
  as France typography sets it and as a straight ' beside a curly one reads like a typo on the
  same screen. Type the character itself. The SMS (`emails:verification.text`, and any SMS
  string after it) keeps the straight ': ’ is outside GSM-7 and would send the message as
  UCS-2, at 70 characters a segment. ’ is also the safe one in an ICU string, where a straight
  ' is the quote character. Keys and markup quoting never change.
- **21 Oct 2026. A domain member paused** (`accessPaused.*`, `membersScreen.suspended*`,
  `restore*`, `emails:domainSuspended.*`, sc-6703). The person reads « En pause », the admins
  « Accès suspendu », as the English keeps them apart. Restoring is « rétablir ». Nothing
  agrees with the member: the removal is « son accès sera retiré », and the admins are told to
  « retirer cette personne ». Joining through a domain that closed is « n'accepte plus les
  adhésions via {{domain}} », as the setting's « Adhésion par domaine d'entreprise ». An
  address at a domain is « votre adresse {{domain}} ». "What happens next" is « La suite ».
  "Account settings" is « Paramètres du compte », button and sentence alike.
- **21 Oct 2026. Request link** (`requestLink.*`, `requestToJoin.*`,
  `messages:request_link.*`, `errors:request_link_dead`, `join_request_*`, sc-6460). The
  setting is « Demandes d'adhésion », so its state agrees: « Activées » / « Désactivées »; the
  link is « le lien d'adhésion », masculine (« Le garder »). The act stays « demander à
  rejoindre {{organisation}} », and the button alone « Demander l'accès », as domain joining.
  What waits is « votre demande d'adhésion », never « votre demande pour rejoindre » with no
  object. `formatDay` ends on « nov. », so a date never closes a sentence: « À partir du
  {{date}}, vous pourrez en faire une nouvelle. » « Message » is the same word as English.

- **21 Oct 2026. Creating an event** (`events.*`, `eventForm.*`, `eventPage.*`,
  `rolesScreen.createEvents*`, `messages:validation.event_*`, sc-6302). A draft is
  « Brouillon »; the form's legends « Début » and « Fin »; « Date » stays as in English
  (`same-as-english.json`). An end before the start is « L'événement se termine avant de
  commencer ». Before the organisation's name, « dans {{name}} » and « de l'organisation
  {{name}} », so no elision is due. An owner is « une personne ayant le rôle Propriétaire ».
  The permission's states are « Autorisé » / « Non autorisé », agreeing with the masculine
  default. A refused send closes « donc rien n'a été envoyé ».

- **21 Oct 2026. Two-factor for everyone** (`signInRules.everyone*`, `due*`, `overdue*`,
  `twoFactorCard.keptByRule`, `emails:signInRules.twoFactorDue.*`, sc-5702). "Require" is
  « exiger », as the server's errors; "for everyone" is « pour tous ». The date is « à partir
  du {{deadline}} » and « jusqu'au {{deadline}} », as `limitedBody`; `time.dateAt` ends on the
  zone, so no « oct.. » can follow. "Set it up" is « l'activer », as "turn on" in en. A person
  who must act is « chaque personne … elle », never « chacun », so the agreement follows
  « personne ». The overdue screen's body says why, « … et le délai pour l'activer est
  passé ». "Single-event access" is « vos accès à des événements précis ». The card and the
  server's refusal say the same sentence, with U+00A0 before the colon in both.

- **21 Oct 2026. Company domain joining** (`domainJoining.*`, `companyDomains.*`,
  `messages:domain_joining.*`, sc-4434). The act is « demander à rejoindre », the wait
  « En attente d'approbation », as the Members state. The approver is « une personne de
  l'organisation », who « valide votre demande », so nothing agrees with the person. Before an
  organisation's name, « par {{organisation}} » or « de {{organisation}} » only where no
  elision is due: « En attente de validation par {{organisation}} », never « de
  l'approbation de », which would need « d' » before a vowel. The setting is « Adhésion par
  domaine d'entreprise », « Activée » / « Désactivée »; a working domain « Ouvert aux
  demandes », a stopped one « Sans effet ». "… instead" is « … plutôt ».
  The button alone is « Demander l'accès » (`domainJoining.ask`), since « Demander à rejoindre »
  squeezed the organisation name beside it on the app phone (QA, sc-4434); its screen-reader
  label keeps « Demander à rejoindre {{organisation}} ».

- **21 Oct 2026. Members in the app** (`mobile:membersScreen.*`, sc-4259). The screen is
  « Membres »; a member is removed with « Retirer », as the glossary's Remove. A person's state
  never agrees with them: « Avec accès », « En attente d'approbation », « Accès suspendu »,
  « A quitté l'organisation », « Accès retiré », and in the row line « départ le {{date}} »,
  « accès retiré le {{date}} ». After a removal, « {{name}} ne fait plus partie de
  {{organisation}} » rather than « a été retiré ». Groups on the chips take the plural, « Tous »,
  « Suspendus », « Anciens ». "On their next request" is « dès sa prochaine utilisation de
  Soirely ». An owner in a sentence is « une personne ayant le rôle Propriétaire ».
- **21 Oct 2026. Invitations waiting on Complete your profile** (`completeProfile.*`, web and
  app, sc-4188). The invitation is the subject, « Une invitation vous attend », « {{count}}
  invitations vous attendent », shorter than « Vous avez … en attente ». With several, "that
  organisation" is « l'organisation qui vous invite ». A button in a sentence is chosen, as
  `proofExpired_*`: « Choisissez « Enregistrer et continuer » pour y accéder ». No `_many`
  yet: the key-parity guard refuses a form English lacks (sc-4188, [dev2]).

- **21 Oct 2026. Starting your own organisation** (`noOrganisation.start*`, web, and the app
  once sc-5932 adds it, sc-6897). "Start" is « créer », since « démarrer une organisation » is
  not French: the heading is « Créez votre propre organisation », the button « Créer
  l'organisation », as `createOrganisation.create`. The help and the derived-settings line are
  `createOrganisation`'s words, so both screens say the same.

- **21 Oct 2026. Creating another organisation** (`createOrganisation.*`, web and app, sc-3490).
  "You will be its owner" is « Vous y aurez le rôle Propriétaire », as « le rôle
  Propriétaire » elsewhere. A length refusal says what to do, « Raccourcissez-le à 100
  caractères maximum », as `rolesScreen.nameTooLong`. A path in Settings is « Paramètres >
  Général »; the button is « Créer l'organisation », with the article French wants.

- **21 Oct 2026. The organisation's language (sc-3311, `orgGeneral.language*`, web and app).**
  The label is « Langue », as the English "Language"; if English lengthens it to "Language
  for invitations", it becomes « Langue des invitations ». "Invitation emails" are « les e-mails d'invitation
  adressés aux personnes sans compte Soirely ». Language names are « Anglais, Espagnol,
  Français, Portugais » as options and lower case in a sentence (« partent désormais en
  anglais »). A refused save is « Rien n'a été enregistré. » and the server's
  `permission_required` words unchanged. The search field is « Rechercher une langue ».
- **21 Oct 2026. The re-proof's step two after a provider sign-in** (`waysCard.signedInWith`,
  `codeKeepsSignIn_*`, sc-2908). The status box is « Connexion avec {{provider}} réussie », a
  noun phrase because « Connecté » would have to agree with the person. Under the code field:
  « Un code incorrect ne vous renvoie pas vers {{provider}}. Votre connexion avec {{provider}}
  reste valable {{count}} minutes. », pairing with `proofExpired`'s « Votre connexion avec
  {{provider}} date de plus de … ». A window « reste valable », not « dure ».
- **19 Oct 2026. A `{{day}}` opens the sentence, never closes it** (`signInRules.changedBody`,
  web and app, sc-3030). `{{day}}` is « lundi 19 oct. », whose abbreviated month brings its own
  full stop, so a sentence ending on it reads « 19 oct.. ». It reads « Le {{day}},
  {{organisation}} a modifié ses règles de connexion. » The same goes for any later string
  with a short date. `errors:session_timed_out` is « Session fermée après une période
  d'inactivité. », as the sign-in screen's title, not « Vous avez été déconnecté », which
  agrees with a man.

- **19 Oct 2026. Sign-in rules are « Règles de connexion »** (`signInRules.*`, web and app,
  and `emails:signInRules.*`, sc-3030). A member held back by one « peut tout consulter, sans
  rien pouvoir modifier », the same words on the banner, the owner's preview and the email.
  A session that ends is « fermée », never « expirée »; its title names the session,
  « Session fermée par une règle de {{organisation}} », so nothing agrees with the person.
  Where a list of names is the subject (`effectStranded`'s `{{names}}`), the sentence opens
  « Concerne {{names}} : » and goes on with « on », so no verb has to agree with a count the
  string does not have. "Turn on two-factor" is « Activer la double authentification », as
  `twoFactorCard.turnOn`; "the shortest of your organisations" is « la plus stricte », since
  the shortest limit is the strictest rule. People who can manage are « les personnes qui
  peuvent gérer les membres, les rôles… », each noun with its article.

- **18 Oct 2026. One non-breaking space, U+00A0, before `: ; ? !` and inside « »** (sc-2504),
  so that a colon, a question mark or a closing guillemet never starts a line on a phone:
  « Quand : {when} », « « Mot de passe oublié ? » ». Never the narrow U+202F that the
  Imprimerie nationale prefers before `; ? !`: two invisible spaces are one too many to tell
  apart. Type the character itself, not an escape. The SMS (`emails:verification.text`, and
  any SMS string after it) keeps a plain space: U+00A0 is outside GSM-7 and would send the
  message as UCS-2, at 70 characters a segment. The diff cannot show the character, so a pull
  request lists each key's old and new text with it written as `U+00A0`.
- **18 Oct 2026. Verifying an alternative from Account** (`verifyEmail.doneBodyAlternative`,
  `verifyPhone.doneBodyAlternative`, `contacts.verifiedDone*`, `contacts.backToAccount`,
  `contacts.removeInAccount*`, web and app, sc-2594). The body says what did not change:
  « {{address}} est vérifiée. Elle ne deviendra votre adresse principale que si vous la
  définissez comme telle dans Compte. » (« Il … votre numéro principal … le définissez comme
  tel »), echoing the card's « Définir comme principale » (sc-2149). English's "alternative"
  has no French twin: « alternative » as an adjective is an anglicism, and « secondaire »
  ranks it, so the line names what it is not. The done line is « {{address}} est vérifiée. »
  / « {{number}} est vérifié. », as `doneBody`'s « est confirmée ». "Back to Account" is
  « Retour à Compte », the shape of « Retour à la connexion », the section a bare label as in
  « vérifiez Sécurité ». "Remove it in Account" is « La retirer dans Compte » / « Le retirer
  dans Compte », the infinitive of « Mauvais numéro ? Le changer », with « retirer » as the
  card says.
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
  maximum. »** (`messages:roles.name_too_long`, and `web:rolesScreen.nameTooLong` with
  `{{most}}`, so the screen and the server say one sentence; after en's "Shorten the name to {count}
  characters or fewer."). « N caractères maximum » is the form people read in every French
  form. The API catalogue has no plural family, and the limit (40) is always well above 1.
- **18 Oct 2026. Menu, Messages, Budget and Organisation stay as they are** on the Roles grid
  (`web:rolesScreen.area.*`): they are the French words, listed in `same-as-english.json`.
- **18 Oct 2026. Primary and other addresses (sc-113, `contacts.*`, `Account-*`).** As in
  the English: the primary signs in, the others only reach the person, « Les autres adresses
  servent à vous joindre, mais pas à vous connecter ». « Retirer », not « Supprimer »: the
  address leaves the account, it is not deleted. The cap reads the same in the card and from
  the server, « Un compte est limité à {{most}} adresses e-mail », a rule rather than a
  permission. Where one key serves both cards, write it so it needs no agreement:
  « À vérifier », « Vous avez retiré {{address}}. », « Soirely ne lui enverra plus rien »,
  « Ajout effectué. Reste la vérification : … », and the server's « Ces coordonnées ».
  Where no neutral form reads well (`verified`, `primary`, `makePrimary`, `removeConfirm`,
  `removeKeep`), the key holds the feminine for addresses and the number gets a key of its
  own (`verifiedPhone` « Vérifié », `primaryPhone` « Principal », `makePrimaryPhone`
  « Définir comme principal », `removeConfirmPhone` « Le retirer », `removeKeepPhone`
  « Le garder », sc-2149). Never « principal·e » or « Vérifié(e) ».
  The cap's `_one` reads « Vous pouvez encore ajouter une adresse » (« un numéro »), with no
  `{{count}}`, as the English does. French `one` also covers 0, but the cap line shows only
  while at least one is left: 0 left shows `capFullEmails`/`capFullPhones` instead
  (`ContactsCard`, `left > 0`). Do not put `{{count}}` back; the parity check wants the
  English's slots. New strings take U+00A0 before `: ; ? !`, as sc-2504 settles.
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
