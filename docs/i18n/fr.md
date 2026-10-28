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

- **28 Oct 2026. L’événement commencé un autre jour** (sc-17870 pour sc-17853, `events.startedOn`
  web et `eventsScreen.startedOn` app). « A commencé le {{date}} · {{time}} {{timeZone}} », en
  paire avec `startedToday` (« Aujourd’hui · a commencé à… »). `{{date}}` est « mardi 27 oct. »,
  qui prend « le » ; le point de l’abréviation précède le « · », jamais une fin de phrase.
- **27 Oct 2026. Dupliquer un événement** (sc-15883 pour sc-3593, `web:eventDuplicate.*`).
  « Dupliquer » et « Créer le brouillon » ; le nouvel événement est « la copie » tant qu’il
  n’existe pas. Le panneau dit « Ce qui est copié » / « Ce qui n’est pas copié », car un
  participe seul devrait s’accorder avec chaque ligne. Length est « Durée ». Un refus commence
  par « Non créé. », comme « Non publié. ». Les heures et les minutes se joignent par « et »
  dans `hoursAndMinutes` (« 2 heures et 20 minutes ») ; la date prend « le {{end}} », et
  « Heures dans le fuseau {{timeZone}} », comme le formulaire.
- **27 Oct 2026. Les hôtes d’un événement** (sc-15427 pour sc-6713, `web:eventHosts.*`,
  `eventLive.needsHost*|addHosts` web et app, `messages:validation.event_host*`,
  `messages:event.host_required|last_host`). Host est « hôte », comme `errors:event_host_required` ;
  le mot ne prête pas à confusion, puisque les guests sont toujours « invités ». La section est
  « Hôtes », chaque ligne « Hôte {{position}} ». "Add who is hosting" est « Indiquer les hôtes ».
  Un hôte est un nom tel que les invités le lisent, parfois un couple sur une ligne, donc rien ne
  s’accorde avec {{name}} : « {{name}} figure déjà parmi les hôtes », « … ne figure plus parmi
  les hôtes », « {{name}} : position {{position}} sur {{count}} ». Retirer est « Retirer », comme
  le glossaire. La limite est la même phrase à l’écran et dans l’API. Le dernier hôte s’explique
  du côté des invités : « Les invités peuvent voir cet événement, il lui faut donc … ».
- **26 Oct 2026. Supprimer un événement** (sc-14417 pour sc-3592, `eventDelete.*` web et app,
  `messages:event.delete_name_mismatch`). Comme pour une organisation : « Supprimer
  l’événement », la fenêtre « Supprimer {{event}} ? », la sortie « Le conserver ».
  `mismatch` et l’API sont la même phrase. « Support » est « l’assistance Soirely », jamais
  « le support », et la date « jusqu’au {{deadline}} ». L’annonce est « L’événement {{event}}
  a été supprimé », le participe accordé avec « événement », jamais avec un nom de genre
  inconnu. La liste s’annonce « Pour toute votre équipe, cela supprime : », pour que rien ne
  s’accorde avec ce qui suit. "Details" est « informations », comme « Modifier les
  informations ». L’apostrophe est « droite » ou « courbe ». `failed` reprend `ownership.failed`.
- **26 Oct 2026. Le formulaire d’événement dans l’app** (sc-14367 pour sc-3595,
  `eventsScreen.newEvent|noneCreate`, `eventForm.searchType|timesIn|pickerDone|created|leaveBody`,
  `eventForm.venueSuggestionsBelow_*`). Le bouton qui valide un sélecteur de date ou d’heure est
  « OK », comme sur iOS, jamais « Terminé », qui est l’état d’un événement. Le titre de la feuille
  est « Heures dans le fuseau {{zone}} », comme `clocksSkip`. « Type » et « Date » sont les mêmes
  mots qu’en anglais (same-as-english.json). La recherche suit la règle « Rechercher un … » au
  singulier : « Rechercher un type d’événement ».
- **26 Oct 2026. En cours, terminer ou annuler un événement** (sc-14189 pour sc-3585,
  `events.happeningNow`, `eventsScreen.happeningNow`, `eventEnd.*` web et app,
  `eventEdit.schedule*`, `messages:event.already_over|schedule_concluded`). « En cours » dans
  la pastille. "End now" est « Terminer maintenant », comme l’état « Terminé » ; "Call
  off" est « Annuler l’événement », avec le nom, car un « Annuler » seul se lit comme le
  bouton qui ferme la fenêtre. La sortie est « Le maintenir » dans les deux fenêtres, le mot
  d’un événement « maintenu » plutôt qu’« annulé ». Un refus commence par « Non terminé. ».
  Les invités sont « les invités qui ouvrent leur lien ». `already_over` dit « il n’est
  donc plus possible d’y mettre fin », pour ne pas répéter « terminé ». `scheduleLocked` et
  `scheduleConcluded` sont la même phrase : le français n’a pas la contraction qui les
  distingue.
- **27 Oct 2026. Mettre en pause et reprendre un événement** (sc-15439 pour sc-3586,
  `eventPause.*` web et app). « Mettre en pause », comme l’état « En pause » ; « Reprendre » ;
  la sortie est « Le laisser publié ». Les refus : « Non mis en pause. », « Non repris. ». Le
  blocage dure « jusqu’à la reprise », sans verbe à accorder. "Check-in" est « l’accueil des
  invités ». Le résultat s’accorde avec « événement », jamais avec le nom : « L’événement
  {{name}} est de nouveau publié ».
- **26 Oct 2026. Publier un brouillon, et les états d’un événement** (sc-13956, sc-3584,
  `eventLive.*` web et app, `events.*`, `eventsScreen.*`, `messages:event.*`,
  `event.plan_limit`). "Make live" est « Publier », comme la permission « Créer, publier,
  suspendre et clore des événements ». Les états s’accordent avec « événement » :
  « Brouillon », « Publié », « En pause », « Terminé ». « En pause » plutôt que « Suspendu »,
  qui désigne déjà un accès suspendu. Un refus commence par « Non publié. », comme
  « Non enregistré. » ; le collègue est « quelqu’un d’autre ». La limite du forfait est la même
  phrase à l’écran et dans l’API, « Votre forfait {{plan}} permet d’avoir {{count}} événement
  publié ou en pause à la fois », « d’événements » au `many` ; `one` couvre 0. « Call off » est
  « annuler ».
- **26 Oct 2026. Le lieu de l’événement et la liste des événements dans l’app**
  (`web:eventForm.venue*`, `web:eventPage.venue*`, `addVenue`, `openInMaps`,
  `messages:validation.event_venue_*`, `mobile:eventsScreen.*`, sc-3589 and sc-1593 via
  sc-13205). Venue is « Lieu » (« Nom du lieu », « Lieu à confirmer », « Ajouter le lieu »),
  never « salle », which is only one kind of venue. "Open in maps" is « Voir sur une carte »,
  since no French user says « ouvrir dans Plans » for every maps app. The zone offer says « dans
  le fuseau {{zone}} », as the DST line does. "Type" for the event's type is the French word too,
  so `web:eventForm.type` is in `same-as-english.json`, with the app's `eventTypes.baby_shower`.
  The app's retry button is « Réessayer », as the web's.
- **26 Oct 2026. La couverture d’un événement** (sc-13587, `web:eventCover.*`,
  `messages:validation.cover_*`). La section s’appelle « Image de couverture », jamais
  « Couverture » seul, qui se lit comme une assurance ou une zone desservie ; le dialogue,
  « Photo de couverture ». « Importer une photo », pas « Téléverser », qui sonne québécois ;
  « Retirer la photo », comme le glossaire. Les tailles s’écrivent en Mo, « 15 Mo ». La ligne de
  l’événement créé, « L’événement a été enregistré sans sa photo. {{reason}} », se lit avec
  n’importe quel refus à la suite.
  Après un refus, les boutons du dialogue sont « Choisir une autre photo » et, cadre vide,
  « Choisir une photo » (sc-16573) : à l’infinitif, comme « Importer une photo » et « Utiliser
  cette photo », tandis que le refus lui-même s’adresse à l’impératif, « Choisissez-en une plus
  grande ».
- **26 Oct 2026. Le type d’événement** (`web:eventForm.type*`, `web:eventTypes.*`,
  `messages:validation.event_type_required`, sc-3588 via sc-13205). « Type », « Choisissez le
  type d’événement », et le refus, identique à l’écran et dans l’API, « Choisissez de quel type
  d’événement il s’agit. ». Birthday est « Anniversaire », donc anniversary est « Anniversaire de
  mariage » : deux « Anniversaire » dans la même liste ne se distinguent pas. « Remise de
  diplômes », « Cérémonie d’hommage » pour memorial, « Gala ou soirée caritative », « Événement
  d’entreprise ». « Baby shower » reste en anglais, l’usage en France (dans
  `same-as-english.json`) ; « fête prénatale » est québécois.

- **25 Oct 2026. A count of a round million, `_many`** (every web and app count family,
  sc-8529, now that the key-parity guard allows it, PR #324). At 1 000 000 and every exact
  million, i18next picks `_many`. It is `_other` with « de », or « d’ » before a vowel or a
  mute h, between the count and what it counts: « 1 000 000 de personnes », « d’événements »,
  « vos {{count}} d’autres appareils », « et {{count}} d’autres ». Where no noun follows the count
  (« les {{count}} seront déconnectés », « Déconnecter les {{count}} »), `_many` is `_other` as
  it stands. Every new count family gets its `_many`,
  except the proof window's lines (`waysCard.proveLink_*`, `proveUnlink_*`, `codeKeepsSignIn_*`):
  they count PROOF_MINUTES, a constant that is never a million, and the app's test holds them to
  `_one` and `_other`.
- **25 Oct 2026. Settings > Members on the web, the invitation link and the invitation email**
  (`web:membersScreen.*`, `web:join.*`, `invitations.*` web and app, `emails:invitation.*`,
  `messages:invitations.*`, sc-2922). The web twins of the app’s Members keys are the app’s
  words, except where they put « à » or « de » straight before {{organisation}}: the web’s
  `removeBody`, `removeConfirmBody`, `removed`, `removeButton` and `empty.suspended.body` say
  « l’organisation {{organisation}} », keeping every slot English has (the parity guard counts
  them, so « y » cannot stand in for a second {{organisation}}), and the app’s are swept when
  next touched. An invitation is feminine and its states agree with it: « En attente »,
  « Expirée », « Retirée » (revoked and withdrawn alike), « Refusée », « Acceptée »,
  « Supprimée »; "Revoke" is « Retirer ». "Works until" is « Valable jusqu’au {{date}} ».
  Joining is « rejoindre {{organisation}} », or « rejoindre l’organisation » where no name
  follows; the progress is « Adhésion en cours… ». "Whoever invited you" is « la personne à
  l’origine de l’invitation », so nothing agrees with the reader. The subtitle names its
  counts after a colon, « avec accès : {{active}} · invitations : {{invited}} », so nothing
  agrees with a count. History lines name what was acted on, « Invitation envoyée par »,
  « Demande approuvée par », « Accès suspendu / rétabli / retiré par ». Who sent an invitation is « Invitation envoyée par {{inviter}} », never « Invitation de », which needs « d’ » before a vowel-initial name (QA, 26 Oct); the reader as sender is « envoyée par vous ». Nothing agrees with the reader: « {{inviter}} le saura », « Vous utilisez le compte {{signedInAs}} ». « Invitation »,
  « Invitations » and « {{count}} invitation(s) » are the French words, in
  `same-as-english.json`.
- **25 Oct 2026. Deleting an organisation** (`errors:owner_required`,
  `messages:organisation.owner_required`, `delete_name_mismatch`, `emails:organisationDeleted.*`,
  sc-3215). The refusals name the role, « Seule une personne ayant le rôle Propriétaire… », as
  `transfer_owner_required`. `delete_name_mismatch` is `ownership.deleteMismatch` word for
  word. The subject is « L’organisation {organisation} a été supprimée », so the participle
  agrees with « organisation », never with a name of unknown gender. Support is « l’assistance
  Soirely », as decided on 24 Oct, on the screen (`ownership.deleteWindow`, sc-13315) as in the
  email; never « le support ». Restoring a deleted organisation is
  « restaurer », as on that screen; « rétablir » stays for access. The footer says « vous étiez
  membre ».
- **25 Oct 2026. The API's refusals** (`messages:*`, sc-10809). An HTTP request is « la
  requête », kept apart from « la demande », which is a request to join or a recovery request;
  an API path is « cette URL ». An id is « cet identifiant »: « Aucune session ne porte cet
  identifiant. » Field names an integrator sends (`idToken`, `code`, `recoveryCode`,
  `If-Match`, `context`, the assistant's roles) stay as written, in straight quotes where the
  English quotes them, since they are code; "system prompt" stays English. Where a screen says
  the same sentence (`lostTwoFactor.*`, `signIn.timedOutBody_*`, the lock-outs' « Réessayez à
  {time} »), the refusal says it too.
- **25 Oct 2026. A time the clocks skip** (`eventForm.clocksSkip`, `clocksSkipNextDay`,
  sc-10675). « Le {{day}}, l’heure {{time}} n’existe pas dans le fuseau {{zone}} : c’est la
  nuit du passage à l’heure d’été. Elle sera remplacée par {{savedAs}}. » The next-day line ends
  « remplacée par le {{savedDay}} à {{savedAs}}. », so the short date never closes the sentence
  (the 19 Oct rule). « Passage à l’heure d’été » is what a French reader calls that night, in
  either hemisphere; rejected « les horloges avancent », a calque. « Elle » is « l’heure », so
  nothing agrees with the person or the field.
- **25 Oct 2026. Editing an event's details (sc-9704, `eventEdit.*`).** "Edit details" is
  « Modifier les informations », never « détails »; "Save changes" « Enregistrer les
  modifications ». A refused save starts « Non enregistré. »; the colleague is « quelqu’un
  d’autre », as `errors:precondition_failed`. What was typed is « ce que vous avez saisi ».
  After a save the live region says « Modifications enregistrées », not a bare « Enregistré ».
  The currency refusal is one sentence in `web` and `errors`, « … pour cet événement ».
- **24 Oct 2026. Suspending a member by hand and restoring them** (`membersScreen.suspend*`,
  `restore*`, `seats*`, `emails:memberSuspended.*`, `memberRestored.*`, `messages:members.*`,
  sc-8735). « Suspendre {{name}} », « Rétablir l’accès ». What is suspended is « l’accès », so
  nothing agrees with the member: « L’accès est suspendu pour {{name}} », « Un accès suspendu
  n’occupe pas de place », « Seul un accès actif peut être suspendu ». The organisation is
  « l’accès à l’organisation {{organisation}} » or « dans {organisation} », never « à » before
  the slot. A team seat is « place d’équipe » of « le forfait », as `errors:team_seats_in_use`.
  "An administrator of" in the email is « une personne qui administre l’organisation … »,
  which also covers owners. The email facts read « Date de suspension » and « Date de
  rétablissement ». `ownerNoSuspend` and `members.suspend_owner` open on the same sentence.
- **24 Oct 2026. The claim that lapsed** (`emails:ownerClaim.lapsed.*`, sc-9219). "Lapse" is
  « expirer », as the web. The subject leads with the outcome, « Demande expirée : {organisation} »
  (U+00A0 before the colon), as sc-14100: the whole sentence ran to 620px in a 272px inbox row
  (QA, 26 Oct). The heading keeps « {claimant} ne deviendra pas propriétaire de l’organisation
  {organisation}. La demande a expiré »: « propriétaire » with no article agrees with nobody. Each reason ends « la propriété n’a donc pas été
  transférée »; the date « Expirée le {deadline} », as « Retirée le ».
- **24 Oct 2026. The rest of a role's holders** (`rolesScreen.moreHolders_*`, web and app,
  sc-9068). « et {{count}} autre », « et {{count}} autres », after the five names: « autre »
  is the same for women and men, and reads as people where « de plus » reads as a quantity.
  `_many`: « et {{count}} d’autres » (25 Oct).
- **24 Oct 2026. A request refused for its shape** (`messages:validation.invalid_shape`,
  `validation.request_shape`, sc-8716). « Ce champ n’accepte pas cette valeur », which also
  holds for a required field left out, then « Vérifiez-le et réessayez », the pronoun for the
  field. The 422 `detail` speaks of « les données envoyées », not « la requête », which is jargon.
- **24 Oct 2026. Withdrawing your own claim** (`ownerClaim.withdraw*`, `youWithdrew*`,
  `emails:ownerClaim.withdrawn.*`, `messages:owner_claims.not_claimant`, sc-8556). The claimant
  « retire » sa demande ; anybody else « arrête » une demande. Button « Retirer ma demande »,
  confirm « Retirer votre demande ? » with « Retirer » / « Maintenir ma demande »; pending is
  « Retrait en cours », as « Vérification de l’enregistrement ». "You included" is « vous y
  compris », which agrees with nobody. The email is « sa demande de propriété pour
  {organisation} », as the stopped email, and ends « Personne n’en est devenu propriétaire ».
- **24 Oct 2026. Getting an owner back** (`ownerClaim.*`, web and app, `emails:ownerClaim.*`,
  `messages:owner_claims.*`, `errors:owner_claim_*`, sc-8216). "Become the owner" is « devenir
  propriétaire », with no article, so it agrees with nobody; "has an active owner" is « une
  personne ayant le rôle Propriétaire est déjà en fonction ». The claim is « la demande », and
  a claimant's is « la demande faite par {{claimant}} », never « de {{claimant}} ». A domain
  takes « une adresse {{domain}} » and « du domaine {{domain}} », for the same elision.
  "Soirely support" is « l’assistance Soirely », as the drafted errors; restoring is
  « rétablir ». « Type » stays as in English (`same-as-english.json`). Members is « Membres ».
- **24 Oct 2026. The only owner left suspended** (`accessPaused.stillOnlyOwner`,
  `membersScreen.suspendedOnlyOwner`, `onlyOwnerNotRemovable`, `onlyOwnerRestoreNeedsAddress`,
  `history.suspendedAddressGone`, sc-7831). As `emails:domainSuspended.keptOnlyOwner`: « la
  seule personne ayant le rôle Propriétaire dans {{organisation}} ». What is not removed is the
  person, from the organisation, never « son accès » (under « Retirer de … » and « Votre accès
  … est en pause » that reads as access not taken away). Nothing agrees with the member:
  « cette personne ne peut donc pas être retirée de l’organisation », « cette personne garde ce
  rôle et reste membre de l’organisation », and to the owner « vous en restez donc membre ».
  The history line is « Accès suspendu : son adresse e-mail professionnelle ne lui ouvre plus
  l’accès », « ne donne plus accès » would say « accès » twice.
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
  any count; French `one` covers 0, « 0 événement », which is right. A slot
  appears once per key (the parity guard counts them), so `transferred` closes « … envoyé aux
  deux comptes », not a second {{name}}.

- **21 Oct 2026. The apostrophe is ’, U+2019** (sc-7455), in every value of every catalogue,
  as France typography sets it and as a straight ' beside a curly one reads like a typo on the
  same screen. Type the character itself. The SMS (`emails:verification.text`, and any SMS
  string after it) keeps the straight ': ’ is outside GSM-7 and would send the message as
  UCS-2, at 70 characters a segment. ’ is also the safe one in an ICU string, where a straight
  ' is the quote character. Keys and markup quoting never change.
- **21 Oct 2026. Approving or turning down a request to join** (`membersScreen.awaiting.*`,
  `membersScreen.history.turnedDown`, `requestExpired`, `emails:joinRequest.*`,
  `messages:members.request_answered`, sc-7217). "Approve" is « Approuver », matching « En
  attente d’approbation »; "turn down" is « Refuser », and what is refused is « la demande »,
  never the person: « Refuser la demande de {{name}} ? », « Refuser la demande de {{name}} », « Demande
  refusée par {{by}} ». A request nobody answered is « retirée faute de réponse ». A role
  given on approval is « avec le rôle {{role}} », so nothing agrees with the person; the
  person refused « ne fait donc pas partie de l’organisation », never « n’a pas été ajouté ».
  The waiting email’s count takes `many`, « 1 000 000 de personnes ».
- **24 Oct 2026. Who did it, in a history line** (`membersScreen.byYou`, `membersScreen.someone`,
  sc-7217, from QA). Both fill `{{by}}` after « par » : the reader is « vous » (« Demande refusée par
  vous »), and a person who has since left is « une personne qui n’est plus membre ».
- **24 Oct 2026. No « à » or « de » straight before {organisation}** (sc-7217, from QA). A
  name that opens on an article reads « à Les Événements… », where French wants « aux ».
  Take a verb that needs no preposition, with the organisation as its object: « sa demande
  pour rejoindre {{organisation}} » (« demande d’adhésion » alone, with no object, stays); or
  name it: « les membres de l’organisation {organisation} »; « chez {organisation} » also
  holds. Older strings that still read « à {{organisation}} » are swept as they are touched.

- **21 Oct 2026. A domain member paused** (`accessPaused.*`, `membersScreen.suspended*`,
  `restore*`, `emails:domainSuspended.*`, sc-6703). The person reads « En pause », the admins
  « Accès suspendu », as the English keeps them apart. Restoring is « rétablir ». Nothing
  agrees with the member: the removal is « son accès sera retiré », and the admins are told to
  « retirer cette personne ». Joining through a domain that closed is « n'accepte plus les
  adhésions via {{domain}} », as the setting's « Adhésion par domaine d'entreprise ». An
  address at a domain is « votre adresse {{domain}} ». "What happens next" is « La suite ».
  "Account settings" is « Paramètres du compte », button and sentence alike.
  24 Oct (qa2, #8038): no « de » stands before {{organisation}} or {{name}}, which may open on a
  vowel. The organisation is « de l’organisation {{organisation}} », or « à » and « dans »; a
  person is the subject (« {{name}} a de nouveau accès à », « {{name}} n’a plus d’adresse »)
  or « pour {name} ». The email opens « L’accès à {organisation} est en pause pour {name} »,
  its subject on the pause, « Accès en pause : {name} dans {organisation} », so a phone inbox
  shows it before the names. The admins' label is « Accès suspendu : domaine d’entreprise »
  for all three reasons, as the setting. The member's history line
  (`history.suspendedAddressGone`, sc-8868) is the label's words, whatever the reason.
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

- **26 Oct 2026. Two-factor for everyone, the artboard's lines** (sc-13182,
  `signInRules.everyoneOn`, `everyoneOff`, `everyoneWithoutBody_*`, `everyoneStillWithout_*`,
  `emails:signInRules.twoFactorDue.*`). A banner is « un bandeau ». Their deadline is « sa
  date limite », and the email's facts label it « Date limite », since « Obligatoire à partir
  du » cannot stand before a colon. "Turn it on once" is « Vous ne l’activez qu’une fois ».

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
  squeezed the organisation name beside it on the app phone (QA, sc-4434). Its screen-reader
  label starts with the same words, « Demander l’accès à {{organisation}} », so the name a
  voice-control user says is the one they see (WCAG 2.5.3, sc-8863). Any label beside a
  shortened button begins with that button's words.

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
  `proofExpired_*`: « Choisissez « Enregistrer et continuer » pour y accéder ». `_many` as the
  25 Oct entry says.

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
- **24 Oct 2026. A running count reads « Caractères : N sur M »** (sc-6302,
  `eventForm.nameCount`). « N caractères sur M » misagrees at 0 and 1, which French counts
  as one. With the noun as a label first, nothing has to agree with N, so the key needs no
  `_one` form even though it is passed `count`. Use the same shape for a counter with no
  plural; a counter that is passed `count` may still take plural forms where they read better.
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
- **25 Oct 2026. Moving the people off a removed role** is worded so it reads for one person
  or many, because the button and the refusal get no {{count}} : « Réattribuer et supprimer
  {{role}} », and « Choisissez le rôle de remplacement », the legend’s own noun. Not « Les
  passer… » or « ces personnes » after « 1 personne a ce rôle. La passer à : » (sc-13017).
  The line under the chosen role, `rolesScreen.removeAfter`, takes the role as subject :
  « Le rôle {{role}} s’applique dès la prochaine utilisation de Soirely », not « Elles deviennent… » (sc-14755).
- **26 Oct 2026. The beyond-grant line names access** (`membersScreen.beyondGrant`, sc-13089). « … vous ne pouvez donc modifier ni son rôle ni son accès » : after « cette personne », « son accès » is hers; it rules out restoring on the suspension cards.
- **27 Oct 2026. An event's dates are « le calendrier », never « le programme »** (`timeline.*`,
  sc-15756). « Programme » is the organiser's Schedule (epic 33); the list of an event's dates
  is « Calendrier complet », its panel « Prochaines dates ». Distances follow the date :
  « aujourd’hui », « dans 3 jours », « il y a 2 jours ». The API titles keep the name as
  subject, « {name} commence », « {name} se termine », so no « de » has to elide before it.
- **27 Oct 2026. Les onglets de l’accueil Événements et leurs états vides** (sc-15981 pour
  sc-3594, `events.*`, `eventsScreen.*`). Les onglets sont « À venir », « Brouillons » et
  « Passés ». « Make live » reste « publier » ; « Called off on » est « Annulé le {{date}} ».
  « Next up » est « Prochaine étape », comme `timeline.nextUp`, et l’état vide des événements à
  venir le reprend. Le décompte annoncé dit « supplémentaire(s) », « d’événements » au `many`.
  `moreFailed` reprend la seconde phrase de l’échec de chargement de son écran, comme en anglais.
- **28 Oct 2026. The two-factor-due subject opens on the deadline**
  (`emails:signInRules.twoFactorDue.subject`, sc-15219) : « Avant le {deadline} : double
  authentification dans {organisation} ». With the feature first a 390 px inbox lost the time
  (qa2, #18836); « Avant le » takes 9 characters, so the date and time show at 360 px. A
  subject whose news is a deadline opens on it; the rest keep the feature first.
- **27 oct. 2026. La page des informations nomme la règle, pas le rôle** (sc-16443 pour
  sc-16265, `orgGeneral.readOnlyUntil*`, `refusedByRule`). Chaque ligne reprend la règle dans
  les mots du bandeau (`signInRules.unlinkedBody`, `gateBody`, « n’accepte que » sans « plus »)
  et finit comme `orgGeneral.readOnly` : « vous pouvez voir ces informations mais pas les
  modifier ». Un enregistrement refusé par la règle dit seulement « Rien n’a été enregistré. »,
  le début de `refused`.
- **27 oct. 2026. Le jalon d’un événement annulé** (sc-16725 pour sc-16709,
  `messages:timeline.event_called_off`). « Annulation : {name} », un nom, donc sans accord avec
  un nom d’événement dont on ignore le genre. Les deux-points, avec U+00A0 avant, plutôt que le « Annulation de »
  convenu avec le pm : « de » devant un nom qui commence par une voyelle ou un article
  (« de Anniversaire », « de Le Gala ») se lirait mal, et le code ne peut pas élider.
- **27 oct. 2026. Un décompte de suppression qui échoue** (`ownership.deleteUncounted`,
  `ownership.deleteRetry`, web et app, sc-16928 pour sc-16866). « Impossible de calculer son
  contenu », comme « Calcul de son contenu… » (`deleteLoading`). « Si vous la supprimez », puis
  « restaurer » et « l’assistance Soirely », comme `deleteWindow`, avec un délai fixe
  « pendant 30 jours ». Le bouton est « Réessayer », comme ailleurs.
