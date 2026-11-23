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

| English                   | French                                 | Notes                            |
| ------------------------- | -------------------------------------- | -------------------------------- |
| Settings                  | Paramètres                             | Settled: also the app's tab      |
| Home                      | Accueil                                | Settled: the app's tab           |
| Account / Security        | Compte / Sécurité                      | Settled: section names           |
| Ways to sign in           | Moyens de connexion                    | Settled                          |
| Signed-in devices         | Appareils connectés                    | Settled                          |
| Start again               | Recommencer                            | Settled                          |
| Organisation              | Organisation                           | Settled: section name, same word |
| Sign in                   | Se connecter                           |                                  |
| Sign out                  | Déconnecter                            |                                  |
| Email                     | Adresse e-mail                         | Settled 29 Oct: plain hyphen     |
| Password                  | Mot de passe                           |                                  |
| Continue                  | Continuer                              |                                  |
| Cancel                    | Annuler                                |                                  |
| Two-factor authentication | Double authentification                | Settled: also "two-factor" alone |
| Recovery code             | Code de récupération                   |                                  |
| Primary (address, number) | Principale / principal                 | Settled 18 Oct: agrees with noun |
| Other addresses, numbers  | Les autres adresses                    | Settled 18 Oct: never secondaire |
| Phone number              | Numéro de téléphone                    | Settled 18 Oct: any number       |
| Mobile number             | Numéro de portable                     | Settled 18 Oct: the SMS field    |
| Remove (from the account) | Retirer                                | Settled 18 Oct: not Supprimer    |
| Linked (to an account)    | Associé                                | Settled 18 Oct: as `waysCard`    |
| Unverified                | À vérifier                             | Settled 18 Oct: no agreement     |
| Account mail              | Les e-mails du compte                  | Settled 18 Oct                   |
| Sign-in rules             | Règles de connexion                    | Settled 19 Oct                   |
| Try again (button)        | Réessayer                              | Settled 1 Nov, sc-26974          |
| Owner / Admin / Member    | Propriétaire / Administrateur / Membre | Settled 5 Nov, sc-29914          |

- **22 nov. 2026. Le code de l’invité pour l’entrée et le scanner à la porte** (sc-80603 pour sc-1301, `web:guest.door*`, `mobile:checkIn.scan.*`, `ios.NSCameraUsageDescription`). Ce que l’invité présente est « votre code pour l’entrée », jamais « code d’accès », qui est celui de l’équipe (sc-72). Scan se dit **scanner** (verbe et nom). Screenshot est **capture d’écran**. Camera est **appareil photo**, le mot d’iOS et d’Android. Un accompagnant held à la porte est « En attente · jusqu’à ce que l’invitation soit acceptée », comme `guestList.heldLine`, sans accord avec l’hôte. Settings est ici l’app de l’appareil : iOS dit Réglages et Android Paramètres, donc « les réglages de l’appareil » en minuscules, comme `notificationSettings.openSettings`. Waiting to sync est **en attente de synchronisation**. `doorLine` n’a pas de pluriel et s’affiche avec un ou plusieurs accompagnants, donc il ne compte pas : « toute personne qui vous accompagne », jamais « vos accompagnants ».
- **22 nov. 2026. Les liens de l’e-mail de rappel de paiement** (sc-83676, qa5 #83675 sur sc-78562, `messages:payment_reminder.email.link`). « {label} : {url} », espace insécable avant le deux-points, comme `eventChanges.email.link` : toute ligne « libellé : lien » d’un e-mail la prend. Seul un SMS s’en passe.
- **22 nov. 2026. Voir les choix : l’hôte voit les choix et choisit à la place d’un invité** (sc-4042 pour sc-3909, `web:seePicks.*`). Needs the host est **« En attente de l’hôte »** et Kitchen’s choice **« Au choix de la cuisine »** : deux noms d’état, entre guillemets dans une phrase, que la fiche cuisine (sc-3911) reprendra. Not chosen est « Sans choix », comme « Sans choix de menu », et Skipped « Sans ce service », jamais « Sauté », qui se lit en cuisine. The room est **la salle**, le total des personnes qui viennent : « 50 % de la salle », espace insécable avant %. Les décomptes en « sur » sont des étiquettes (« Choix reçus : 2 sur 4 », « Réponses : 2 sur 4 »), car la clé n’a pas de pluriel. {{course}} arrive tel que l’hôte l’a saisi, d’où « pour le service « {{course}} » » dans une phrase, sans guillemets en tête d’étiquette ; dans `blank`, il arrive en minuscules et suit `guestMeal.chooseName` (« en {{course}} »). {{name}} ne suit jamais « de » : « Réponse envoyée par {{name}} », « Selon sa fiche, {{name}} est allergique à : », « ce qui est noté pour {{name}} ». Ce qui est exclu se dit « Contient ce à quoi {{name}} est allergique : {{allergens}} », sans genre ni nombre à accorder avec un plat, une variante ou une option. Ce que l’hôte confirme malgré la fiche est « enregistré à votre nom ». Les autorisations sont « gérer les invités » et « consulter les invités ». « Option · » est dans `same-as-english.json`.
- **22 nov. 2026. La ligne « Sans choix de menu » du récapitulatif des invités** (sc-82328 pour sc-80901, `messages:guestReplies.email.noMealChosen`). Elle compte les personnes à qui il reste au moins un service à choisir. Même moule que « Sans place : {count} » : « Sans choix de menu », le pick restant le **choix** (18 nov.) ; jamais « repas », qui laisserait croire qu’on ne mange pas.
- **21 nov. 2026. Tarifs du personnel : la page, un tarif, les tarifs propres et la ligne Équipe du Budget** (sc-79848 pour sc-101, `web:staffRates.*`, `validation.staff_pay_*|staff_rate_*|staff_fee_*` de l’API). La page est **Tarifs du personnel**, entre guillemets dans la phrase, comme sur la ligne d’heures du personnel. Rate est **tarif** (« Tarif horaire », « de l’heure ») ; Flat fee est **forfait**, et chaque forfait se compte (« 3 forfaits × 100 € = 300 € »). By the hour est « À l’heure ». Own rate est **tarif propre**. Une place libre suit Fonctions et services : « pas encore pourvue ». L’autorisation se nomme entre guillemets, « Gérer le budget ». Pour éviter « de Accueil », le nom d’une fonction suit toujours le mot « fonction » (« le tarif de la fonction {{job}} ») ou se met entre parenthèses ; `jobsHours` est « {{job}} ({{hours}}) » et `saved`, « Tarif enregistré : {{name}}. ». `{{names}}` de `notCounted` arrive joint par Intl et suit les deux-points. Rien ne s’accorde avec une personne : « Comment payer {{person}} ? », « chaque personne ne touche qu’un forfait ». `hoursMinutes` reste identique (dans `same-as-english.json`).
- **21 nov. 2026. Codes d’accès : en créer, en désactiver, en utiliser, et leurs entrées du journal d’audit** (sc-79291 pour sc-72, `messages:door_codes.*`, `errors:door_code_invalid`, `audit.what.door_code.*`, `audit.field.*`). Door code se dit **code d’accès** des deux côtés, l’hôte et l’équipe. Stop est **désactiver**, comme `audit.field.stoppedAt` « Désactivé ». `audit.field.signedIn` (oui/non) est « Session ouverte », car « Connecté » ne s’accorde qu’au masculin. Check guests in est **accueillir les invités**, comme « Peut faire l’accueil ». `invalid` est identique dans `messages` et `errors`. Rien ne s’accorde avec la personne : « ajouter votre compte », « la personne responsable de l’événement ». `too_many` suit `limits.join_requests` : « à partir du {when} ».
- **17 nov. 2026. Partager les tables avec les invités, et Votre table sur la page de l’invité** (sc-66074 pour sc-4022, `web:seating.share.*`, `web:guest.table.*`, `timeline.share_tables|tables_shared` et `validation.share_by_*` de l’API). L’hôte **partage les tables**, jamais il ne « publie » le plan. Les invités qui ont répondu « Je viens » sont « les invités qui ont confirmé leur venue », ce qui évite tout accord avec « il » ou « elle » ; ce qui leur arrive est dit par leur page (« Rien du placement n’apparaîtra sur sa page »). Share by est la **Date limite de partage**, comme la Date limite de réponse, citée entre guillemets dans `refusedEmpty`. Save the date est « Enregistrer la date » : le bouton enregistre le champ, ce n’est pas le faire-part. Passed est « Passé », comme `timeline.passed`. `{{day}}` est le jour court d’`Intl` (« mar. 3 nov. »), précédé de « le ». Le jalon de la frise est nominal, « Partage des tables », comme « Clôture des réponses ». La permission est « gérer le plan de table », du nom de l’onglet. `guest.table.lead` et `companion` prennent l’espace insécable avant le deux-points.
- **17 nov. 2026. Le plan pendant qu’un invité est choisi** (sc-64637 pour sc-5030, `web:seating.freeTag_*|full|seatLabel|coming`). L’étiquette d’une table qui a de la place est « 2 libres », l’adjectif seul, comme « 2 free » ; `_many` ne prend pas « de », faute de nom : « 1 000 000 libres ». Sans place, « Complète », au féminin pour la table. Une chaise dit « Place 3, Claire Martin, Vient », la réponse comme dans la liste des invités (`guestList.reply.coming`).
- **17 nov. 2026. Exporter la liste des invités en tableur** (sc-63653 pour sc-3784, `web:guestExport.*`, `mobile:guestExport.*`, `guest_export.*` de l’API). Les réponses, allergènes, régimes et besoins d’accessibilité du fichier reprennent mot pour mot ceux de l’écran (`guestList.reply.*`, `guestNeeds.*`). Les colonnes reprennent les libellés de la fiche : « Accompagne », « Date d’ajout », « Numéro de portable » ; Places reste « Places », Allergies « Allergies » et Format « Format » (dans `same-as-english.json`). Le nom du fichier, « {événement} – invités – {jour} », est le même sur le web et dans l’API. Le bouton est « Télécharger » sur le web et « Partager » dans l’app ; hors ligne, « Connexion requise pour exporter », qui ne s’accorde avec personne. Filter est « Filtre : » au singulier, et la recherche est entre guillemets français avec espaces insécables.
- **17 nov. 2026. Supprimer plusieurs éléments où des invités sont placés** (sc-63723 pour sc-57680, `web:seating.movedToTray_*|movedToTrayDone_*`). La question dit qui part, comme `deletePlanSeated_*` : « 5 invités ayant une place passeront dans Sans place. ». Le message suit « 3 tables supprimées. » avec « 5 invités sont passés dans Sans place. », sans « ayant une place », qu’ils n’ont plus. Le participe s’accorde avec « invités », jamais avec la table ou l’élément. Tout `_many` prend « de » après le nombre, tables et éléments supprimés compris : « 1 000 000 de tables supprimées. », « d’éléments supprimés. », pour que le message ne mélange pas les deux formes. « Sans place » prend U+00A0 dans `movedToTray_*` et `movedToTrayDone_*` : à 641 px, le nom se coupait sur deux lignes (sc-63723, QA).
- **17 nov. 2026. Nouvel événement : le titre de la couverture et la ligne de création** (sc-61137 pour sc-48607, `web:eventForm.coverHeading|created`, `mobile:eventForm.coverHeading`). Le titre est « Photo de couverture », le mot du dialogue d’`eventCover`, car les champs de la photo sont dessous. « L’événement a été créé. Ouverture en cours. » reprend la forme de `notCreated` (« L’événement n’a pas été créé… »).
- **17 nov. 2026. La ligne en lecture seule du Menu avec le rôle sur l’événement** (sc-59651 pour sc-59617, `web:eventMenu.lockOnEvent`). « Votre rôle sur cet événement, « {{role}} », permet de voir ce menu mais pas de le modifier. » Le rôle est entre guillemets, car « Peut consulter » en apposition se lirait comme un verbe ; « sur cet événement », comme `eventPeople`.
- **16 nov. 2026. Les variantes d’un plat** (sc-4042 pour sc-3903, `web:dishVariants.*`, `validation.variant_*|variants_*`, `menu.variant_*` et `errors:variant_last_everyone` de l’API). Variant est **variante**, aussi pour le « way » de l’anglais : « {{dish}} · 2 variantes », « se décline désormais en 2 variantes ». Les options de Pour sont « Tout le monde » et « Enfants uniquement » ; la phrase qui nomme la première la met entre guillemets, aussi dans `errors:variant_last_everyone`. Une confirmation commence par « Variante » pour que le participe s’accorde avec elle : « Variante {{variant}} ajoutée au plat {{dish}}. ». « {{money}}, repris de la variante {{variant}} » évite l’élision devant le nom. Les allergènes de `unwarned` suivent un deux-points (« dont les besoins indiquent : »), car ce sont les noms de `guestNeeds.allergen.*`, avec majuscule.
- **16 nov. 2026. Copier et remplacer le lien d’un invité dans l’app** (sc-58991 pour sc-55558, `mobile:guestList.notCopied|linkReplacedOn|linkReplacedLine`). L’échec de copie suit `notReplaced` : « Copie impossible. Le lien n’est pas dans le presse-papiers. Réessayez. » ; il parle du lien, pas de « rien », car ce qui avait été copié avant y reste. La ligne après remplacement est « Lien remplacé le {{date}} », comme `repliedOn`. Sa ligne ne s’accorde pas avec l’invité : « Cette personne n’a que l’ancien lien jusqu’à ce que vous lui envoyiez le nouveau. ».
- **16 nov. 2026. Choisir plusieurs éléments sur le plan** (sc-57613 pour sc-4717, `web:seating.selectAll|selectKind|all*|none|chooseBar|addToChoice|addHint|rules|rule*|escKeeps|align*|tip*|done*|space*|grid*|gap*|renumber*|sectioned*|unsectioned*|duplicatedMany_*|delete*|keepThem|stepChanged|undo|undone|guestsSeated_*`, et `validation.seating_renumber_taken|seating_copy_outside_room|seating_arrange_twice` de l’API). Select all est **Tout choisir** et le menu **Choisir par type**, « choisir » comme « choisi », jamais « sélectionner ». Add to choice est **Ajouter au choix**. Chaque phrase chiffrée a sa clé pour les tables (féminin) et pour les éléments (masculin) : « 3 tables alignées », « 3 éléments alignés ». Les alignements sont ceux de tout éditeur : « à gauche », « en haut » ; Centre reste « Centre » (ligne verticale, dans `same-as-english.json`) et Middle est « Milieu » (horizontale). Space evenly est **Espacer régulièrement** ; la grille est **grille** et Gap **Espacement**, comme `spacing`, en « pi » pour les pieds. Le décompte vide du menu est « 0 » : « Aucune » ne s’accorderait pas avec « Éléments de la salle ». `nobodyInThem` est « Personne n’y est placé. » et `keepThem` « Garder », sans pronom qui s’accorde. Le refus après la modification d’une autre personne dit « après votre choix », sans accord avec `{{table}}`. Les `_one` qui écrivent « 1 » en anglais l’écrivent aussi (le contrôle de parité exige les mêmes emplacements) ; aucun ne sert à 0, puisqu’on ne supprime, ne copie ni ne renumérote jamais zéro table. Undo est « Annuler », comme le toast de `guestSelect` ; `tableNumbered` est « Table {{n}} », comme `seating.table_default_name`.
- **16 nov. 2026. La ligne Langue de Votre compte sur le web** (sc-57225 pour sc-39509, `web:account.languageFoot|languageSaved`). `{{language}}` est le nom de la langue dans la sienne (« Français »), et la page est déjà redessinée dans cette langue : il vient donc après deux-points, « Langue enregistrée : {{language}}. », comme sur la page de l’invité (14 nov.). « Langue enregistrée » s’accorde avec la langue, jamais avec la personne. Le pied dit « tous les appareils où vous vous connectez », comme les couleurs de l’app, et « Le changement est immédiat ».
- **16 nov. 2026. Les noms des touches du plan** (sc-56854 pour sc-56839, `web:seating.keyName.*`, avec `placing*` et `shiftClick`). Les touches s’écrivent comme sur un clavier AZERTY : **Maj**, **Suppr**, **Échap**, **Ctrl** (ce dernier dans `same-as-english.json`). Les lignes de placement et de Maj-clic nomment la touche comme la bande : « Appuyez sur Échap pour arrêter », « Maj et un clic… », comme `search.keys` dit déjà « Échap ». Remplace « Shift » et « Esc » de l’entrée du 16 nov. sur le déplacement.
- **16 nov. 2026. Le jour J sur la page de l’invité** (sc-55400 pour sc-3899, `web:guest.theDay|programme|timesIn`). Un seul jour s’intitule « Le jour J », plusieurs « Programme », le mot du Schedule de l’hôte dont viennent les éléments (dans `same-as-english.json`). Jamais « La journée » ni « La soirée » : l’événement peut avoir lieu à toute heure (sc-29384). La ligne du fuseau est « Heures dans le fuseau {{timeZone}}. », comme `eventPage.timesIn`, avec le point de l’anglais : la valeur est l’identifiant du fuseau (« Europe/London »), pas un nom du navigateur commençant par « heure ».
- **16 nov. 2026. La ligne de Saisir la réponse sur un invité Sans invitation** (sc-56426 pour sc-52829, `guestList.recordNotYetLine`, web et app). Pendant de `markLine` : « Ce que cette personne vous a dit, pour que l’invitation soit comptée ». La fin parle de l’invitation, pas de la personne, pour que rien ne s’accorde.
- **16 nov. 2026. Les pages d’un événement dans le navigateur d’un téléphone** (sc-55864 pour sc-55397, `web:handoff.line|anyway`). « Cette page est conçue pour une fenêtre plus large. Sur un téléphone ou une tablette, vous la trouverez dans l’application Soirely. » : elle dit où se trouve la page, sans ordonner d’installer quoi que ce soit. Le bouton est « Afficher cette page quand même », « quand même » en fin, comme on le dit.
- **16 nov. 2026. Le zoom du plan** (sc-56527 pour sc-4007, `web:seating.zoomIn|zoomOut|zoomIs|percent|fit|takenOf`). Les boutons sont « Zoom avant » et « Zoom arrière », le groupe s’annonce « Zoom à 100 % ». Le pourcentage prend une espace fine insécable avant %, comme `Intl` en français. Fit the room est « Toute la salle » : « Voir toute la salle » chevauchait Ajouter sur iPad en portrait (qa2, #57355, 16 nov.), et à côté des boutons de zoom le nom suffit. Sous la table, « 3 sur 8 » : « sur » pour une part d’un total, jamais « de ».
- **16 nov. 2026. Le menu Ajouter replié** (sc-56121 pour sc-55937, `web:seating.add|menuRow`). Sur un bureau étroit, le bouton de la barre est « Ajouter », sans complément : le menu dit quoi. La ligne du menu est « Rangée de places », avec le mot de la rangée (« Rangée de 12 places »), jamais « chaises », et sans verbe, comme « Table ronde » et « Place isolée ».
- **15 nov. 2026. Rangées de places numérotées et places isolées** (sc-54884 pour sc-4003, `web:seating.addRow|addSeat|row*|kindRow|single*|faces|label|spacing|seat*|toTheRight|spacingRange|delete(Row|Seat)|changed(Row|Seat)`, `seating.seat_default_name` et `validation.seating_row_*|seating_seat_*` de l’API). Une row est une **rangée**, jamais « ligne » ni « rang » ; un seat est une **place**, comme pour les tables, et celle qui n’appartient à aucune table ni rangée est une **place isolée**. Le "label" d’une rangée est son **libellé** (« une rangée avec le libellé A »). "Spacing" est l’**espacement**. `rowAdded` suit `added` et s’accorde au féminin : « La rangée {{label}} a été ajoutée… ». « Orientée vers l’avant » s’accorde avec la rangée. Le nom par défaut de l’API est « Place {n} », comme « Table {n} ».
- **15 nov. 2026. Supprimer une zone nomme ses tables, rangées et places isolées** (sc-54391 pour sc-54060, `web:seating.sectionStays|sectionDeleteBody_*`). {{counts}} est une liste (« 1 table », « 2 rangées et 1 place isolée ») : « Ses {{counts}} » ne se dit pas devant un chiffre. La phrase part donc de la zone : « Elle contient {{counts}}, qui reste(nt) à sa (leur) place, sans zone. », le verbe au nombre du total, sans participe qui s’accorderait. La ligne fixe répète le déterminant : « Ses tables, ses rangées et ses places isolées restent à leur place, sans zone. »
- **15 nov. 2026. Afficher plus dans Membres, sur le web et dans l’app** (sc-53389 pour sc-49170, `web:membersScreen.more.*`, `mobile:membersScreen.more.*`). « Afficher plus », comme `events.showMore`. La ligne d’état est une étiquette, comme le compteur de caractères : « Personnes affichées : 50 sur 12 345 », accordée à « personnes » et non au nombre. Le chargement est « Chargement d’autres personnes… », l’échec reprend `events.moreFailed` : « Les personnes suivantes n’ont pas pu être chargées. Vérifiez votre connexion et réessayez. »
- **15 nov. 2026. Ajouter des tables au plan** (sc-53509 pour sc-4000, `web:seating.addTable|shape*|kind*|menu*|countPlaces_*|tableName_*|chair*|sizeReset*|endsLine|head*Line|*Range|itemsOutside_*`…, `seating.table_default_name|items_outside` et `validation.seating_table_*` de l’API). Les quatre formes : « Table ronde », « Table rectangulaire », « Table d’honneur » et « Mange-debout », le mot des loueurs. Une place de mange-debout est une **place debout**, jamais une simple « place », dans le décompte, le champ et son refus ; les « Places » restent assises. "Ends" se dit **en bout de table** : « Places en bout de table », « au bout gauche ». Une chaise est « Place {{seat}} », « Libre » ou « Inutilisable ». `tableName` compte « {{taken}} sur {{count}} places occupées », l’accord suivant `{{count}}`. `added` et `duplicated` accordent au féminin, le nom désignant toujours une table. `squeeze` : « {{seats}} autour d’une table de {{size}}, ce sera serré. », sans accord avec `{{seats}}`. `itemsOutside` est au conditionnel (« se trouverait hors d’une salle de… »), la salle n’ayant pas encore changé, et le pronom s’accorde : « Déplacez-le » / « Déplacez-les ». « Rotation » et « Table {n} » sont identiques à l’anglais et figurent dans `same-as-english.json`.
- **15 nov. 2026. Les formes en court** (sc-53509, `web:seating.shape*Short`). Dans le choix « Forme » du panneau de la table, la forme perd « Table » et s’accorde avec « forme » : « Ronde », « Rectangulaire », « D’honneur » ; le mange-debout reste « Mange-debout », déjà court.
- **15 nov. 2026. Saisir la réponse d’un invité** (sc-51870 pour sc-3787, `web:guestList.recordReply|recordFor|howTold|toldHow.*|toldInLine.*|whoComing|recordPlaces_*|recordFoot|choose*|replaceAsk*|replaceTheirs|keepTheirs|replyRecorded|recordedOn`, `mobile:guestList.*` de même avec `theirReply`, `web:guest.recordedFor`, `guest.reply_is_theirs`, `validation.guest_reply_choose|guest_how_choose`, `errors:reply_is_theirs` de l’API). Le bouton est « Saisir la réponse », comme le citait déjà `repliesClosed` ; côté hôte, la réponse est « saisie », côté invité elle reste « enregistrée pour vous » comme `guest.recordedOn`. Rien ne s’accorde avec l’invité : « Comment vous a-t-on répondu ? », « Qui l’accompagne », « la sienne », « Cette personne ». La ligne est « saisie par {{name}}, {{how}}, le {{date}} », qui s’accorde avec « réponse » ; « au téléphone » plutôt que « par téléphone », qui suivrait « par {{name}} ». Les puces de `toldHow` sont « Téléphone », « En personne », « Message », « Autre » : avec « Par téléphone » et « Par message », la coche de la puce choisie renvoyait « Autre » à la ligne sur la feuille iPad de 540 (qa2, 15 nov.). La réponse donnée par l’invité lui-même est celle donnée « depuis son lien », citée entre guillemets ; `errors:reply_is_theirs` garde le brouillon de dev1, « a répondu elle-même », qui s’accorde avec « Cette personne ». Le nombre de ceux qui viennent est une étiquette, « 3 places · présences : 2 », comme « Noms : 1 sur 2 ». "Activity log" est « journal d’activité ».
- **15 nov. 2026. Une personne qui peut seulement consulter, devant un Brouillon dépassé ou un événement En pause** (sc-51800 pour sc-50996, `web:events.nextResumeReader`, `eventLive.endPassedReader`, `eventPause.noticeReader`). « jusqu’à la reprise » était déjà impersonnel : les lignes du lecteur reprennent celles de l’hôte mot pour mot. Les dates sont changées par « Une personne ayant le droit de le modifier », comme le rôle « Peut modifier », sans accord avec le lecteur.
- **15 nov. 2026. Répondre avant une date : la page close de l’invité et la Date limite de réponse de l’hôte** (sc-30739 pour sc-3780, `web:guest.replyBy|answerIs*|recordedOn|closedBy*|kitchen`, `web:guestKitchen.stays|save|saved|saveFailed`, `web:eventReplyBy.*`, `mobile:replyBy.*`, `guestList.askedToDecide*|askedBy*|repliesClosed*|reopened|repliesReopened|letThemChange|reopenNotSaved`, `validation.event_reply_by_*`, `validation.guest_kitchen_not_coming`, `guest.replies_open`, `timeline.replies_close`). "Reply by" est « Date limite de réponse » ; ce qui l’entoure parle de la « clôture » des réponses, comme #32762 : « Clôture à {{time}}, heure de {{zone}} », « Réponses closes », « Avancer la clôture au {{date}} ? », « Clore les réponses maintenant ? ». Le jalon de la chronologie est « Clôture des réponses ». {{zone}} est l’identifiant IANA (« Europe/Paris »), donc après « heure de », sans article. "Let them change their reply" est « Autoriser une nouvelle réponse », sans accord avec l’invité ; une fois rouverte, « Cette personne peut répondre… ». Le bouton "Record a reply" que nomme `repliesClosed` est cité « Saisir la réponse ». Sur la page de l’invité, les mots de sa réponse restent à la première personne : « Votre réponse est « Je viens ». ».
- **15 nov. 2026. Informations d’arrivée, dates d’un événement annulé et un enregistrement refusé** (sc-51001 pour sc-24385, sc-45141, sc-49861 et sc-48740, `eventForm.arrivalNote*`, `eventEdit.scheduleCalledOff|scheduleConcluded|forbidden`, `mobile:eventPage.datesCalledOff`, `web:guest.withYouNoName|withYouAddName`). "Arrival note" est « Informations d’arrivée », au pluriel, jamais « Note d’arrivée » ; elles s’affichent sur « la page de chaque personne invitée », sans accord. Un événement annulé « a été annulé », comme `calledOff` ; terminé ou annulé, « est terminé ou a été annulé ». Un enregistrement refusé pour le rôle : « Rien n’a été modifié. Votre rôle n’inclut pas l’autorisation nécessaire. ». Une place sans nom est « Pas encore de nom », et son bouton se lit « Ajouter le nom : Accompagnant 2 », comme `withYouRename`.
- **15 nov. 2026. Supprimer un événement qui a des invités** (sc-50481 pour sc-14445, `eventDelete.refused*` web et app). Les titres sont « Annuler d’abord l’événement {{event}} ? » et « Terminer d’abord l’événement {{event}} ? », le nom sans article. Le corps reprend `messages:event.call_off_first`, « Des invitations ont été envoyées ou le personnel a été briefé pour cet événement », sans accord avec personne. Après « terminé », « clos », pour ne pas le répéter. {{area}} est le libellé du domaine (« Événements ») : « une personne pouvant modifier {{area}} au sein de {{organisation}} », « au sein de » évitant l’article devant le nom.
- **14 nov. 2026. Le début vide de Dupliquer, lu à voix haute, et l’alerte Publier dans l’app** (sc-48857 pour sc-48601, `mobile:eventForm.notChosen`, `mobile:eventLive.confirmLine`). « À choisir » suit le libellé de la case, date ou heure, et ne s’accorde avec aucune des deux. `confirmLine` réunit sur une ligne `confirmGuests` et `confirmFinal` de la web, sans virgule devant « et », et la seconde phrase nomme « L’événement » : sur une seule ligne, « Il » suivrait les invités.
- **14 nov. 2026. Enregistrer un invité hors ligne dans l’app** (sc-47376 pour sc-3785, `mobile:guestList.offlineRefused|offlineRefusedLine`). « Vous êtes hors ligne. Rien n’a été enregistré. », comme `notSavedOffline`, puis « Vos modifications restent dans ce formulaire. Enregistrez de nouveau une fois la connexion rétablie. ». Jamais « une fois connecté », qui s’accorde au masculin : c’est la connexion qui revient.
- **14 nov. 2026. Sans invitation, Enregistrer l’invitation et la ligne Invitation** (sc-46819 pour sc-3788, `web:guestList.reply.notYetInvited|invited*|copyFirst|markAsInvited|markLine|howInvited*|markNotSaved|how.*|howMid.*|markNotInvited|unmarked|unmarkRefused|readOnlyInvited`, et `guest.replied`, `guest.not_marked_by_hand`, `validation.guest_invitation_how_required`, `errors:guest_not_marked_by_hand` de l’API). Rien ne s’accorde avec l’invité : le statut est « Sans invitation », comme « Sans réponse », et la ligne parle de l’invitation, pas de la personne : « Invitation faite par {{name}} via WhatsApp, le 9 oct. ». `howMid` ne sert qu’à cette ligne et porte sa préposition ; « via » plutôt que « par », qui suivrait « par {{name}} » (« via WhatsApp », « via SMS », « via e-mail », « en personne », « d’une autre façon »). Marquer à la main est « Enregistrer l’invitation », l’annuler « Annuler l’enregistrement » : « Marquer comme invité » s’accorderait. La question est « Comment avez-vous fait l’invitation ? », et le refus vide « Choisissez comment vous avez fait l’invitation. » : la même clé sert au dialogue de plusieurs invités (sc-46880, QA #50563), donc rien ne désigne une seule personne. La réponse citée est entre guillemets, comme en sc-43807. Les rôles sont ceux de l’événement : « Responsable ou Peut modifier ».
- **14 nov. 2026. Une invitation qui n’est jamais arrivée, dans Membres** (sc-47041 pour sc-46109, `web:membersScreen.notDelivered.*`). « Non parvenue », accordé à l’invitation comme « Envoyée » dans `membersScreen.dates.*`, et du même verbe que « Nos e-mails ne parviennent pas à… » dans Votre compte. « Non distribuée » et « Non remise » sont le jargon des serveurs de messagerie. Le reste de la ligne est celui de `dates` : « Non parvenue · expire le {{ended}} ».
- **14 nov. 2026. Rechercher un invité et les décomptes au-dessus de la liste** (sc-46741 pour sc-3772, `web:guestList.all|comingOf|countComing_*|countInvited_*|havent_*|haventWho|countGuests_*|countCompanions_*|everyoneReplied|find|clearSearch|shown|clear|noMatch|noMatchLine|showAll_*|heldLine`). La première ligne de la carte joint deux pluriels par `comingOf` ; le total vient d’abord : « Sur 9 invités, 4 viennent », « Sur 9 invités, 1 vient », car « 4 viennent sur 9 invités » se lit mal et « 4 des 9 invités viennent » ne se découpe pas. Le reste suit le 8 nov. : « 25 personnes n’ont pas répondu (21 invités et 4 accompagnants). », « Tout le monde a répondu. », « Afficher les {{count}} » ; pour un seul invité, jamais replié, « Afficher {{count}} » (le nombre est obligatoire). Au million, « de » : « 1 000 000 d’invités ». La recherche suit la règle, « Rechercher un invité » : la page n’existe que sur le web de bureau, de 1280 à 1440 px, où elle tient à côté de chaque filtre de réponse (pm, « Decided, 14 Nov ») ; « Chercher » seul (#2179) répondait à une largeur de 320 px que la page n’a pas, et « Chercher » n’est pas le verbe d’un champ de recherche ; sans résultat, « Aucun invité ne correspond », comme `eventsSearch`, et « Effacer », « Effacer la recherche ». La ligne de la recherche est « Affichage : 4 sur 9 », qui ne s’accorde avec rien. L’onglet est « Tous ». `heldLine` est `heldCompanion` sans « Accompagnant · ».
- **8 nov. 2026. L’écran Aujourd’hui à 360 de large** (sc-31788, après #32963). Le compte à rebours des cartes est « J-2 », « J-30 » (`todayScreen.inDaysCapital`), le repère des événements en France, pour tenir à côté de « Dernière semaine » ; dans une phrase, on garde « dans 2 jours ». Le lien de « Vos événements » est « Tout voir » (`todayScreen.allEvents`), car « Tous les événements » coupait le titre sur iPad en portrait. « Aujourd’hui » ne tient pas dans une colonne de la semaine, ni « Toute la journée » dans la colonne des heures : la semaine lit `todayScreen.todayShort` « Auj. » (affiché « AUJ. »), et « Toute la journée » passe sur deux lignes (#1520), jamais « Toute la j… ».
- **7 nov. 2026. Les Personnes d’un événement, et « Admin » partout** (`web:eventPeople.*`, `eventNav.people`, `membersScreen.eventsFromPeople`, `ownerMakesOwner`, sc-30138 pour sc-29915). La page est « Personnes ». Les rôles sur l’événement sont « Responsable », « Peut modifier », « Peut consulter » et « Peut accueillir les invités » (« l’accueil des invités », comme `eventPause`). Les annonces disent « désormais » : « {{name}} est désormais responsable de cet événement. », sans accord, « responsable » étant épicène. La ligne de celles et ceux qui voient déjà tout donne le rôle en étiquette après deux-points, « voit tous les événements grâce à son rôle dans {{organisation}} : Propriétaire et Administrateur » ; `managerRole.*` est donc le nom du rôle à toutes les formes, et rien ne s’accorde avec un genre. Un rôle cité dans une phrase d’erreur est entre guillemets, « reste « Peut consulter » ». "Owners and admins" est « les personnes ayant le rôle Propriétaire ou Administrateur », et dans un titre « les rôles Propriétaire et Administrateur » ; "an admin of" reste « une personne qui administre ». La personne retirée est « Cette personne … Elle », qui s’accorde avec le nom.
- **7 nov. 2026. Ce que fait chaque rôle, dans Membres** (`web:membersScreen.roleMeans.*`, sc-30138). Les phrases n’ont pas de sujet, comme `owner`. Les événements d’un Membre sont « les événements qui lui sont confiés » : « lui » n’accorde avec personne, alors que « auxquels il est ajouté » imposerait un genre. Même tournure dans l’app.
- **10 nov. 2026. Les Personnes d’un événement dans l’app** (`mobile:eventPeople.failed*|discard*|addFailed*`, sc-30138 pour sc-29914). Membres, Règles de connexion et `discardTitle|discard` reprennent le texte du web. L’erreur de chargement est le `failed` du web coupé en titre et ligne. Ce qui reste coché est « dont la case reste cochée », sans accord avec le nom ; à plusieurs, « les personnes encore cochées ». Le bouton est « Ajouter », et l’on « appuie de nouveau sur Ajouter ». L’abandon suit `keepEditing` : « Continuer à modifier », et « Aucune personne ne sera ajoutée à cet événement. »
- **7 nov. 2026. Les autres façons d’entrer dans l’app** (`mobile:steps.invited*`, `join`,
  `startOwnInstead`, `mobile:requestToJoin.messageOptional`, `signedOutLine`, sc-30119). "You’re
  invited" est « Vous avez une invitation », pour que rien ne s’accorde avec le lecteur ;
  l’adresse est « Invitation adressée à {{email}} ». `startOwnInstead` reprend
  `domainJoining.startOwnInstead`, « Créer plutôt ma propre organisation ». « Optional » dans un
  libellé est « facultatif », comme `web:requestToJoin.optional`.

- **« e-mail » keeps a plain hyphen (U+002D)**, never U+2011, even where it wraps as « e- » /
  « mail » (sc-20577, #20957). A break at a hyphen is ordinary French typography; U+2011 is
  missing from some fonts and email clients, breaks search, and outside GSM-7 sends an SMS as
  UCS-2. A line that must not wrap is a `[dev]` layout question, not a character in the copy.

## Never translated

- Soirely
- iPhone, iPad, Android
- A person's name or title: Chief, Alhaji, Dr., Mrs.
- Stadia Maps et OpenStreetMap, noms de fournisseurs de cartes, et le signe ©

## Decided phrasings

- **23 nov. 2026. Le Menu et ses choix dans l’app** (sc-4042 pour sc-3914, `mobile:menuPicks.*`). Reprend mot pour mot ce qui est décidé pour Voir les choix (`web:seePicks.*`), la fiche cuisine et le plat par défaut ; propre au mobile : Variant et Side d’une ligne sont « Variante · {{name}} » et « Option · {{name}} » ; la feuille de partage n’est pas nommée (« Vous pourrez la partager dès que le PDF sera prêt »). Pull down to refresh est « Tirez vers le bas pour actualiser ». Le bouton cité par `failedSave` est entre guillemets : « appuyez de nouveau sur « {{button}} » ». `givenOn` prend l’espace insécable avant le deux-points, contrairement à `web:seePicks.givenOn`. `rowSaid` est une étiquette de lecteur d’écran : « choisi : 2, par défaut : 1 ».
- **23 nov. 2026. La fiche cuisine** (sc-4042 pour sc-3911, `web:kitchenSheet.*`, `kitchen_sheet.*` de l’API). C’est **la fiche cuisine**, sur l’écran, dans le PDF et dans le nom du fichier, « {event} – fiche cuisine – {day} », comme `guest_export.file`. Elle reprend les noms d’état de Voir les choix : « Au choix de la cuisine », « Sans ce service », « En attente de l’hôte », « Sans choix » ; The room est « Toute la salle » en ligne de total. Side est l’option d’une question, d’où « Option · {{name}} » comme `seePicks.side`, et Sides « Les options », même si l’anglais dit side. Coming est « personnes attendues » ; les décomptes sans nom prennent « personne ». As of est « Mise à jour : {{at}} », car {{at}} commence par le jour. Allergies reste « Allergies » (dans `same-as-english.json`). Letter est « Lettre US ». L’avis de santé dit « détruisez-la » : ce sont des données de santé.
- **23 nov. 2026. Le plat par défaut d’un service et sa date limite de choix** (sc-4042 pour sc-1362, `web:courseDefault.*`, `guestMeal.default.*`, `eventMenu.picksHeadFrom|picksCloseFrom|picksByOwn*`, `seePicks.defaultLine*|neverGiven_*|given_*|allergy|otherDiet|defaultMark`, `validation.course_default_*|course_choose_by_*`, `menu.default_*` et `errors:menu_default_move` de l’API). The default est **le plat par défaut**, même avec une variante et des options, et la marque d’état reste « Par défaut » (`seePicks.defaulted`) ; le choose-by date est **la date limite de choix** (« Date limite de choix » en étiquette). Avant la date, la ligne dit « Sera attribué le {{date}} », après « Attribué le {{date}} ». L’origine de la clôture suit les deux autres : « Selon la date limite propre au service « {{course}} » ». Côté invité, {{course}} suit « en » comme dans `guestMeal.*`, et « ce sera {{dish}} » évite d’accorder quoi que ce soit avec le plat. Les dates hors « le »/« au » vont entre parenthèses (« antérieure à l’événement ({{date}}) »). Les décomptes sans nom en anglais (« {{count}} goes back ») prennent « personne ». Choose {{count}} est « {{count}} à choisir » en étiquette et « Choisissez-en {{count}} » dans une phrase. Edit course se cite « Modifier le service ».
- **23 nov. 2026. La page de l’invité le jour même : Votre code et Lieu** (sc-84598 pour sc-24381, `web:guest.yourCode|where`). « Votre code » coiffe la carte d’entrée, le même « votre code pour l’entrée » que `guest.doorCode`, jamais « code d’accès ». Where se dit « Lieu » : « Où » seul ne tient pas comme titre en français, et le bloc (heure, lieu, adresse, Voir sur une carte) dit où aller.
- **22 nov. 2026. L’invité choisit un plat pour chaque personne qui vient** (sc-4042 pour sc-3907, `web:guestMeal.*`). Way se dit **variante**, comme côté hôte, et le pick reste le **choix**. Le code met {{course}} en minuscules dans la phrase : il suit « en », sans article ni guillemets (« Que prendre en {{course}} ? », « Rien en {{course}} pour moi », jamais « Pas de », qui exigerait d’ devant une voyelle). Tel quel (`refusedClosed`), il reprend « le service « {{course}} » » de `eventMenu.picksClosedCourse`. {{name}} ne suit jamais « de » (« Plats pour {{name}} », « Pour {{name}}, l’allergie (…) »), car un prénom à voyelle demanderait d’. Can’t be picked se dit « ce choix n’est pas possible », sans participe à accorder. « L’hôte » est générique sur la page de l’invité, et {{hosts}} n’a pas de verbe à accorder : « Voici ce qui sera envoyé à {{hosts}}. » Preview as guest, dans l’en-tête du Menu, est « Aperçu côté invité », et le retour dit « Rien n’a été enregistré. ». Retirer un accompagnant qui a fait son choix « annule son choix » (`guestList.mealLine|seatedMealLine`). Un plat et sa variante : « {{dish}} avec {{way}} », la variante en minuscules ; either way est « quelle que soit la variante », juste pour deux comme pour trois (`sameForEither`, `dishWith`).
- **22 nov. 2026. Les réponses des invités pour l’équipe : la cloche, le push, le filtre « Changements depuis votre dernière visite » et le récapitulatif des invités par e-mail** (sc-4156 pour sc-4331, `*:guestList.changed.*`, `web:guestReplyEmails.*`, `messagesCounts:guestReplies.*`). Guest summary se dit **récapitulatif des invités** ; Guest reply emails, **e-mails sur les réponses des invités**. Dietary needs suit `guestNeeds` : **notes sur l’alimentation**. Le moment du changement suit deux-points : « Réponse : 09:31 », « Modification : {{date}} ». Les décomptes de l’e-mail reprennent la tuile de l’événement : « Présents : 4 », « Absents : 1 ». La cloche est **Notifications**. Comme « one » couvre 0 et 1, aucun « 1 » n’est écrit en dur dans une forme « one ». « Soirely » du push figure dans `same-as-english.json`.
- **21 nov. 2026. Le décompte des arrivées dans Maintenant et sur la carte d’Aujourd’hui** (sc-33154 pour sc-29978, `mobile:todayScreen.arrivedOf_*|arrivedAlone_*|arrivedCount_*`). La phrase suit l’accueil des invités : « Arrivées : {{count}} sur {{expected}} » ou « Arrivées : {{count}} », la même à chaque forme. Sous le chiffre, l’étiquette est le nom accordé au nombre, « arrivée » (0 et 1) ou « arrivées », jamais le participe « arrivés », qui supposerait un genre.
- **21 nov. 2026. L’accueil des invités à l’entrée, les inscriptions sur place, et la personne arrivée qui reste sur la liste** (sc-80438 pour sc-1454, `mobile:checkIn.*`, `*:guestList.reply.walkIn|companionStays`, `web:guestList.arrival|arrived|stays*|justArrived|companionJustArrived|backToDetails|placesRefusedArrived`, `web:guestSelect.stays*|notChanged_*|hasArrived|companionHasArrived`). L’écran est l’accueil des invités, comme `eventPause`, mais le titre de l’app est seulement « Arrivées » : « Accueil des invités » était coupé à côté du bouton « Invités » sur l’iPhone SE (qa, #81817), et « Accueil » seul se lit comme l’onglet d’accueil ; les phrases disent toujours « l’accueil des invités ». L’accès, « Accueillir les invités ». Arrived ne s’accorde avec personne : le bouton et l’état disent le nom **Arrivée** (« Arrivée à 19:42 », « Annuler l’arrivée »), une phrase dit « arrivée enregistrée pour {{name}} » ou « vient d’arriver », jamais « est arrivé(e) ». « Pour » plutôt que « de », qui s’élide devant un prénom à voyelle (« d’Adaeze »). Sur la fiche web, la ligne est « Accueil · Arrivée enregistrée », pour ne pas répéter « Arrivée ». Walk-in est **Sur place** dans la colonne des réponses (« Sans invitation » y existe déjà pour Not yet invited) ; le bouton, **Inscrire sur place**. Le décompte est « Arrivées : {{count}} sur {{expected}} », comme l’anneau d’Aujourd’hui, le même à chaque forme de pluriel. Avec un accompagnant, le nom vient en tête, « {{name}} reste sur la liste : une personne qui l’accompagne… », pour que la phrase ne parle pas de l’accompagnant (un slot ne se répète pas).
- **21 nov. 2026. Le format, les filtres et les entrées d’une exportation du journal d’audit** (sc-78332 pour sc-76228, `audit.filter.*`, `audit.format.*`, `audit.field.rows`, `audit.entries` de l’API). Les filtres reprennent les mots de leurs boutons : « Type » (et non plus « Type d’action ») et « Dates ». La plage est celle du bouton Dates, `auditLog.range`, en minuscule après « Dates : » : « du {from} au {to} » ; `{from}` et `{to}` ne sont que le jour et le mois (« 1 nov. »), et une borne ouverte est « … » (« du 1 nov. au … »). « CSV », « JSON Lines », « Type » et « Dates » restent tels quels, comme dans la boîte d’exportation (same-as-english). Depuis la QA de sc-78332 (#78989), U+00A0 avant `{to}` (« au … »), pour que « … » ne reste pas seul en début de ligne.
- **21 nov. 2026. Qui paie sur le web : les payeurs, Choisir qui paie et l’alerte de répartition** (sc-78571 pour sc-91, `web:payers.*`). Payer est **payeur** et la page **Qui paie** (« Chargement de Qui paie… ») ; Choose who pays, « Choisir qui paie ». Split est la **répartition** ; Paid « Réglé », Still to come « Reste à régler », comme les devis. `{{name}}` est le nom saisi par l’organisateur et peut être un couple (« Mr and Mrs Obi ») : rien ne s’accorde avec lui, et rien ne le suit après « de », qui buterait sur l’élision. Les parts se disent « {{amount}} pour {{name}} » (dans l’alerte, après « Jusqu’à ce que les montants changent : »), une part qui bouge « {{name}} : part en baisse de {{amount}}. », et le toast suit la règle de la page Budget, « Payeur {{name}} retiré. ». Un coût après « de » passe par « du coût {{cost}} ». `{{range}}` commence par « De … » avec une majuscule, donc il ouvre la phrase : « {{range}} au total. ». Half each est « moitié-moitié ». Les notes de remplacement disent « la répartition actuelle », qui vaut au singulier comme au pluriel. Les refus reprennent les phrases de `validation.payer_*` de l’API.
- **21 nov. 2026. Les liens du personnel : la colonne Lien de la liste, Remplacer le lien, les lignes de Personnes et les pages /w/** (sc-4286 pour sc-3912, `web:roster.link*|trail*|copyLink*|markSent*|marked*|nextCopied|replace*|keepLink`, `web:eventPeople.staffLink*|endsOn|notSignedIn`, `web:staffLink.*`, `staff.link_needs_mobile` et `limits.staff_links` de l’API). Le lien est masculin, les statuts s’accordent avec lui : « Copié », « Lien envoyé », « Lien ouvert », « Marqué comme envoyé à {{name}} ». Rien ne s’accorde avec la personne : « Pas encore de connexion », « Ce lien n’est destiné qu’à vous » (et non « à vous seul »). Pas de « de » devant le nom (règle du 11 nov.) : « Lien pour {{name}} », « le lien destiné à {{name}} », car il n’a peut-être pas encore été envoyé. Le lien s’active, il ne « s’ouvre » pas, puisque le lecteur vient de l’ouvrir : « Ce lien n’est pas encore actif. », « Il s’active 12 heures avant… », et à la fin « Ce lien n’est plus actif. ». L’heure : « à partir du {{day}} à {{time}} », « fin à {{time}} », `endsOn` « {{time}} le {{date}} ».
- **20 nov. 2026. Les rappels de paiement : le message, le dernier rappel d’un paiement en retard et la carte des Paramètres** (sc-76423 pour sc-95, `payment_reminder.*`, `audit.*.payment_reminder*`, `validation.payment_reminder_days`, `web:paymentReminders.*`). Reminder est **rappel** ; due, **à régler**, comme `quotes.due` ; was due, **dû le**. Le titre est la ligne du push et l’objet de l’e-mail, le nombre en tête : « 2 paiements à régler dans les 3 prochains jours pour {event} », « sur 2 événements » quand il y en a plusieurs. By tomorrow est « d’ici demain ». Who hears est « Destinataires », sans genre.
- **20 nov. 2026. Marquer un paiement comme réglé, l’annuler, ajouter un paiement déjà effectué, et la ligne d’échéance de la carte Budget** (sc-75129 pour sc-88, `web:quotes.card*|markPaid|datePaid*|paidLine*|markedPaid|already*|cancel*|restore|noLongerChased|addAsPaid|addedBy*|deleted|…`, `payments.*` et `validation.payment_paid_*|payment_reference_*|payment_reason_*|payment_made_*` de l’API, `errors:payment_already_paid|payment_cancelled`). Paid est **réglé**, comme dans les devis : Mark paid « Marquer comme réglé », Date paid **Date de règlement**, Amount paid « Montant réglé ». Scheduled est « Prévu », et l’écart « {{gap}} de plus que prévu ». Les lignes de la carte s’ouvrent sur « Paiement pour {{vendor}} : », « pour » évitant l’élision et l’article devant le nom, puis `{{what}}` en minuscules, comme `wasDue`. Cancel payment est « Annuler le paiement » et Undo reste « Annuler », le bouton du toast, cité entre « » dans `addedBy*`. Not owed est « Non dû » ; No longer chased, « Plus de relances. ». Restore est **Rétablir**. What it was for est « Objet du paiement », comme `whatFor`. L’encart d’Ajouter un paiement déjà effectué (sc-75579, `web:quotes.paidTo|nowWithThis|overWithThis|nothingAbsorbs`) suit la même règle : « Réglé au prestataire {{vendor}} », jamais « Payé à », puis « Prévu » ; l’échéancier « dépasse le devis de {{gap}} ». Undo reste « Annuler », même en bouton durable sur une ligne ajoutée comme déjà réglée, à quelques lignes d’« Annuler le paiement » (qa2 #76851) : il porte l’icône d’annulation, c’est le mot du toast et de la page Budget, et la ligne elle-même dit « « Annuler » le supprime ». « Annuler le paiement » garde toujours son complément, ce qui suffit à les distinguer.
- **20 nov. 2026. La forme d’un échéancier dans Ajouter un paiement, et le refus quand quelqu’un ajoute des paiements avant vous** (sc-30679 pour sc-1332, `web:quotes.howItIsPaid|shapeName.*|shapeCalled.*|days*|share*|saveShapes_*|shapeFailed_*|shapeRaced`, `errors:payments_already_scheduled` et `quotes.payments_already_scheduled` de l’API). Les formes et leurs lignes suivent l’aide `whatForHelp` : Deposit est **Acompte**, Instalment **versement** (« Trois versements », « Deuxième versement »), Balance **Solde**, In full **Paiement intégral**. How it is paid est « Modalités de paiement ». Pour 0 jour, « À la date de début de l’événement » et « À la date de fin de l’événement ». Set to the date quoted est « Échéance ramenée à la date du devis, {{day}} », pour que le participe s’accorde avec Échéance. Percentage est **pourcentage** ; « supérieur à 0 et jusqu’à 100, avec deux décimales au maximum ». No description yet est « Pas encore d’objet », comme l’Objet du paiement. Le bouton « Enregistrer {{count, number}} paiements » est cité tel quel dans le refus de l’envoi échoué. Filling this in est « pendant que vous remplissiez ce formulaire », jamais « le remplissiez », qui renverrait à l’échéancier.
- **20 nov. 2026. La marge d’un prix dans le Budget : Coût, Prix facturé, l’avertissement sous le coût et les refus de la majoration** (sc-30767 pour sc-92, `web:budget.margin.*`, `validation.budget_markup_*|budget_client_price_*` de l’API). Markup est **majoration**, un pourcentage du coût ajouté par-dessus ; Margin est **marge**, un pourcentage du prix client, et l’une ne remplace jamais l’autre. « Majoration de {{markup}} », « marge de {{margin}} ». La ligne dit « Coût {{cost}} · Facturé {{charged}} · {{how}} », `how.*` en minuscule après le point médian ; le champ Charged at est « Prix facturé ». At cost, chosen est « au prix coûtant, par choix », distinct de « aucune majoration définie ». Client total est « Total client ». L’étiquette de qui la voit ne passe pas à la ligne, donc elle reste courte : « Réservé aux propriétaires, admins et responsable de l’événement », sans article devant « responsable », pour ne pas s’accorder. Enterprise n’est pas traduit (dans `same-as-english.json`).
- **20 nov. 2026. Le reste de la ligne Changements et la ligne de filtres de l’export du journal d’audit** (sc-74730 pour sc-611, #3209, `audit.field.*`, `audit.value.*` et `audit.filter.*` de l’API). Chaque champ est un nom et chaque valeur un mot seul après deux-points, avec les mots que montrent déjà leurs écrans : les statuts d’un événement (« Brouillon », « Publié », « En pause », « Terminé »), ceux d’un domaine (« En attente de vérification », « Vérifié », « Non vérifié », « Enregistrement absent »), les types de `eventTypes`, les moyens d’arrivée de `membersScreen.how` et la Fonction de Personnes. Status est « Statut », comme `membershipStatus`, car les membres sont aussi enregistrés sous `status`. Les valeurs s’accordent avec ce qui n’est pas nommé : une invitation « Annulée », une demande de propriété « Arrêtée » ou « Retirée ». Starts at et Ends at sont « Début » et « Fin » ; Suspended because, « Motif de la suspension », et By an admin, « Décision d’un administrateur ». The Owner came back est « Une personne avec le rôle Propriétaire est revenue », et The claimant left, « La personne à l’origine de la demande est partie ». Plan est « Forfait » ; Rows, « Entrées », comme sur la page. « Type », « Format », « Invitation » et « Baby shower » restent tels quels (same-as-english).
- **20 nov. 2026. Devis et échéanciers dans le Budget, et le refus d’archiver un prestataire** (sc-73977 pour sc-87, `web:quotes.*`, `web:vendors.usedOn_*|archiveRefused|owingLink`, `validation.quote_*|payment_*|money_*`, `quotes.*` et `vendors.archive_refused` de l’API, `errors:vendor_*|quote_unchanged`). Quote est **devis** et Payment schedule **échéancier** ; programmer un paiement, c’est le **planifier**. Due est « à régler le {{day}} » et la date, **date d’échéance** ; Due next « À régler », comme les lignes et « Rien à régler. », pour tenir sur un téléphone de 320 px à côté du lien (qa #74396), Everything due « Toutes les échéances », Nothing is due « Rien à régler. ». Overdue est « En retard », comme `timeline.overdue`. Paid est **réglé** (« ni réglés ni annulés »). What it covers est **Objet**, le mot du devis, et What the payment is for « Objet du paiement ». Quoted on est « daté du {{day}} » (sur la carte, « Devis du {{day}} »). Budget lines sont les **coûts du budget**, comme sur la page Budget ; Agreed est « convenu », et le refus s’ouvre sur « Le coût {line} » pour que le participe s’accorde avec lui. Un nom de prestataire après « de » passe par « du prestataire {{vendor}} », pour ne jamais buter sur une élision (« de Atelier »). Revise est **réviser**, Correct **corriger**, « … instead » « … plutôt ». `wasDue` reçoit la description en minuscules, donc elle suit un deux-points : « Paiement en retard : {{what}}, … ». Keep, dans Retirer un paiement, est « Le garder ». Ask an owner or admin : « Demandez à une personne ayant le rôle Propriétaire ou Administrateur », comme `signInRules.askOwner`. Plan est le **forfait**.
- **19 nov. 2026. Les cartes vide, réservée à Enterprise et après Enterprise de Données et contrôle, et la ligne Valeur de l’e-mail** (sc-73864 pour sc-560, `web:dataControl.newSays|newLine|lockedSays|leftSays`, `mobile:dataAndControl.leftSays`, `web:emailDomains.leftSays`, `mobile:emailDomains.card.off`, `emails:domainRecordGone.value`). Elles reprennent ce que l’app disait déjà : « Rien n’est encore configuré », « Commencez par vérifier… », et « L’organisation {{organisation}} n’a plus le forfait Enterprise », comme `emailDomains.leftLine`. These come with Enterprise est « Disponibles avec le forfait Enterprise », au pluriel car la ligne énumère les fonctions. Switched off, titre de la carte Domaines de messagerie, est « Désactivés », des domaines. Value est « Valeur : {value} », avec l’espace insécable comme « Nom : ».
- **20 nov. 2026. La ligne Changements du journal d’audit** (sc-74730 pour sc-611, `audit.field.*` et `audit.value.*` de l’API). La ligne est « Champ : avant → après », donc chaque valeur est un mot seul après deux-points. Les niveaux d’accès et les statuts d’un membre sont ceux de Personnes et Membres : « Responsable », « Peut modifier », « Peut consulter », « Peut accueillir les invités », « En attente d’approbation », « Avec accès », « Accès suspendu ». Le statut d’adhésion est « Statut », pas « État » (celui d’une tâche). Left or removed est un seul statut, « Ne fait plus partie de l’organisation », comme `membersScreen.card.removed`. Les deux règles sont le réglage dit en nom, « Double authentification obligatoire pour tous | pour les administrateurs », suivi de « Activé » ou « Désactivé ». None est « Aucun », au masculin pour le rôle, son cas (un rôle supprimé depuis). Free est « Gratuit », le forfait ; « Enterprise » reste tel quel (same-as-english). `audit.change` prend U+00A0 avant le deux-points, hors des accolades : « {field} : {before} → {after} » (QA #74832).
- **20 nov. 2026. Le nom du fichier de l’exportation du journal d’audit** (sc-76013 pour sc-74144, `audit.export_file` de l’API). « Journal d’audit – {organisation} – {day} », avec des tirets demi-cadratin comme `guest_export.file` : dans un nom de fichier, « de l’organisation {organisation} » serait trop long, et « de {organisation} » enfreindrait l’élision (règle du 25 oct.).
- **19 nov. 2026. Le journal d’audit, ses actions, son exportation et l’e-mail de l’exportation prête** (sc-73564 pour sc-611, `web:auditLog.*`, `web:dataControl.auditLine|lockedLine|leftLine`, `mobile:auditLog.*`, `mobile:dataAndControl.rows.audit*`, `audit.*` de l’API, `emails:auditExportReady.*`). La page est le **Journal d’audit**, comme dans Données et contrôle et l’e-mail du forfait gratuit ; une ligne est **une entrée**. Les six types sont les mêmes dans le filtre, le détail et le fichier : « Événements », « Accès aux événements », « Membres et invitations », « Connexion et sécurité », « Organisation », « Journal d’audit ». Chaque action est au passé composé sans sujet, Qui étant sa propre colonne, et nomme ce qu’est {target} : « A créé l’événement {target} », « A créé l’organisation {target} », « A invité {target} » ; quand la personne a agi elle-même, {target} est le sujet, « {target} a quitté l’organisation ». Rien ne s’accorde avec {target} (« cette personne a été retirée »). Ce qui n’a pas de nom est « (sans nom) », entre parenthèses, pour tenir dans toute phrase. On, dans le détail, est « Événement », ce qu’il affiche ; les valeurs d’un changement sont « Activé » et « Désactivé ». Owner claim est **revendication de propriété**. Les nombres que le code ne formate pas s’écrivent comme `Intl` fr-FR, avec l’espace fine U+202F (« 10 000 », « 1 000 000 ») ; la limite se dit « dépassent la limite de 1 000 000 », pour éviter « 1 000 000 d’entrées ». Le lien **expire**, sauf `audit.export_expired`, qui suit `errors:export_expired` (« a pris fin »). L’objet met l’issue en tête : « Votre exportation est prête : journal d’audit de l’organisation {organisation} ». « Type », « Dates », « Format » et « Organisation » sont dans `same-as-english.json`.
- **19 nov. 2026. L’exemple du champ Groupe tient sur un téléphone de 320 px** (sc-73302, qa4 #73086 sur sc-72530, `web:guestGroups.placeholder`). « Ex. : Famille ou Travail » : « Par exemple, Côté mariée ou Travail » était coupé au bord du champ. Dans un texte indicatif, l’exemple suit « Ex. : », la forme courte des formulaires, avec l’espace insécable avant le deux-points, et ne dépasse pas la largeur de l’anglais ; dans une phrase, « par exemple » reste (18 nov.).
- **19 nov. 2026. La page Budget de l’événement sur le web** (sc-72045 pour sc-85, `web:budget.*`). Les deux montants sont **le montant confirmé** et celui **si tous viennent**, comme dans Ajouter un invité ; la fourchette est « De {{low}} à {{high}} ». Per head est « par personne », et ceux qui ont dit oui sont des « personnes », pas des « invités », car les accompagnants comptent. Remove est **Retirer**, Put back **Remettre** (« Coût non remis. »), Undo « Annuler ». What it is est **Nature** (« Saisissez la nature de ce coût. », comme l’API) ; un coût fixe, « Forfait » dans la liste et « Montant forfaitaire » sur la ligne. `{{name}}` est le libellé saisi par l’organisateur : les messages s’ouvrent sur le nom « Coût », comme « Prestataire {{name}} ajouté. », pour que le participe s’accorde avec lui (« Coût {{name}} retiré. », « Coût {{name}} ajouté dans un autre onglet : le total ne change donc pas. »), et `rateFor` dit « Tarif pour {{name}} », sans élision à prévoir. `source.accepted` suit un nombre seul (« 42, ayant dit oui, d’après la liste des invités ») : le participe présent ne s’accorde pas. Les éléments de `knows*` commencent par une minuscule : le code les joint avec la conjonction d’Intl et met la majuscule. Hors connexion, « Hors direct. Montants mis à jour à {{time}} », comme `offline.asOf`. La pastille de la carte, `notPricedCount`, dit « 12 coûts sans prix », comme le badge « Sans prix » : « pour l’instant » la coupait à 320 px (qa5 #73608) ; `addPriceLine`, qui passe à la ligne, le garde.
- **19 nov. 2026. Ce que coûterait l’ajout d’invités, dans Ajouter un invité, et les refus du what-if** (sc-71630 pour sc-86, `web:decisionAnswer.*`, `validation.what_if_*` de l’API). If all come est **si tous viennent**. Les deux chiffres du budget sont **le montant confirmé** et **le montant maximal** (si tous viennent) ; « Inconnu » et « Coût inconnu » s’accordent avec « coût ». Le titre est « Ce que coûterait cet ajout », qui ne s’accorde pas avec le nombre d’invités. Les coûts que le changement fait bouger sont « les coûts concernés », et le pluriel passe par « {{count, number}} des coûts concernés », juste en `_one` comme en `_many`. `{change}` est la clé brute (guests, tables, staff_hours, days), non traduite et sans article : « pour {change} », « le changement de {change} ». `what_if_too_large` dit « au total », car il se déclenche aussi sur la somme de plusieurs entrées. U+00A0 avant les deux-points et dans les guillemets, jamais dans un argument ICU. Once invited (sc-72530) est « une fois l’invitation enregistrée », qui renvoie à « Enregistrer l’invitation » et ne s’accorde pas avec le nombre d’invités. Sous le titre « +{{amount}} si tous viennent », `upperOnly` ne répète pas la condition : « cela ferait {{upper}} au total » (ux, #72711, sc-72857).
- **19 nov. 2026. Réservé à notre organisation, la feuille du compte géré et l’e-mail d’avis** (sc-72486 pour sc-563, `web|mobile:emailDomains.only*|card.*|onlyAsk.*`, `web|mobile:managed.*`, `membersScreen.alsoMemberOf_*`, `emails:managedNotice.*`, `messages:email_domains.managed|only_ours_*`). Le réglage s’appelle **Réservé à notre organisation**, du même verbe que « réserver ses comptes à l’organisation … » (sc-70819) ; dans une phrase, il est entre guillemets et au masculin : « « Réservé à notre organisation » est désactivé ». Limit {{domain}} accounts to est « Réserver les comptes {{domain}} à l’organisation {{organisation}} », sans « de » devant le domaine ; une fois actif, les comptes « appartiennent à l’organisation ». Schedule it est « Programmer ». « Access to a single event still works » est « L’accès à un événement précis reste possible » partout. Managed by est « Compte géré par {{organisation}} », « par » n’élidant pas. Applies from est « Date d’effet : {deadline} ». Only an owner est « Seule une personne ayant le rôle Propriétaire », comme `membersScreen.ownerOnly`.

- **19 nov. 2026. Domaines de messagerie, Données et contrôle dans l’app et les deux e-mails de domaine** (sc-70819 pour sc-560, `web:emailDomains.*`, `web:dataControl.domain*|control|enterprise`, `mobile:settings.dataAndControl*`, `mobile:dataAndControl.*`, `mobile:emailDomains.*`, `emails:domainListingStopped.*|domainRecordGone.*`, `messages:email_domains.*`). Prove est **vérifier**, comme l’étiquette « Vérifié » du 9 nov. et `errors:email_domain_taken`, et le bouton Verify est aussi « Vérifier » : c’est lui qui vérifie le domaine ; « Le bouton Vérifier fonctionne toujours ». Le contrôle horaire est « Nous vérifions toutes les heures jusqu’au {{when}} ». Le record DNS est **l’enregistrement** ; Missing, « absent » ; Not proved, « Non vérifié » ; Kept, « Conservé », « tels quels ». Put it back by est « Remettez-le avant le {{when}} » ; `{{when}}`, `{{at}}` et `{deadline}` sont l’instant complet de l’API, après « le », « avant le » ou « jusqu’au ». Le nom de l’organisation suit toujours « l’organisation » (règle du 25 oct.), y compris {prover}. Limit the accounts at it to est « réserver ses comptes à l’organisation … ». Le forfait est « le forfait Enterprise » ; quitter Enterprise est « n’a plus le forfait Enterprise », sans accord. La feuille d’ajout de l’app s’intitule « Nouveau domaine », pour tenir à côté d’Annuler et d’Ajouter. Retirer est **Retirer** et son « Keep it », « Le garder », comme `companyDomains.*`. Sur le web on « sélectionne » Vérifier, dans l’app on « appuie sur » Vérifier. Un domaine ne suit jamais nu « de » ni « que » : « du domaine {{domain}} », « que le domaine {{domain}} », car « de absent-exemple.fr » ne s’élide pas (QA, 19 nov.). `stoppedBody` et `domain_proved_elsewhere` disent désormais « le forfait Enterprise ».
- **19 nov. 2026. Les postes de l’Équipe : lieux, zones du plan de table, maître d’hôtel et ordre de passage** (sc-71331 pour sc-3910, `web:stations.*`, `messages:stations.*` de l’API). Station est **poste**, comme dans la liste du personnel ; une section du plan de table est une **zone**, comme dans `seating.*`, et sur cet écran une zone est un poste parmi d’autres. Les endroits que l’organisateur ajoute sont des **lieux**, jamais des « places », qui sont celles d’un service. Pass est **le passe**, en minuscule dans la phrase, « Passe » comme nom du lieu. Course est **service**, comme dans le Menu (« Service 2 »), malgré Shift : le contexte les sépare, comme au 18 nov. Items sont des **plats**, comme `eventMenu.dishes_*`, jamais des « éléments ». Dish (verbe) est **partir de** : « Ce qui part de chaque poste », « Part de », « Tous les plats partent du passe. ». Floor lead est **Maître d’hôtel**, comme `staff.job_suggested.floor_lead`, et « diriger la salle » pour le verbe ; Lead est **responsable**. Walking order est l’**ordre de passage**, en **étapes**. Remove, pour un lieu, est **Supprimer**, et son « Keep it », « Ne pas supprimer ». Rien ne s’accorde avec le nom d’un poste ou d’une personne : les toasts disent « Lieu {{name}} ajouté. », « Nouveau nom : {{name}}. », « au poste {{station}} », « Vous avez déplacé {{name}}… », et « La zone {{name}} a été supprimée… ». Le refus de longueur est celui des fonctions, « Le nom ne doit pas dépasser {{max}} caractères. », sur le web et dans l’API. `sectionTables_one|other` (« table ») et `place_suggested.bar` (« Bar ») sont dans `same-as-english.json`.
- **19 nov. 2026. Les événements extérieurs dans le menu de l’organisation** (sc-71337 pour sc-68438, `outsideEvent.yourEvents|fromOutside|yourOrganisations|underWay|here|backTo|continue` dans `web:` et `mobile:`). Events from outside est **Événements externes**, l’adjectif de « Externe à {{organisation}} », court pour le titre du menu. « Vos événements » et « Vos organisations », comme `today.yourEvents` et `switcher.heading`. Under way est « En cours », comme `happeningNow`. You’re here est « Vous êtes ici ». « Retour à {{name}} », le nom de l’organisation ou de l’événement, comme `eventsSearch.backTo`.
- **19 nov. 2026. La Vue d’ensemble d’un événement vue de l’extérieur** (sc-69719 pour sc-71, `outsideEvent.until|guestsLine|onEvent_*` dans `web:` et `mobile:`). `until` est « jusqu’au {{when}} » (« jusqu’au dim. 22 nov., 23:30 »), en minuscule après le point médian. Contact details sont **les coordonnées**. Les personnes sont « sur cet événement », l’usage du métier ; `_many` prend « de » (« 1 000 000 de personnes »).

- **19 nov. 2026. Données et contrôle, Exporter toutes les données et l’e-mail de l’exportation prête** (sc-67949 pour sc-612, `web:settings.sectionDataAndControl`, `web:dataControl.*`, `web:exportAllData.*`, `messages:organisation.export_*|limits.organisation_export`, `emails:organisationExport.*`). La section est **Données et contrôle**, le même nom dans la liste, le titre et le chargement (« Chargement de Données et contrôle… »). L’export est **l’exportation**, au féminin : « Prête », « Téléchargée », « demandée par {{name}} », « N’a pas abouti » ; ce qui se télécharge est **l’archive**. Son lien **expire** et, utilisé, « a servi », sauf `errors:export_expired` et son jumeau, qui disaient déjà « Le téléchargement … a pris fin ». `{{when}}` et `{when}` sont l’instant complet de l’API (`time.dateAt`), après « le » ou « jusqu’au ». Avant le nom, « de l’organisation {{organisation}} », jamais « de {{organisation}} » (règle du 25 oct.) ; « Tout ce que détient {{organisation}} » n’a pas de préposition. Seule la personne qui l’a demandée télécharge : « uniquement par vous, depuis votre session », rien n’accorde avec le lecteur, et « seule cette personne » pour l’autre. Un plan est un **forfait** (« quel que soit le forfait »). Le pied dit « table de données », pour ne pas confondre avec les tables du plan, et « l’heure à laquelle un service du menu est servi », le service étant aussi celui de l’équipe. Basis d’une ligne de coût est **base de calcul** ; Audit log se nomme comme sa page, « Journal d’audit ». L’objet de l’e-mail met l’issue en tête, « Votre exportation est prête : {organisation} », pour que « prête » reste visible dans une boîte de réception sur téléphone (qa4 #70271).
- **19 nov. 2026. Une personne extérieure à l’organisation dans les Personnes d’un événement** (sc-68421 pour sc-71, `web:eventPeople.addPrompt|findAny|fromOutside|outsideTag|outsideEnds|notJoined|leadOff|removeOutsideLine|unusable|onAlready|pickAnother|jobLabel|jobHelp`, de même dans `mobile:` avec `findAnyone` et `removeLineOutside`, `people.address_*|lead_members_only` de l’API). From outside est **en dehors de** {{organisation}} (titre et ligne sous le nom, face à « Membre de ») ; l’étiquette de la ligne est « Externe à {{organisation}} », épicène, comme « une personne externe ». « Not joined yet » tient lieu de nom : « Invitation en attente », qui ne s’accorde avec personne. Mobile est **portable**. Job label est **Fonction (facultatif)**, la fonction du personnel, sans aucun accès. « {{length}} sur {{most}} » est un compteur de caractères, sans pluriel.
- **18 nov. 2026. Fonctions et services d’un événement, et la couverture** (sc-68779 pour sc-3908, `web:jobs.*`, `web:roster.noJobOption|noShiftOption|shiftHelp|onShifts|onShiftsHint|moreShifts|removeShifts`, `staff.job_*|shift_*|works_as|on_shifts|job_suggested.*` et `errors:staff_*` de l’API). Suit la liste du personnel : Job est **fonction**, Shift **service**, et un service a des **places**, « pourvues » ou « libres ». Les refus `errors:staff_*` disaient « poste » et « créneau » : corrigés, Poste étant déjà Station. Assign est **affecter**, Unassign **retirer du service** ; Remove, pour une fonction, est **Supprimer**, et son « Keep it », « Ne pas supprimer ». Coverage est **couverture** ; la vue se choisit entre **Frise** et **Tableau**. Les toasts commencent par « Fonction » (« Fonction {{job}} supprimée. ») pour que le participe s’accorde avec elle, et ceux d’une personne par « Vous avez » (« Vous avez affecté {{name}}… »). Sans clé de pluriel, « Short 2 » et « +2 more » deviennent « À pourvoir : 2 » et « et 2 de plus » ; `filled_*` est une étiquette, « Places pourvues : 1 sur 3 », car le pluriel suit le total, pas les places pourvues. Une plage est « {{start}} à {{end}} », et « de {{when}} » dans une phrase. Les niveaux d’accès disent « Peut… » : consulter, faire l’accueil (comme l’accueil des invités), servir en salle, tenir le passe, diriger la salle. Les fonctions proposées sont celles de la brigade, épicènes : Maître d’hôtel, Chef de rang, Commis de salle, Bar, Accueil, Cuisine, Sécurité, Son, Animation. À 0, `summaryShort_zero` (19 nov., qa5 #69038) : « Toutes les fonctions sont couvertes en permanence. », et non « 0 fonction manque… », le français prenant `_one` à 0.
- **18 nov. 2026. Les prestataires dans Paramètres : l’annuaire, son formulaire, ses refus et ses toasts** (sc-68021 pour sc-82, `web:settings.sectionVendors`, `web:vendors.*`, `validation.vendor_*` de l’API). Vendor est **prestataire**, le mot du métier de l’événementiel, jamais « fournisseur », qui est déjà le fournisseur d’identité de l’authentification unique. Quote est **devis**. L’annuaire est l’**annuaire**. Archiver et Restaurer, et l’onglet **Archivés**, sont ceux de la bibliothèque de menus ; In use est **Actifs**. Les toasts commencent par « Prestataire », comme « Plat {{name}} archivé. », pour que le participe s’accorde avec lui et jamais avec le nom saisi. Les décomptes de la carte sont des étiquettes (« Actifs : 3 », « Archivés : 1 ») : sans clé de pluriel, « 1 archivés » ne s’accorderait pas. La catégorie suit « dans la catégorie », avec la majuscule du filtre. Catering est **Traiteur**, Venue **Lieu**, Hire **Location de matériel** (jamais du personnel, qui est Staffing, **Personnel**) ; Transport reste « Transport » (dans `same-as-english.json`). Note est **Remarque**. Le pays du téléphone suit un deux-points (« n’est pas valide dans ce pays : {{country}} »), pour ne pas dépendre de son article. Pages, le nom du groupe de navigation lu par le lecteur d’écran, est **Pagination**. Chaque `*TooLong` et son refus d’API sont la même phrase.
- **18 nov. 2026. L’e-mail du forfait gratuit et le refus réservé à Enterprise** (sc-68011 pour sc-581, `emails:planDowngraded.*`, `errors:plan_required`, `messages:access.plan_required`). Un plan payant est un **forfait**, comme `plan_limit` et `team_seats_in_use` : « le forfait gratuit », « le forfait Enterprise », Enterprise jamais traduit. `domain_joining.domain_proved_elsewhere` dit encore « l’offre Enterprise » ; à aligner au prochain ticket qui le touche. L’objet dit « {organisation} passe au forfait gratuit », au présent, pour que rien ne s’accorde avec le nom de l’organisation. « Contact Soirely about Enterprise » est « contactez Soirely au sujet du forfait Enterprise », dans l’e-mail et dans le refus. Les trois réglages sont des noms dans la liste : « Domaines de messagerie », « Journal d’audit », « Suppression des données des invités après chaque événement ». Le pied reprend `twoFactorRecovery.approver.footer`.
- **18 nov. 2026. Les refus à l’ajout d’une ligne de coût au budget** (sc-67958 pour sc-83, `validation.budget_*` de l’API). Rate est **tarif** et Amount **montant**, comme `errors:event_currency_in_use` ; un coût fixe est **forfaitaire** et prend un montant, les autres un tarif. Per head est « par personne », pas « par invité », car les accompagnants comptent aussi ; Staff time est « heures du personnel », et l’écran Staff rates « Tarifs du personnel », entre guillemets. Le label de la ligne est sa « nature » (« Saisissez la nature de ce coût. »). L’exemple suit « par exemple » sans virgule, comme `variant_cost_invalid`, ou « sous la forme » après les décimales. Sous 0 : « ne peut pas être inférieur à 0. Saisissez 0 ou plus. »
- **17 nov. 2026. Quand aucune autre table n’a de place, pour tout déplacer** (sc-65656 pour sc-5030, `web:seating.roomForNone_*`). Le pendant de `roomForAll_*`, avec ses mots : « Aucune autre table n’a de place libre. », qui vaut aussi pour 0 ; pour plusieurs, « Aucune autre table ne peut accueillir les 3 personnes. Déplacez-les une par une. », au féminin par « personnes » ; `_many` sans article et avec « de ». « Déplacer », comme `moveAll`.
- **17 nov. 2026. La ligne au-dessus des tables qui ont de la place, pour tout déplacer** (sc-64380 pour sc-4013, `web:seating.roomForAll_*`). Pour une personne (et pour 0, que le français compte au singulier) : « Tables avec une place libre. », sans « pour lui » ni « pour elle », qui imposerait un accord. Pour plusieurs : « Tables pouvant accueillir les 3 personnes. » ; `_many` sans article et avec « de » : « Tables pouvant accueillir 1 000 000 de personnes. ». « Personnes » plutôt qu’« invités », car la table compte aussi des accompagnants.
  Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **17 nov. 2026. Placer un invité à une table** (sc-61445 pour sc-4013, `web:seating.arrangeTab|seatTab|withoutSeat|pick*|seated*|tableFull|tableShort_*|swap*|race|undoRefused|taken|held|legend|unseatAll|movedAll_*|moveAll|roomForAll|freeLine|emptyTable|…`, `web:guestList.seatedLine`, et `seating.table_full|table_short|seat_taken|undo_stale|table_below_seated|row_below_seated|seat_in_use|guest_not_waiting|companion_of`, `validation.seating_no_such_chair` de l’API). Les onglets sont « Aménager » et « Placer » ; le bac est « Sans place », sans guillemets, comme dans `deletePlanSeated_*`. Une place, jamais un siège : « Occupée », « Réservée à un accompagnant », « Place 2 ». Les accompagnants d’un invité sont « {{name}} et ses accompagnants », jamais un « groupe », qui est la fonction Groupes. Rien ne s’accorde avec `{{name}}` ni avec `{{table}}`, qui peut être une table ou une rangée : « {{name}} a une place à {{table}} », « Il n’y a plus de place à {{table}} ». Des places séparées se disent des places (« leurs places ne sont pas toutes côte à côte »), pas des personnes. `freeLine` met le nombre après deux-points ou entre parenthèses, faute de pluriel ; `roomForAll` a ses formes plurielles (sc-64380). Les réponses « À confirmer » et « Sans réponse » vont entre guillemets dans une phrase. La vue « Tables » est identique à l’anglais, à raison (`same-as-english.json`).
- **17 nov. 2026. Les éléments d’un plat et les accompagnements d’un service** (sc-62831 pour sc-34230, `web:dishItems.*`, `validation.items_*|item_*|own_items_limit` de l’API). Un item est un **élément**, comme sur le plan et le déroulé : « Élément 2 », « Ajouter un élément ». Ce qu’un service ajoute à chaque assiette est un **accompagnement** (« Accompagnements du service », « Accompagnement 1 ») : « Servi avec ce service » redoublait le mot. Plate est **assiette**, puisque « plat » est déjà le dish ; on évite « contient » dans l’aide, qui est le titre des allergènes. Les noms des éléments sont ceux du menu et ne se traduisent jamais. Sans nom : « Élément sans nom », avec majuscule, car il tient la place d’un nom. `moved` dit « {{name}} est désormais l’élément 2 sur 3 », sans participe à accorder avec un nom de genre inconnu. La question est nommée comme dans `dishChoices` : « La question « … » est aussi l’un des éléments du plat {{dish}}. »
- **18 nov. 2026. Quand les choix du menu sont clos** (sc-4042 pour sc-3905, `web:eventMenu.picks*`, `timeline.picks_close|open_menu` de l’API). Le pick de l’invité est son **choix**, et la fin suit « Clôture des réponses » : le jalon est « Clôture des choix », la pastille « Choix jusqu’au {{date}} » ou « Choix clos le {{date}} », en minuscule dans l’en-tête après les décomptes. {{date}} porte le jour (« samedi 12 déc. »), après « au » ou « le ». « Clôture à {{time}}, heure de {{zone}} », puis « Clos à » une fois passé, s’accorde avec « choix ». L’origine : « Selon la date limite de réponse de l’événement » ou « Selon l’heure de début de l’événement ». {{course}} arrive tel que l’hôte l’a saisi (depuis #3000, « Table du Chef » reste ainsi) et ne supporte ni « de » (élision devant « Entrée ») ni article, d’où « pour le service « {{course}} » ». L’action du jalon est « Ouvrir le menu ».
- **17 nov. 2026. Les questions d’un plat** (sc-4042 pour sc-3904, `web:dishChoices.*`, `web:eventMenu.libraryFailed|libraryFailedBody`, `validation.choice_*|option_*` et `menu.choice_*|option_picked` de l’API). Le choice de l’hôte est une **question**, avec ses **options** : « Ajouter une question », « Question 2 », « Un plat peut avoir au plus 3 questions ». Jamais « choix », qui est ce que fait l’invité, ni « options » pour l’ensemble, comme prévu, car cela se heurte aux options qu’il contient. Une confirmation commence par « Question » pour que le participe s’accorde : « Question « {{question}} » ajoutée au plat {{dish}}. » ; « {{named}} enregistrée comme brouillon » s’accorde aussi avec elle. La réponse en plus d’une question facultative est **« Rien pour moi »**, entre guillemets quand on la cite ; sc-3907 reprendra la même. Le nombre à choisir est une étiquette, « Options à choisir : 2 sur 4 », car la clé n’a pas de pluriel. « Options » et « Option {{n}} » sont dans `same-as-english.json`. Les allergènes suivent « dont les besoins indiquent : », comme `dishVariants.unwarned`.
- **17 nov. 2026. L’écran de salle et Afficher sur un écran** (sc-62010 pour sc-3897, `web:roomScreen.*`, `web:showOnScreen.*`). Le lien est un **lien d’écran**, et le changer, c’est **remplacer**, jamais « réinitialiser », réservé au lien d’agenda. « Maintenant » et « À suivre » titrent l’écran, comme le déroulé. {{place}} passe par « l’espace {{place}} », comme `night.nothingElse`, pour ne dépendre d’aucun article. Le bouton dit « Copier le lien », sans « d’écran », pour que trois boutons tiennent sur la ligne à 1280. Écran final : « Merci de votre présence », sans accord.
- **17 nov. 2026. Qui d’autre est sur le plan** (sc-60777 pour sc-4719, `web:seating.onPlan|andOthers_*|moreOnPlan_*|onThisPlan|personCanView|canView|reconnecting|choseToo|chosenBy|seatChosenBy|joinedPlan|leftPlan`). Les autres se comptent en personnes : « Priya Shah et 2 autres personnes », « 4 autres personnes sur ce plan » ; `_many` prend « d’ », « 1 000 000 d’autres personnes ». « Peut consulter » est le rôle de l’événement ; sur la pastille, « Sade Bello, peut consulter » se lit comme un verbe, et c’est bien ce qu’il dit. `chosenBy` et `seatChosenBy` s’enchaînent en un seul nom accessible, et {{name}} peut être une table, une rangée ou une place, donc pas de participe à accorder : « Table 1, choix de Kemi Adeyemi et Priya Shah, place 2, choix de Julien Moreau ». `choseToo` dit « cet élément », comme `chosenCount_*`. « a rejoint le plan », « a quitté le plan » ; « Reconnexion… », comme `night.reconnecting`.
- **16 nov. 2026. Le déroulé en direct : Terminé, Passer, Commencer, les actions hors connexion et la fin** (sc-59333 pour sc-3895, `web:night.*`, `mobile:night.*`, `run_of_show.track_busy|idempotency_key_*|pressed_at_invalid` de l’API). Suit `runView` : déroulé, espace, élément, « Terminé », « Plus tard », titres entre guillemets. Skip est **Passer**, comme l’étape ; son état est « Sauté », car « Passé », dans une liste d’horaires, se lirait comme « déjà passé ». Start now est **Commencer** sur le bouton, sans « maintenant », pour tenir à côté de Passer sur un téléphone ; le libellé du lecteur d’écran le garde : « Commencer « … » maintenant ». Leave it, dans le panneau Déplacer, est « Laisser en place ». Ce qui attend l’envoi est une **action**, jamais un « appui », réservé aux erreurs de l’API : « 1 action en attente d’envoi. », « Connexion rétablie. Actions envoyées. ». View only est « Consultation seule ». Les compteurs sont des libellés, « Terminés : 2 sur 5 », et la fin s’accorde avec le déroulé : « Terminé avec 5 min de retard. ». Le titre d’un élément n’est jamais sujet d’un participe : « Fin de « … » à 21:50. ». Espaces insécables avant les deux-points et dans les guillemets, comme partout ; `runView` reste à corriger sur ce point. « {{count}} min » et « {{hours}} h {{minutes}} min » sont identiques à l’anglais. Depuis le 17 nov. 2026, `mobile:night.reconnecting_*` met U+00A0 entre le nombre et « min », pour que « 1 min » ne se coupe pas sur le téléphone (recette de sc-59333).
- **16 nov. 2026. Le mot de remerciement des hôtes à leurs invités** (sc-60164 pour sc-6476, `web:thankYou.*`, `mobile:thankYou.*`, `validation.event_thank_you_too_long` de l’API). Thank-you est **mot de remerciement**, masculin singulier : « Ajouter un mot de remerciement », « Modifier le mot de remerciement », « Mot de remerciement enregistré. », « Mot de remerciement retiré. » (retirer, comme `remove`). Pas « remerciements » au pluriel, qui annonce une liste, ni « message ». L’aide dit comment il est signé, « signé du nom des hôtes », jamais « de vos hôtes ». Les échecs suivent `guestKitchen.saveFailed` et `eventEnd.notEnded` : « Non enregistré. » / « Non terminé. », puis quoi faire, puis que le texte est toujours là. La limite suit `eventHosts.tooLong` : « ne peut pas dépasser {{max}} caractères ». Le bouton le plus long, « Modifier le mot de remerciement », tient à 320 px sur une ligne.
- **16 nov. 2026. Le menu d’un événement : ses services, les plats de chacun et les refus** (sc-58053 pour sc-3902, `web:eventMenu.*`, `validation.course_*`, `menu.course_limit|course_picked|dish_picked|same_one_dish` et leurs `errors:menu_*` de l’API). Un course est un **service**, le mot du repas en plusieurs services ; c’est aussi le Shift de la Liste du personnel, mais jamais sur le même écran. Les suggestions sont Entrée, Plat principal et Dessert. L’option « Everyone gets the same » est « Le même plat pour tous », plus court et plus clair que « Tout le monde a la même chose » que dev4 avait écrit dans `errors:menu_*` ; la phrase qui la nomme : « « Le même plat pour tous » n’est possible qu’avec un seul plat. ». Les confirmations commencent par « Service » ou « Plat » pour que le participe s’accorde avec lui : « Service {{name}} ajouté… », « Plat {{dish}} retiré du service {{course}}. ». `saved` reçoit un nom de service ou de plat, d’où « {{name}} : modifications enregistrées. ». `skipOn` reçoit le nom en minuscules : « Sans {{course}} pour moi », jamais « Pas de », qui s’élide devant « entrée ». « Services prêts : 2 sur 4 », en étiquette, car la clé n’a pas de pluriel. La ligne sous Menu dans la barre latérale de l’événement, `eventNav.menuReady` (sc-3904, #2781), dit la même chose avec les mêmes mots. Menu, Suggestions et Dessert sont dans `same-as-english.json`. La ligne de lecture seule (`eventMenu.lock`, et `lock` de la bibliothèque de plats) finit par « Une personne dont le rôle permet de modifier Menu peut le faire. », comme l’anglais ; « Les rôles autorisés à modifier Menu le permettent » tournait en rond (QA, 16 nov.).
- **16 nov. 2026. La bibliothèque de plats** (sc-4042 pour sc-3901, `web:nav.menuLibrary`, `web:menuLibrary.*`, `validation.dish_*`, `dish.name_shared|in_use` et `errors:dish_in_use` de l’API). Menu library est « Bibliothèque de plats » : elle dit ce qu’elle contient. Un dish est un **plat** ; Archive est **Archiver**, l’onglet « Archivés », Restore **Restaurer**. Suitable for est « Régimes compatibles », le mot des noms de régime (`guestNeeds.dietName.*`). Allergen est **allergène** ; les 14 noms sont ceux de `guestNeeds.allergen.*`, jamais une seconde liste. Une confirmation commence par « Plat » pour que le participe s’accorde avec lui et non avec le nom saisi : « Plat {{name}} enregistré. », comme « Groupe {{name}} supprimé. ». Les incompatibilités se disent avec « ni » : « Un plat végan ne peut contenir ni lait ni œufs. ». Le refus de suppression se termine par « Archivez-le plutôt. », comme l’anglais.
- **16 nov. 2026. Déplacer, faire pivoter et redimensionner sur le plan** (sc-56592 pour sc-5028, `web:seating.saved|saving|retrying|snap|across|down|overlaps|outside|lengthLike*|stepRefused|movedTo|turnedTo|tip|keys|key*|placing*|placeCentre|stopPlacing|placeAnother|chosenCount_*|moveTogether|shiftClick`, et `validation.seating_arrange_*|seating_seat_does_not_turn|seating_outside_room|seating_row_outside_room`, `seating.no_such_item` de l’API). "Chosen" se dit **choisi**, jamais « sélectionné », et ce qu’on choisit est un **élément** (« 2 éléments choisis »), puisqu’il mêle tables, rangées et places. "Across" et "Down" sont « Horizontal » et « Vertical », sous-entendu le décalage ; dans une phrase, « à l’horizontale », « à la verticale ». La bande des raccourcis met un verbe à la troisième personne après la touche, sans « de » devant la mesure, pour tenir sur une ligne à 1440 px (« déplace 10 cm », « pivote 15° », « demande avant », « relâche »). Une rangée nommée par son libellé garde l’article : « La rangée A se trouverait hors de la salle. » Les touches s’écrivent comme sur la bande, « Shift » et « Esc », tant que la bande n’a pas leurs noms français (Maj, Échap) dans le catalogue. « Continuer à placer », pas « En placer une autre », pour ne pas accorder avec la table, la rangée ou la place ; dans la ligne de placement, le pronom suit l’objet : « Elle s’aligne », mais « Il s’aligne » pour le mange-debout. On ne fait pivoter que des tables et des rangées, féminines : « pivotée ». Les unités US suivent l’aide en pieds : « 1 pi », « 3 po ».
- **16 nov. 2026. Le déroulé le jour J** (sc-33154 pour sc-1404, `web:runView.*`, `mobile:runView.*`). Run of show reste **« Déroulé »**, titre comme bouton, distinct du « Programme » d’où il s’ouvre. L’horloge dit « Il est {{time}} » (« … sur place » sur le web), sans « Maintenant » devant une heure. On time est « À l’heure », behind « {{count}} min de retard ». Un track est l’**espace** ; Later est « Plus tard », à côté de « Maintenant » et « Ensuite ». Le titre d’un élément est entre guillemets, comme dans le programme, et « commencé à » et « vers » ne s’accordent avec rien. Les variantes `_hour1` répètent le texte de base : « à 1:15 » ne change pas. « {{count}} min » de `mobile:runView.minutes_*` est identique à l’anglais.
- **17 nov. 2026. Le Maintenant d’Aujourd’hui d’après le déroulé** (sc-33154 pour sc-29875, `mobile:todayScreen.run*|nowTitle|rail*`). Suit `runView` et `night` : « Maintenant · {{title}} », « {{count}} min de dépassement », « … de retard ». « jusqu’à {{time}} » vaut pour toutes les heures. Les états lus par le lecteur d’écran sont en minuscules et au masculin de l’élément : « terminé », « en cours », « ensuite », « plus tard », titre entre guillemets : « 21:30, « Dîner », en cours ».
- **15 nov. 2026. Coller la réponse d’un invité depuis sa propre messagerie** (sc-54804 pour sc-54450, `mobile:guestList.paste.*`). Le bouton est « Coller une réponse », le titre « De qui vient cette réponse ? », qui sert aussi d’étiquette de retour au formulaire de saisie : « À qui est cette réponse ? » se lisait comme son destinataire. Le chat de l’hôte est « la discussion », le mot de WhatsApp en français. « Son message » ne s’accorde pas avec l’invité. `everyone` ne s’accorde avec personne (« Toutes les personnes invitées », « recherchez la personne ») et nomme la recherche par ce qu’elle fait, pas par son étiquette. « Show all » sous une longue citation est « Tout afficher » : on déplie un texte, pas une liste chiffrée comme `showAll_*`. `rowLine` reste identique à l’anglais : deux emplacements et un point médian.
- **16 nov. 2026. Le pied du panneau de modification du programme** (sc-54069, QA #55615, `web:schedule.save|addAgain|deleteItemAsk`). Le pied est une seule ligne qui ne passe pas à la ligne, et « Enregistrer l’élément » dépassait du panneau de 68 px. Les trois boutons se passent du complément, puisque le panneau est celui de l’élément : « Supprimer… », « Annuler », « Enregistrer ». Quand une autre personne l’a supprimé, le bouton principal est « Rétablir ». La confirmation garde « Supprimer l’élément » (`deleteItem`), où la place ne manque pas.
- **15 nov. 2026. Construire le programme sur le web** (sc-54069 pour sc-3893, `web:schedule.*`, `validation.schedule_*`, `run_of_show.item_limit|version_required|changed_since`, `timeline.run_of_show_begins` de l’API). Schedule est « Programme », comme `eventNav.schedule` ; Run of show reste « déroulé ». Un item est un **élément**, comme `errors:schedule_item_limit`. Un « place » est un **espace**, jamais « lieu » (celui de l’événement) ni « zone » (celle du plan de table) ; l’espace par défaut est « Principal ». Chaque espace est un **tableau**, pour ne pas le confondre avec les tables. « Owner » est « Responsable », et la note est « pour la personne responsable », sans accord. Les avis commencent par l’élément, pour que rien ne s’accorde avec son titre : « Élément ajouté : « {{title}} ». ». « {{place}}’s table » devient « le tableau de l’espace {{place}} », qui évite « de » devant une voyelle. La fin et le fuseau sont des libellés : « Fin : {{time}}. », « Les horaires sont indiqués en {{zone}}. » : le navigateur nomme déjà le fuseau en commençant par « heure » (« heure : Royaume-Uni », « heure d’Afrique de l’Ouest »), donc jamais derrière l’étiquette « Fuseau horaire : » (sc-54069, QA). Le conflit reprend `guestList` : « La sienne », « La vôtre », « Prendre la sienne », « Garder la mienne ». Jamais d’espace insécable à l’intérieur d’un argument ICU (`{max, number, ::group-auto}`) : le squelette ne se lit plus et s’affiche tel quel ; l’insécable va hors des accolades (sc-54069, QA).
- **15 nov. 2026. La liste du personnel dans Équipe** (sc-4286 pour sc-3906, `web:roster.*`, `validation.staff_name_*`, `staff.number_shared|finished_keeps` de l’API). « Équipe » comme `eventNav.staff` ; le Roster est « Liste du personnel », comme `errors:staff_number_shared`. Job est « Fonction », Station « Poste » (d’où Fonction, pour ne pas avoir deux Postes), Shift « Service », comme `notificationSettings.note.event_day`. Rien ne s’accorde avec la personne : « Vous avez ajouté {{name}} », « Impossible de retirer {{name}} » ; « Keep them » est « Ne pas retirer ». L’écran Hours worked est nommé entre guillemets, « Heures travaillées ».
- **15 nov. 2026. Le champ de recherche tient en un mot** (sc-53041, qa5 #53932, ux #54001, `web:search.field.*`, `mobile:search.field.*`). Les sept variantes du champ sont « Rechercher », dans toutes les mises en page : la phrase longue était tronquée sur téléphone, et la piste sous le champ (`search.hint.*`) dit déjà ce que l’on peut trouver. « Rechercher » et non « Chercher », le verbe des autres champs de recherche. Remplace les variantes du champ de l’entrée suivante ; la piste les garde.
- **15 nov. 2026. Rechercher parmi les événements, les invités et les membres** (sc-53041 pour sc-39534, `web:search.*`, `mobile:search.*`). « Rechercher » et « Effacer la recherche », comme les autres recherches. Un seul type : « Rechercher un événement », comme `eventsSearch.label` ; plusieurs : « Rechercher événements, invités et membres », sans article, pour tenir dans le champ du téléphone. Les pistes disent « Trouvez … ». « Match » est « résultat » : « Aucun résultat pour « {{term}} ». », et « 0 résultat » au singulier, comme le veut le français. La situation du membre reprend Membres (« En attente d’approbation », « Accès suspendu ») ; « Invited » est « Invitation envoyée », le filtre « Invitations » ne pouvant servir d’état. La ligne de l’événement reprend Événements : « Du … au … », « Annulé le … », « Lieu à confirmer ». Les touches sont celles d’un clavier français : « Entrée », « Échap ».
- **15 nov. 2026. Enregistrer les invitations depuis la barre de sélection** (sc-50013 pour sc-46880, `web:guestSelect.markAsInvited|markTitle_*|alreadyNamed_*|more_*|nothingToMark_*|marked_*|keptAsRecorded_*|notLive`). Suit `guestList.markAsInvited` : le bouton de la barre est « Enregistrer les invitations », au pluriel parce qu’il agit sur plusieurs invités, et le titre « Enregistrer les invitations de 3 invités ». Les phrases parlent de l’invitation, qui s’accorde toujours au féminin singulier ou pluriel, jamais de la personne : « 3 invités dont l’invitation est déjà enregistrée et reste inchangée : … », « Les invitations déjà enregistrées de 3 invités restent inchangées. ». La ligne de résultat reprend « Invitation faite {{how}} » de la ligne Invitation : « Invitations faites via WhatsApp enregistrées pour 3 invités. ». `more_*` est le dernier élément d’une liste `Intl.ListFormat` : « Ngozi Eze, Kemi Bello et 3 autres », « et 1 autre ». « No longer live » est « n’est plus publié », comme la phase « Publié ».
- **14 nov. 2026. Sélectionner plusieurs invités sur le web** (sc-49714 pour sc-3776, `web:guestSelect.*`, `validation.guests_too_many` de l’API). Retirer suit `guestList` : « Retirer de la liste », « Retirer {{guests}} ? », « Vous avez retiré {{guests}} de la liste, ainsi que {{companions}}. » ; le bouton est « Retirer {{count}} ». Le titre avec accompagnants est « Retirer {{guests}} avec {{companions}} ? », car « leurs » ne s’accorde ni avec un seul invité ni avec un seul accompagnant, que le pluriel de `count` n’atteint pas ; pour la même raison, `groupLine` est « Les accompagnants suivent leur invité. ». Les lignes qui ne portent que le nombre le complètent par « invité », que le pluriel atteint : « 3 invités déplacés dans {{group}}. ». « Act on up to » est « traiter jusqu’à », sans nommer déplacer ni retirer. Clear est « Effacer », comme `guestList.clear` ; l’onglet, « Tous » ; Undo, « « Annuler » », le bouton du toast. L’erreur de l’API écrit le nombre, « 2 000 » avec l’espace fine insécable que donne `Intl` en fr-FR.
- **14 nov. 2026. La ligne des réponses de Vos événements, dans Aujourd’hui** (sc-49591 pour sc-29881, `mobile:todayScreen.replies|repliesSpoken|repliesComing_*|repliesShare_*|invitationsNotSent`). Les chiffres suivent sc-48438 : « 152 viennent · 91 % de réponses », « 1 vient », 0 au singulier ; `_many` sans « de », faute de nom. La part est sans verbe, « de réponses », pour que rien ne s’accorde avec le pluriel du pourcentage. Sans invitation envoyée, « Invitations non envoyées ».
- **14 nov. 2026. Les chiffres des invités dans Événements et la Vue d’ensemble** (sc-48438 pour sc-3786, `web:events.comingOpens|notRepliedOpens`, `mobile:eventsScreen.*`, `guestNumbers.*`, `mobile:guestList.invited`). La ligne est « 4 viennent sur 9 avec invitation. », « 1 vient sur 1 avec invitation. » : « avec invitation » ne s’accorde pas avec le second nombre, que le pluriel de `count` n’atteint pas. Imbriquer `invitedPeople_*` par `$t(…)` exige `{{invited}}` sans format, que la garde des nombres refuse. Puis « Chaque nombre mène aux invités qu’il compte. ». « Invited », ligne et filtre, est « Avec invitation », pendant de « Sans invitation » ; jamais « Invités », qui est le titre. Les noms lus par le lecteur d’écran reprennent le mot de la ligne : « Vient : 4, ouvre « Vient » ». L’échec est « Les décomptes des invités n’ont pas pu être chargés. » ; sans invitation, « Personne n’a encore été invité », car la liste peut avoir des invités. `heldLine` est « Accompagnants en attente de la réponse à l’invitation », sans « leur invité », qui s’accorde.
- **14 nov. 2026. Retirer un invité de la liste, et l’annuler** (sc-49021 pour sc-3774, `web:guestList.removeFromList|removeTitle|removeGoes|theirReply|removeNothingSent|keepOnList|removeGo|alreadyRemoved|guestRemoved*|undoOpen|backOnList`). « Retirer », comme `remove`, jamais « Supprimer ». Le toast est « Vous avez retiré {{name}} de la liste. », comme `removed` : avec « avoir » et le complément après, rien ne s’accorde ; les accompagnants viennent avec « ainsi que {{companions}} ». La liste de ce qui part est « Ce qui part avec cette personne : ». « Aucun message n’est envoyé. », sans « lui », car la même phrase sert au retrait de plusieurs invités (sc-3776). Le retour est « De retour sur la liste, comme avant », jamais « rétabli(e) ».
- **14 nov. 2026. Le sélecteur de groupe de l’app** (sc-49576 pour sc-5519, `mobile:guestGroups.forWhom|chooseOrType`). « Pour {{name}} et ses accompagnants. » : « ses » ne se confond pas avec « vos » et ne s’accorde qu’avec « accompagnants ». Le champ est « Choisissez ou saisissez un groupe », aussi comme nom accessible ; « saisir », comme ailleurs pour un champ. `guestList.withGroup` ne fait que joindre des valeurs et reste comme l’anglais.
- **14 nov. 2026. Les groupes d’invités, et Groupes sur ordinateur** (sc-48422 pour sc-3775, `web:guestGroups.*`, et `validation.guest_group_*` de l’API). « Groupe » et « Sans groupe », entre guillemets quand une phrase le nomme. `{{name}}` est le nom que l’hôte donne au groupe : rien ne s’accorde avec lui, on écrit « Groupe {{name}} créé. », « Groupe renommé : {{name}}. ». Renommer est « Renommer », et le nom accessible commence de même, « Renommer {{name}} ». Les comptes reprennent `guestList.countGuests|countCompanions` ; sans accompagnant, « aucun accompagnant » après « et ». `ofMost` est « {{count}} sur {{most}} caractères », qui n’a pas besoin de pluriel sur le premier nombre.

- **14 nov. 2026. L’invité dit à la cuisine ce dont il a besoin, sur sa propre page** (sc-48201 pour sc-3778, `web:guestKitchen.*`, `web:guestNeeds.changedByGuest`). Le titre est « La cuisine doit-elle savoir quelque chose ? ». "Your server" est « le personnel de salle » : « La cuisine et le personnel de salle en seront informés. ». Un hôte de la liste peut être un couple, donc rien ne s’accorde avec `{{hosts}}` : « Également noté par {{hosts}} : », « Dernière modification par {{hosts}} le {{date}}. », avec « par » qui évite l’élision. `{{label}}` est un besoin d’accessibilité, de genre variable, donc il vient après deux-points : « À retirer à l’envoi : {{label}}. », « Retirer : {{label}} », « Garder : {{label}} ». Un accompagnant sans nom est « Accompagnant », « Accompagnant 2 », comme « Besoins de l’accompagnant ». « Nothing to add » est « Rien à signaler » ; « Leave it as it is », « Laisser tel quel ». Allergies reste comme en anglais (`same-as-english.json`).
- **14 nov. 2026. Envoyer via WhatsApp, et l’invitation que lit l’invité** (sc-48234 pour sc-26025, `web:guestList.sendOnWhatsApp*|sendLine|sentOnWhatsApp|notSent|ifNotOpened|whatsAppMessage_*`). « Envoyer via WhatsApp », avec « via », comme `howMid` ; le nom accessible commence de même, « Envoyer via WhatsApp à {{name}} ». La question et le bouton parlent de l’invitation, pas de la personne : « Invitation envoyée à {{name}} via WhatsApp ? », « Non envoyée ». Un bouton cité dans une phrase est entre guillemets : « utilisez plutôt « Copier le lien d’invitation » ». Le message s’ouvre sur « Bonjour {{greeting}}, » seul sur sa ligne, sans virgule entre « Bonjour » et le nom (sc-48750) ; ainsi le nom de l’invité n’est pas lu comme celui d’un hôte. « Bonjour » ne s’accorde pas, « Cher » ou « Chère » s’accorderait, et le message est lu à toute heure, donc jamais « Bonsoir ». Ensuite : « {{hosts}} a / ont le plaisir de vous inviter à l’événement {{event}}, le {{date}}. », « l’événement {{event}} » parce que le nom ne prend pas d’article. « Your own page » est « Votre page personnelle ».
- **14 nov. 2026. Les allergies, le régime et l’accessibilité d’un invité** (sc-47679 pour sc-3777, `web:guestNeeds.*`, `validation.guest_need_*` de l’API). La section est « Besoins », au masculin : « Aucun indiqué », « 2 indiqués ». Celle d’un accompagnant est « Besoins de l’accompagnant », pas « Ses besoins ». Le nom accessible met le nom après deux-points, « Besoins : {{name}} », « Note privée : {{name}} », pour ne pas élider « de » devant une voyelle. « Shown first » ne s’affiche que sur Allergies : « Toujours affichées en premier ». L’erreur d’un Autre vide est « Précisez ici », qui ne s’accorde ni avec l’allergie ni avec le régime. Les régimes s’accordent avec « régime » : Végétarien, Végan, Pescétarien, Casher. Halal et Lupin restent comme en anglais (`same-as-english.json`). Les allergènes sont les quatorze du règlement (UE) 1169/2011 sous leur nom français, un seul nom partout, menu de sc-4042 compris : Céréales contenant du gluten, Crustacés, Œufs, Poisson, Arachides, Soja, Lait, Fruits à coque, Céleri, Moutarde, Sésame, Anhydride sulfureux et sulfites, Lupin, Mollusques. Le compteur reprend celui du nom : « Caractères : 12 sur 500 ».
- **14 nov. 2026. Qui vient avec vous ? et Places pour les accompagnants** (sc-47095 pour sc-3779, `web:guest.withYou*`, `web:guestList.placesFor|fewerPlaces|morePlaces|namedOf|placesRefused|thisGuest|namedByGuest|companionsNamed_*`, `validation.guest_places_full` de l’API). `withYouPlaces` ne reçoit pas le nombre d’hôtes, donc rien ne s’accorde avec eux : « Places réservées par {{hosts}} : vous et jusqu’à 2 accompagnants. », avec « par » qui évite d’élider devant un nom. Le décompte des noms est une étiquette, « Noms : 1 sur 2 », qui ne s’accorde avec rien ; le refus suit, « Noms déjà indiqués pour {{name}} : 2. Retirez-en d’abord. », et "This guest" y est « cette personne », en minuscule, car il vient en milieu de phrase. Qui a donné le nom s’accorde avec « nom » : « Nom indiqué sur votre invitation », « Nom que vous avez indiqué », « Nom indiqué par l’invité ». Le bouton « Renommer » d’un accompagnant se lit « Modifier le nom : {{name}} », sans « de » devant le nom. Les lignes de la liste disent « Vient » et « Ne vient pas », le mot de l’hôte, y compris sur la ligne de l’invité, car la clé est partagée avec les accompagnants ; une clé à part pour la ligne de l’invité, qui dirait « Je viens » comme sc-43807, est demandée à dev1 sur sc-3779. L’étiquette de l’étape de vérification est « Qui vient ». Le bouton qui confirme un nom est « Valider ». Depuis #2192, la ligne de l’invité a sa clé, `withYouSelfComing` : « Vous venez », à côté de « C’est vous », pour rester au vouvoiement de la ligne (« Je viens » mêlerait deux personnes sur une ligne) ; les accompagnants gardent « Vient ». `withYouPlacesByOne`, pour un seul hôte, reprend `withYouPlaces`, qui ne s’accorde déjà avec personne.
- **14 nov. 2026. Une adresse que nos e-mails n’atteignent pas, dans Votre compte** (sc-47208 pour sc-44949, `web:account.undeliverable|changeEmail|changeEmailFor`, de même dans `mobile:`). « Nos e-mails ne parviennent pas à {{address}}. » remplace « Nous n’avons pas pu remettre d’e-mail à… » : « remettre » est le jargon des serveurs, et la ligne dit un état qui dure, pas un envoi manqué. L’action est « Changer d’adresse », le glossaire disant _adresse e-mail_ ; son nom accessible commence par les mots visibles, « Changer d’adresse, actuellement {{address}} » : « au lieu de » devait s’élider devant une adresse à voyelle (« au lieu d’adebayo… »), ce qu’une interpolation ne sait pas faire (qa2, #47540).
- **14 nov. 2026. La langue d’un invité, sur sa page et dans le formulaire de l’hôte** (sc-45625 pour sc-3790, `web:guest.languageSwitched|languageNotSaved`, `web:guestList.languageNotSet|languageHint|languageNotSetLine|languageChose`, `validation.guest_language_unknown` de l’API). « Not set » est « Non défini », au masculin comme « choix », distinct de `guestList.none`, « Non renseigné » : non défini, il décide quand même. `{{language}}` vient toujours après deux-points, « … celle de l’organisation : {{language}} », parce qu’il arrive avec une majuscule (« Anglais », ou le nom propre « Português ») qu’une phrase française n’écrit pas. « Langue choisie sur sa propre page » n’accorde rien au genre de l’invité. Dans l’aide, « du navigateur » plutôt que « son navigateur », pour que « votre organisation » soit sans ambiguïté celle de l’hôte. Le refus nomme les quatre langues comme le sélecteur, chacune dans la sienne.
- **13 nov. 2026. Le refus d’un événement annulé ou terminé** (sc-44798, `errors:event_concluded`). « L’événement est terminé ou a été annulé. » : le titre vaut pour chaque cas, y compris la réponse d’un invité à un événement annulé avant son début, il ne dit donc plus que la fin est passée. « Annulé », comme l’étiquette de phase ; « est terminé », comme `event.already_over`.
- **13 nov. 2026. Les informations d’un invité, leur modification et celle de quelqu’un d’autre** (sc-43485 pour sc-3773, `web:guestList.pick|details|edit|none|…|discard*|replyHeading|repliedOn`, `validation.guest_companion_unknown`, `guest.version_required|changed_since` de l’API). La section est « Informations », jamais « Détails ». Un champ vide est « Non renseigné », sous-entendu le champ, donc rien ne s’accorde avec l’adresse. "Added" est un libellé, « Date d’ajout », sous « {{date}}, par {{name}} » ; « Ajouté » s’accorderait avec l’invité. Pour la même raison : « Cette personne n’est pas sur cette liste », « Vous avez retiré {{name}}. », et l’accompagnant en attente « ne vient que si l’invitation est acceptée ». Le 412 est celui du 8 nov. : « La sienne · La vôtre », « Prendre la sienne », « Garder la mienne ». La boîte d’abandon suit `eventPeople` : « Abandonner vos modifications ? », « Continuer à modifier », « Abandonner ». `repliedOn` reste en minuscule, comme l’anglais, après la réponse. `version_required` reprend `seating.`, « dans l’en-tête If-Match ».
- **13 nov. 2026. Le lien propre à chaque invité, et le lien reçu par erreur** (sc-43781 pour sc-1526, `web:guest.closing|tell*|goBack`, `web:guestList.copyLink*|replace*|linkCopied|invitationLink|clipboardRefused|keepIt|notReplaced|linkReplaced|flagged*|pausedLine|finishedLine`). Rien ne s’accorde avec la personne qui a ouvert le lien : « ce lien vous est parvenu par erreur », « Ce lien a peut-être été reçu par erreur », « il ne lui était pas destiné ». Après {{hosts}}, une relative : « Nous avons prévenu {{hosts}}, qui va / qui vont s’en occuper. » Pas de « de » devant le nom de l’invité (règle du 11 nov.) : « le lien envoyé à {{name}} », « l’invitation adressée à {{name}} ». Remplacer suit `requestLink` : « Remplacer le lien… », « Le garder » ; "straight away" est « aussitôt ». Le bouton « Prévenir » ne s’accorde pas avec le nombre d’hôtes. Les blocages suivent `nextMakeLive` : « Personne ne peut être invité tant que… ». « Invitation », en-tête de colonne, est le mot juste et figure dans `same-as-english.json`.
- **11 nov. 2026. Pas de « de » devant le nom d’un membre** (QA, sc-38929, `web:membersScreen.request*|roleDialogTitle|roleFor|awaiting.*|card.turnedDown`, `mobile:membersScreen.awaiting.*|card.turnedDown`). Un prénom qui commence par une voyelle donnait « Demande de Adebayo ». Comme pour `ownerClaim`, c’est « la demande faite par {{name}} » et « Rôle attribué à {{name}} », bouton « Refuser la demande faite par {{name}} ». Remplace « Demande de {{name}} » et « Rôle de {{name}} » de l’entrée suivante.
- **11 nov. 2026. Membres sur le web de bureau, le résumé d’abord** (sc-38929 pour sc-34200 et sc-30189, `web:membersScreen.card.*|waiting*|request*|role*|remove*|…`, `web:ownerClaim.copyPart|partCopied`). Là où l’anglais est celui de l’app, le web reprend `mobile:membersScreen.*` et `mobile:ownerClaim.*`. Nouvelles : le titre de la boîte de dialogue du rôle est « Rôle de {{name}} » ; « Retirer {{name}} de l’organisation {{organisation}} ? », bouton « Retirer » ; abandonner une invitation dit « Aucune invitation n’est envoyée. », jamais « Personne n’est invité », qui s’accorde ; « Demande de {{name}} » ; « Aller dans Général », sans « › ».
- **11 nov. 2026. Les jours cachés de la carte d’un événement** (sc-38573 pour sc-30413, `web:events.moreDays_*`, `mobile:eventsScreen.moreDays_*`). La case « +N », lue seulement par le lecteur d’écran, dit « {{count, number}} jours de plus », plutôt que « autres jours », qui laisserait croire à d’autres dates ; `_many` prend « de », « 1 000 000 de jours de plus ». Le web et l’app disent la même chose.
- **11 nov. 2026. Répondre à une demande pour revenir dans l’app** (sc-38005 pour sc-30894, `mobile:membersScreen.card.toGetBackIn_*|toJoin_*`, `mobile:recoveryRequests.*`). `recoveryRequests.*` reprend `web:recoveryRequests.*`. La seconde ligne de la carte compte des personnes avec un verbe accordé : « 2 demandent à revenir · 1 demande à rejoindre », 0 et 1 au singulier ; `_many` sans « de », faute de nom. « Fermer » et « Envoi de votre réponse… ».
- **11 nov. 2026. Membres dans l’app, le résumé d’abord** (sc-37811 pour sc-37693, `mobile:membersScreen.card.*|waiting*|whenWord.*|request.*|role*|makeOwner*|remove*`, `mobile:ownerClaim.*`). "Waiting" est « En attente », aussi dans le décompte, « 3 personnes · 1 en attente », invariable ; `_many` prend « de » devant le nom seulement, « 1 000 000 de personnes ». "Former" est « Anciens » : « Cette personne figure dans Anciens. ». Un changement de rôle « prend effet dès sa prochaine utilisation de Soirely », et "Nobody is signed out" est « Aucune session n’est fermée. », jamais « Personne n’est déconnecté », qui s’accorde. "Make owner" est « Donner le rôle Propriétaire ». `whenWord.*` est sous la date, donc un libellé : « Date de la demande », « Date de départ ». `copyNamed` est « Copier le champ {{label}} », sans accord avec Type, Nom ou Valeur. `stopAskBody` reprend `stopBody`, et `theirsUnfound` `pausedUnfound`.
- **10 nov. 2026. Le Calendrier sur le web** (sc-36920 pour sc-30413, `web:calendar.moreItems_*|chosen|barStatus|barLabel|markLabel`). La pastille d’une case du jour est « +{{count, number}} autre », « +{{count, number}} autres » : « autre » s’accorde en nombre et pas en genre, quel que soit l’élément caché. `chosen` prend U+00A0 avant les deux-points, « Afficher : Événements seulement ». `barStatus`, `barLabel` et `markLabel` ne sont que ponctuation et emplacements, identiques à l’anglais. Dans l’app, `mobile:calendar.moreItems_*` dit la même chose et `retry` est « Réessayer ».
- **10 nov. 2026. La carte d’un événement et sa page sur le web** (sc-36898 pour sc-30413, `web:events.calledOff|today|itsDays|dayOf|nextUp`, `web:eventPage.*`). L’étiquette de phase est « Annulé » ; « Prochaine étape : {{title}} », comme `timeline.nextUp`. La case du jour dit « Aujourd’hui » en entier : en gras 12 px il fait 66 px, et la case s’élargit à son libellé (82 px, b4fc52005) ; « Auj. » n’a servi que le temps de cet élargissement (d0dd1920d). Le nom des cases pour le lecteur d’écran est « Jours de l’événement ». « Fil d’Ariane », comme `seating.crumb` ; « Heures dans le fuseau {{timeZone}} », comme `eventDuplicate`. Les libellés de la page reprennent ceux de l’app (sc-36555).
- **10 nov. 2026. Créer une organisation sur le web de bureau** (sc-37138 pour sc-30412, `web:createOrganisation.*`). Les questions, « De cet appareil », « Tous les pays », « Aucune pour l’instant » et la feuille « Abandonner la création ? » sont celles de l’app (sc-36766). Les boutons sont « Retour » / « Continuer », « Continuer à modifier » dans la feuille ; la recherche est « Rechercher un pays », et sans résultat « Aucun pays ne correspond à « {{text}} ». ». Ce que lit le lecteur d’écran au choix d’un pays suit le modèle de la carte, libellé puis valeur après une virgule : « Devise, {{currency}}. Fuseau horaire, de cet appareil, {{zone}}. »
- **11 nov. 2026. Le compte en attente de la carte Membres** (sc-37811, `mobile:membersScreen.card.waiting_*`). « 2 en attente » s’écrit avec deux espaces insécables : sur un téléphone, la ligne « 4 personnes · 2 en attente » se coupait entre « en » et « attente ». Un compte suivi d’une courte locution qui le qualifie reste sur une ligne.
- **10 nov. 2026. Créer une organisation dans l’app, les trois étapes** (sc-36766 pour sc-30412, `mobile:createOrganisation.whatTitle|whereTitle|readyTitle|fromDevice|allCountries|noneYet|discard*`). Chaque étape est une question courte sur l’organisation, sans accord avec la personne : « Quel est son nom ? », « Où se trouve-t-elle ? », « Tout est prêt pour la créer ? » (jamais « Prêt à… »). « De cet appareil » ne s’accorde avec rien, car le lecteur d’écran le lit aussi après « Fuseau horaire ». « Aucune pour l’instant » s’accorde avec la devise. La feuille dit « Abandonner la création ? » / « Abandonner », comme `orgGeneral` ; « Abandonner cette organisation » se lirait comme la quitter.
- **10 nov. 2026. La page d’un événement dans l’app** (sc-36555 pour sc-30413, `mobile:eventPage.datesLine*|datesLocked|venueLine|noHosts*|type|currency*|nameAndCover|eventName|cover*|defaultCover|yourPhoto|pauseLine|callOffLine|endLine`). Chaque ligne sous un titre est « Libellé · détail », avec le libellé du web : « Dates », « Lieu », « Hôtes », « Image de couverture », jamais « Couverture » seul. La couverture par défaut a pour titre « Image par défaut », pour ne pas répéter « Image de couverture » sur la ligne en dessous. `datesLocked` reprend `web:eventEdit.scheduleLocked` après « Dates · », et `noHostsLine` reprend `eventHosts.none` sans sa première phrase. `pauseLine`, `callOffLine` et `endLine` réunissent en une ligne les mots de `eventPause.body|nothingLost` et `eventEnd.callOffBody|endBody|final`. `datesLine` et `type` sont identiques à l’anglais (same-as-english). `_many` prend « de » : « {{count, number}} de jours ».
- **10 nov. 2026. Aujourd’hui sur le web de bureau** (sc-36532 pour sc-30413, `web:today.*`, `mobile:todayScreen.startsTodayAt`). Les clés de `web:today.*` reprennent mot pour mot `mobile:todayScreen.*`, y compris « J-2 » et « Tout voir » : un hôte lit le même Aujourd’hui partout ; si l’une change, l’autre aussi. L’événement qui commence plus tard dans la journée : « {{name}} commence aujourd’hui à {{time}}. » L’anneau des arrivées, pour le lecteur d’écran seulement, dit « Arrivées : {{arrived}} sur {{expected}} », un nom qui ne s’accorde pas avec le chiffre.
- **10 nov. 2026. Le sélecteur d’organisations de l’app** (sc-36382 pour sc-30412, `mobile:switcher.asks|canAsk|search|clearSearch|noMatch|matches_*`, `invitations.joining|declining`). La question est « Où travaillez-vous ? », courte pour le titre sur téléphone. « You can ask to join » est « Vous pouvez demander à rejoindre », sans complément, comme domain joining. La recherche suit la règle « Rechercher un … » au singulier : « Rechercher une organisation » ; sans résultat, « Aucune organisation ne correspond à « {{text}} ». », comme `timeZone.noneMatch`. Pendant l’envoi de la réponse, « Adhésion en cours… », comme `web:join.joining`, et « Refus en cours… », qui ne s’accorde avec rien.
- **10 nov. 2026. Rechercher et filtrer les événements** (sc-37100 pour sc-30302, `web:eventsSearch.*`, `mobile:eventsSearch.*`). Filter est le nom « Filtres », pas « Filtrer », car il nomme aussi le menu : « Retour à Filtres », « Filtres : Tous ». Host est « Hôtes » ; "Anyone" et "All" sont « Tous ». « Type » reste le mot français (`same-as-english.json`). La recherche suit la règle : « Rechercher un événement » ; sans résultat, « Aucun événement ne correspond », puis « Vous avez recherché « {{q}} » et filtré par {{filters}}. ». Les dates : « Du » et « Au », « Entre deux dates… ».
- **10 nov. 2026. Le sélecteur d’organisations du web** (sc-36903 pour sc-30412, `web:switcher.*`, `invitations.fromNobodyNoRole`). Le web reprend mot pour mot `mobile:switcher.*`, espaces insécables compris : un membre lit un seul sélecteur sur les deux. La ligne actuelle, pour le lecteur d’écran, finit par « Actuelle », qui s’accorde avec l’organisation, comme `switcher.current`. Une invitation sans expéditeur ni rôle reste « Invitation » (same-as-english).
- **10 nov. 2026. L’interrupteur du lien d’adhésion** (sc-36700, `web:requestLink.on|off`). Dans Général, l’interrupteur est sur la ligne « Lien d’adhésion » et active ou désactive le lien ; il s’accorde donc avec lui : « Activé » / « Désactivé ». Remplace « Activées » / « Désactivées », qui s’accordait avec « Demandes ».
- **9 nov. 2026. La page Organisation de l’app** (sc-36126 pour sc-30412, `mobile:orgGeneral.*`, `ownership.*`, `companyDomains.*`, `requestLink.lead`). La carte, son lien et la feuille disent « Informations » et « Modifier » : « Informations de l’organisation » est trop long pour le titre de la feuille, qui sert aussi d’étiquette de retour à ses sélecteurs. « Defaults for new events » est « Réglages des nouveaux événements », comme `orgGeneral.intro` le disait. `discardLine` est « Aucune modification ne sera apportée à {{organisation}}. », car « {{organisation}} reste inchangée » s’accorde avec un nom propre. Après un transfert, « {{name}} est désormais propriétaire », épicène, et « Vous avez désormais le rôle Administrateur ». « Invitations » reste tel quel (same-as-english). Un domaine aussi vérifié par sc-560 porte « Vérifié ». La feuille de transfert est « Céder la propriété » et son bouton « Céder », car « Transférer la propriété » était coupé sur un téléphone (QA, 10 nov.). Un seul verbe par feuille (QA, 12 nov.) : dans l’app, la liste est « Céder à » ; sur le web, qui garde « Transférer », `passwordWhy` dit « transférer ».
- **9 nov. 2026. Les règles de connexion dans l’app : votre situation, ce qui a changé** (`mobile:signInRules.stand.*`, `readIntro`, `settings.personLabel*`, sc-34925 pour sc-30412). L’app reprend mot pour mot `web:signInRules.*` ; une phrase qui change sur l’un change sur l’autre. Les domaines bloqués (`stand.area.*`) portent leur article et leur préposition, « des membres », « de la facturation », « de la sécurité », pour que `managersNotOn`, « Les modifications {{areas}} attendent qu’elle le soit. », s’accorde quelle que soit la liste. Le délai de la double authentification pour tous est « Pas encore activée. Date limite : {{day}} », sans point final, car `{{day}}` finit sur « nov. ». « Pas de limite » est « Votre session reste ouverte jusqu’à ce que vous vous déconnectiez. », jamais « Vous restez connecté », qui s’accorde au masculin. La carte de Paramètres, pour le lecteur d’écran, est « Votre compte. {{name}}, {{email}}, {{role}} dans {{organisation}} ». U+00A0 avant chaque deux-points de ces règles, web compris.
- **9 nov. 2026. Les notifications sur le web de bureau** (sc-35791 pour sc-30411, `web:notificationSettings.*`). Les clés partagées disent la même chose que `mobile:notificationSettings.*` ; là où l’app dit « appareil », le web dit « navigateur » : « Bloquées dans ce navigateur ». La fenêtre `allow.*` cite les libellés de Chrome en français entre guillemets, « Notifications », « Autoriser » ; Done est « Terminé ». `intro` dit « c’est à vous de le faire », jamais « vous seul », qui s’accorde au masculin.
- **9 nov. 2026. La page Paramètres de notification de l’app** (sc-34901 pour sc-30411,
  `mobile:notificationSettings.*`). L’en-tête a un verbe, « Vous recevez uniquement des
  notifications push » ; les lignes n’en ont pas : « Push et e-mail », « Push uniquement »,
  « Désactivé », comme `off`. Le titre de section est « Ce qui vous est notifié », sans accord
  avec la personne. Le décompte dit « en push » et « par e-mail » : « 3 sur 6 en push · 6 sur 6
  par e-mail ». L’appareil a des « réglages », comme dans `pushBlocked`. « Bloquées sur cet
  appareil » s’accorde avec les notifications push. La note de Compte et sécurité perd « Les
  e-mails ne peuvent pas être désactivés. », désormais `locked.email`, sous l’interrupteur.
- **9 nov. 2026. La page Sécurité sur le web de bureau** (sc-35456 pour sc-30411, `web:security.*`). Les clés partagées disent la même chose que `mobile:security.*`. `setupTitle` est « Activer la double authentification », même si l’anglais dit encore « Set up ». `sendAgain` est « Le renvoyer », comme `mobile:recovery.sendAgain`, et `setupKey`, lu seulement par le lecteur d’écran, « Clé de configuration », la « clé » de `twoFactorCard.cantScan`. `everywhereLine_many` garde « vos {{count}} d’autres appareils », comme le 25 oct. : après un million rond, le « de » est obligatoire.
- **9 nov. 2026. La page Sécurité de l’app** (sc-34792 pour sc-30411, `mobile:security.*`). Reprend les termes du web : « Associé · {{address}} », « Déconnecter les autres appareils », « Terminé » pour Done. Rien ne s’accorde avec la personne : `signOutLine` dit « cet appareil-ci reste connecté », jamais « vous restez connecté », et `signedUpWith` commence par « Inscription avec Google ou Apple ? », au lieu du « Inscrit » du web (`web:recovery.providerNote`, à aligner au prochain ticket web). `expires` est « Expire le {{day}} sans nouvelle utilisation ».
- **9 nov. 2026. La page du lien envoyé sur le web et la ligne de qui a tout perdu** (sc-33788 pour sc-29067, `web:recovery.nothingThere`, `sentAgain`, `lostBothIntro`). `nothingThere` reprend l’app, « Rien reçu ? », et le lien est « renvoyez-le ». `sentAgain` est « Nous l’avons renvoyé. », sans la deuxième phrase de l’app. `lostBothIntro` dit « ne peut confirmer votre identité qu’après une connexion avec votre mot de passe », jamais « une fois connecté », qui s’accorde au masculin ; « l’assistance Soirely », du guide.
- **8 nov. 2026. Votre compte dans l’app** (sc-34175 pour sc-30411, `mobile:account.*`,
  `contacts.promoting`, `removing`). La section est « À propos de vous ». La ligne de l’adresse
  principale s’accorde avec l’adresse, « Principale · pour vous connecter », celle du numéro avec
  le numéro, « Principal · sur votre profil » ; les autres disent « Pour vous joindre, pas pour
  vous connecter ». Ce qui attend un code est « {{shown}} reste à vérifier. », comme le
  glossaire, car {{shown}} est une adresse ou un numéro. La question en quittant est
  « Abandonner votre modification ? », avec « Continuer à modifier » / « Abandonner », comme
  `eventEdit` et `web:eventPeople` ; dessous, « Votre nom reste {{name}}. », « Rien ne sera
  ajouté. ». Les confirmations en cours sont « Changement en cours… », qui ne s’accorde avec
  rien (« Définition comme principale… » s’accorderait et ne tient pas), et « Retrait en cours… »,
  comme le web.
- **8 nov. 2026. La double authentification à la connexion dans l’app** (sc-33828 pour
  sc-29072, `mobile:twoFactor.signedIn`, `recoveryShape`, `lost`, `lostTwoFactor.waitingFor`,
  `stayOut`, `emailSoirely`). « Connexion réussie », groupe nominal, car « Connecté » s’accorde
  avec la personne. Le titre d’attente est une étiquette, « En attente : {{organisations}} » :
  « En attente de » obligerait à élider devant un nom à voyelle (« d’Ire Events »), ce que le
  code ne sait pas faire. `stayOut` dit « Vous ne pourrez pas vous connecter tant que personne
  n’aura répondu », jamais « Vous restez déconnecté », qui s’accorde au masculin. Le bouton est
  « Écrire à l’assistance Soirely ».
- **8 Nov 2026. L’écran du lien envoyé dans l’app, et son toast** (sc-33809 pour sc-29071,
  `mobile:recovery.*`). Le bouton est « Ouvrir la boîte mail », comme « Consultez votre boîte
  mail », et non « Ouvrir Mail » : sous Android, il ouvre l’application d’e-mail de la personne.
  `spam` reprend la phrase du web, « Vérifiez vos courriers indésirables, puis renvoyez-le. »,
  comme le bouton « Le renvoyer ». `sentAgain` est « Nous l’avons renvoyé. Utilisez le dernier
  e-mail. ». Le toast `changed` : « Mot de passe modifié. Vos autres appareils sont
  déconnectés. », l’appareil étant ce qu’on déconnecte, comme `devices.everywhere`.
- **8 nov. 2026. Une connexion à deux facteurs qui a expiré** (sc-29979,
  `signIn.codeTimedOutTitle`, web et app). « La connexion a expiré », puis `endedBody`
  « Reconnectez-vous pour continuer. ». « La connexion », la tentative en cours, et non
  « Votre session », que la personne n'a jamais ouverte. L'app joint les deux sur une ligne
  avec un point : le titre n'en prend pas.
- **8 nov. 2026. Une inscription qui a expiré** (sc-32449 pour sc-29923, `register.timedOut`,
  web et app). « Votre inscription a expiré, nous n’avons donc pas conservé le mot de passe.
  Ressaisissez-le pour recevoir un nouveau code. ». "Sign-up" est « inscription », comme
  `limitedTitle` ; « expirer », comme la connexion ; « Ressaisissez-le » plutôt que « Saisissez-le
  de nouveau », qui heurte « nouveau code », lui-même repris de `resend`.
- **8 nov. 2026. Invités A : la réponse, les deux décomptes et le 412** (sc-3773, #32403).
  "Not sure yet" est « À confirmer », sur la page de l’invité comme sur celle de l’hôte : rien
  ne s’accorde, quand « pas encore sûr » ou « indécis » imposeraient un genre. « À confirmer ·
  réponse attendue d’ici le {{date}} », « À confirmer · a répondu le {{date}} ». "Haven't
  replied" est « n’ont pas répondu » (« {{count}} personnes n’ont pas répondu ») ; "No reply"
  est « Sans réponse » ; on ne les échange jamais. "Companions" est « accompagnants ».
  « {{coming}} des {{invited}} invités viennent ». "Write to them" est « Leur écrire » ; "Open
  check-in", « Ouvrir l’accueil ». "Show all {{count}}" est « Afficher les {{count}} ». "Their
  conversation" est « Conversation ». Le 412 : « La sienne · La vôtre », « Prendre la sienne »
  et « Garder la mienne » ; « sienne » s’accorde avec la version, pas avec la personne.
  La clôture (#32762) : « Fin des réponses aujourd’hui. », « Fin des réponses demain, le
  {{date}}. », « Fin des réponses le {{date}}. », et, une fois passée, « Les réponses sont
  closes depuis le {{date}}. », car « Fin des réponses le … » ne distingue pas le passé du
  futur. Plus personne à attendre : « Tout le monde a répondu. ».

- **7 nov. 2026. L’écran Aujourd’hui de l’app** (`mobile:todayScreen.*`, sc-31788 pour
  sc-29090). "Live now" et "Live · …" sont « En cours », comme `eventsScreen.happeningNow`,
  jamais « Publié », qui est l’état. L’agenda met une étiquette et deux-points,
  « Début : {{name}} », « Fin : {{name}} », « Suite : {{name}} », pour que le nom de
  l’événement se passe d’article. Le matin et l’après-midi disent « Bonjour », le soir
  « Bonsoir » dès 18 h (`greetingAt`) ; « Bon après-midi » se dit en partant, pas en
  arrivant. "Welcome" est « Bienvenue », invariable. "Next up" est « Prochain événement »,
  car il nomme un événement ; le "Next" du bloc Maintenant est « Ensuite ». "Needs you" reprend
  `eventPage.needsYou`, « À traiter ». Run of show reste « déroulé ».

- **7 nov. 2026. « Le jour de l’événement », jamais « le soir »** (sc-29384). Un événement a lieu
  à toute heure : `verifyPhone.doneBody`, `steps.mobileIntro` et `completeProfile.mobileHelp`
  disent « le jour de l’événement », `rolesScreen.means.run_of_show` « pendant l’événement ». Le
  slogan du web reprend celui de l’app, « Préparez l’événement. Pilotez le jour J. » : « jour J »
  convient à un slogan, pas à une liste de réglages. `public.body` dit « menus et programme »,
  plus « déroulé de la soirée ». `eventForm.clocksSkip` garde « la nuit du passage à l’heure
  d’été », qui décrit le changement d’heure.

- **5 Nov 2026. An event's People refusals** (`messages:people.*`, sc-30009). Who can act is
  « une personne ayant le rôle Propriétaire ou Administrateur, ou la personne responsable de
  l’événement », so nothing agrees with a gender. The event role Lead in a sentence is « la
  personne responsable de l’événement ». The job label is « l’intitulé du poste ».
- **4 nov. 2026. Les lignes sous chaque refus d’invitation sur le web de bureau**
  (`web:join.refused.*.line`, `web:requestToJoin.deadLine`, sc-29487 pour sc-29066). Chaque
  ligne ne répète pas son titre : celle d’une organisation supprimée est « L’invitation à
  rejoindre {{organisation}} ne peut plus être acceptée ». Déjà acceptée dit « Vous faites déjà
  partie de {{organisation}} », comme `requestToJoin.member` ; rien n’accorde avec le lecteur
  (« la personne à l’origine de l’invitation », « Vous utilisez le compte {{signedInAs}} »).
- **4 nov. 2026. Les étapes d’un nouveau compte dans l’app** (`mobile:steps.*`, sc-29126 pour
  sc-29069). La barre dit « Étape {{step}} sur {{steps}} » ; Skip est « Passer », jamais
  « Ignorer » ; Check WhatsApp est « Consultez WhatsApp », comme « Consultez votre boîte mail ».
  "On the day" est « le jour de l’événement » (sc-29384) ; jamais « le soir », « le soir même »
  ni « la soirée ».
- **1 nov. 2026. Les événements et la navigation propre à un événement** (sc-26732 pour
  sc-22103, `web:events.*`, `mobile:eventsScreen.*`, `eventNav.*`, web et app). Les espaces :
  « Aperçu », « Invités », « Menu », « Plan de table », « Messages », « Programme », « Équipe »,
  « Budget » et « Rapports » ; « Menu », « Messages », « Budget » et « Dates » sont les mots
  français et restent identiques à l’anglais. Un espace à venir : « … de cet événement arrive
  bientôt. », comme `eventPage.guestsComing` ; l’équipe est « La gestion de l’équipe… », car
  « L’équipe arrive » se lit comme des gens en route. Une donnée encore absente est « Bientôt
  disponible ». Le résumé, sans verbe : « 2 en cours · 3 à venir · 1 brouillon ». Les jours,
  « Du {{first}} au {{last}} », comme `calendar.range` ; le pied s’accorde : « 1 événement · Trié
  par date », « 3 événements · Triés par date ». Le Plus du téléphone se ferme par « Fermer
  « Plus » ».

- **1 Nov 2026. Quand un événement se termine, et les titres des cartes de l’aperçu**
  (sc-26608 pour sc-25008). « Se termine {{time}} », suivi de la phrase entière d’`Intl` :
  « Se termine dans 3 heures », « Se termine demain », « Se termine cette minute-ci ». Le verbe
  vient d’abord, sans sujet, comme une ligne d’état. Les cartes : « Dans les temps »,
  « Réponses », « À traiter » (plutôt que « Vous attend », plus long et trop familier pour un
  titre) et « Équipe de l’événement ».

- **01 Nov 2026. Ce que dit un bouton pendant l’envoi, sur un événement** (sc-22578 pour
  sc-22103, `eventLive.making`, `eventPause.pausing`, `.resuming`, `eventEnd.callingOff`,
  `.ending`, `eventDelete.deleting`, `eventEnd.callOffFailed`, web et app). Le nom de l’action
  suivi de points de suspension, comme « Enregistrement… » : « Publication… »,
  « Mise en pause… », « Reprise… », « Annulation… », « Suppression… ». Terminer est
  « Fin en cours… », car « Fin… » seul se lit comme un générique. Annuler a son propre refus,
  « Non annulé. Réessayez dans un instant. », jamais celui de « Terminer ».
- **30 Oct 2026. Une nouvelle version, l’onglet ouvert** (sc-22881 pour sc-22622, `release.*`,
  web). « Une nouvelle version de Soirely est en ligne. » ; le bouton, « Recharger », le verbe du
  navigateur. « Soirely a été mis à jour » obligerait à choisir un genre pour la marque.
- **30 Oct 2026. Une version trop ancienne** (sc-22881 pour sc-22620, `updateRequired.*`, app).
  « Mettez à jour Soirely pour continuer » ; le corps, « Cette version de Soirely ne fonctionne
  plus. La mise à jour conserve tout ce que vous avez enregistré. » ; le bouton, « Mettre à
  jour ». Jamais « obsolète » ni « non prise en charge », qui accusent la personne.
- **30 Oct 2026. La fin décalée avec le début** (sc-22161 pour sc-22144, `eventForm.endMoved`,
  web et app). Seulement lu par le lecteur d’écran : « La fin a été décalée avec le début :
  {{day}}, {{time}}. » « Fin » et « Début » comme les légendes du formulaire ; « décalée »
  plutôt que « déplacée », car la durée est gardée. Le jour et l’heure suivent les deux-points,
  sans « le » ni « à », et `formatDay` en « juil. » ne clôt donc pas la phrase.
- **29 Oct 2026. L’avis qu’un événement a changé** (sc-21005 pour sc-13214,
  `messages+intl-icu:eventChanges.*` : la cloche, le push et l’e-mail). Le titre est l’acte au
  passé composé avec le nom complet, « {name} a mis l’événement en pause », auxiliaire avoir,
  donc rien ne s’accorde avec le nom ; "changed" est « a modifié ». Chaque ligne ouvre sur la
  nouveauté, « Nouvelle date : {new} (avant : {old}). » : « avant : » plutôt qu’« au lieu de »,
  qui ne s’élide pas devant un fuseau (« au lieu de heure… »). Un lieu ajouté est « Lieu
  confirmé », un lieu retiré « Lieu à confirmer ». L’objet est l’état accordé avec « événement » :
  « En pause : {event} », « Repris : {event} ». Une fin un autre jour est « {weekday} à {time} ».
  Les autres : « Également modifié par {name}. », « d’autres personnes » au `many`. Le pied
  dit « vous faites partie de l’événement {event} » et cite « Modifications d’événements ».
- **29 Oct 2026. Les notifications : la cloche, la mise en sourdine et les paramètres**
  (sc-14815 pour sc-3980, `notifications.*`, `eventMute.*`, `notificationSettings.*` web et
  app, `messages:notifications.*`). Le canal est « Push » en colonne et « notifications push »
  dans une phrase. Mute est « Mettre cet événement en sourdine », et la marque d’une
  notification « En sourdine », invariable, à côté de « Non lue ». Les catégories sont des noms
  propres : « Réponses des invités », « Messages », « Jour de l’événement » (pas « Jour J »,
  trop familier dans une liste de réglages), « Modifications d’événements », « Facturation »
  (Money : paiements, utilisation et factures) et « Compte et sécurité » ; citées dans une
  phrase, entre guillemets. Les échecs suivent la maison (« … n’ont pas pu être chargées. »,
  « Non enregistré. ») et disent déjà le sens fixé par l’anglais du 29 oct.
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
  « Heures dans le fuseau {{timeZone}} », comme le formulaire. L’app
  (`mobile:eventDuplicate.*`, sc-22570 pour sc-22145) dit la même chose, clé par clé ;
  « Type » y est français, comme sur le web.
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
  it stands. Every count family gets its `_many`,
  the proof window's lines (`waysCard.proveLink_*`, `proveUnlink_*`, `codeKeepsSignIn_*`)
  included since sc-3980: « pendant {{count, number}} de minutes » (sc-20444).
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
  18 Nov (qa2, sc-68011): every email footer naming the organisation reads « … de
  l’organisation {organisation} », as `organisationDeleted.footer`; `planDowngraded`,
  `twoFactorRecovery.approver`, `signInRules.changed` and `ownershipTransferred` follow it.

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
  is « Toutes les dates » (sc-19010, after the English became All dates; « calendrier » alone is the organisation's Calendar), its panel « Prochaines dates » ; « Chargement des dates… », « Les dates n’ont pas pu être chargées. » Distances follow the date :
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
- **29 oct. 2026. Une adresse e-mail mal saisie est refusée en une seule phrase**
  (`forms.emailShape`, `orgGeneral.contactInvalid`, `membersScreen.emailShape`, web et app, et
  `validation.email_invalid`, `validation.contact_address_invalid`,
  `validation.invite_email_invalid`, sc-20577) : « Cela ne ressemble pas à une adresse e-mail.
  Vérifiez qu’elle contient un @ et un domaine. » L’anglais est le même partout, le français
  aussi ; « Cette adresse e-mail ne semble pas valide », sur le champ d’invitation, était l’exception.
- **31 Oct 2026. Le toast et son « Enregistré »** (`toast.undo`, `toast.close`,
  `saveLabel.saved`, web et app, sc-24571 pour sc-22092). L’action du toast est « Annuler »,
  comme partout pour défaire ce qui vient d’être fait ; à côté d’un message qui vient de dire
  ce qui a été fait, elle ne se lit pas comme « renoncer ». Le bouton de fermeture s’annonce
  « Fermer ». Le bouton d’enregistrement passe à « ✓ Enregistré » : sur le bouton, le participe
  seul suffit et tient sur téléphone ; la région live garde « Modifications enregistrées ».
- **1 nov. 2026. Le Calendrier de l’organisation** (`calendar.*`, `nav.calendar`,
  `frame.calendar`, web et app, sc-25787 pour sc-3625). « Calendrier » seul est celui de
  l’organisation ; les dates d’un événement restent « Toutes les dates ». Les vues sont « Mois »
  et « Planning » (pas « Agenda », qui se lit comme un carnet, ni « Programme », qui est le
  Schedule), sous « Affichage ». Le filtre dit « Événements et jalons » | « Événements
  seulement », « jalon » comme `timeline.*`. Le nom lu d’un choix est « {{group}} : {{choice}} »,
  U+00A0 avant les deux-points. Un intervalle est « Du {{from}} au {{to}} ». La case pleine dit
  « +{{count}} », sans nom : « +3 autres » était coupé en « +3 aut… » sur iPhone SE (case
  d’environ 50 px) et passait sur deux lignes sur le web à 390 px (QA, 1 nov.). Sous les barres
  de la case, « +3 » se lit seul ; le lecteur d’écran lit le nom de la journée, qui donne le
  nombre d’éléments, et ne lit pas ce texte.
- **1 nov. 2026. S’abonner au Calendrier** (sc-25960 pour sc-3626, `calendarFeed.*`, web et app ;
  `messages:calendar_feed.*` ; `messages+intl-icu:limits.calendar_feed`). « S’abonner dans votre
  agenda », et « S’abonner » dans l’en-tête du téléphone : l’application de la personne est son
  « agenda », jamais « calendrier », qui est le Calendrier de l’organisation. Les applications
  portent leur nom français : « Google Agenda, Calendrier d’Apple ou Outlook » ; la touche du Mac
  est « Commande ». Le lien est « votre lien privé », et on le « réinitialise », comme le mot de
  passe. Les statuts de l’agenda abonné sont ceux de la liste des événements, au masculin avec
  « événement » : Brouillon, Publié, En pause, Terminé, Annulé, Supprimé, après « Statut : ».
  « Dietary notes » est « Les notes sur l’alimentation ».
- **13 nov. 2026. Ajouter à l’agenda sur la page de l’invité** (sc-45546 pour sc-3627,
  `web:guest.calendar*`). Le titre est « Ajouter à votre agenda » : l’application de la personne
  est son « agenda », comme pour l’abonnement. La ligne : « Votre agenda se met à jour de lui-même
  si la date, l’heure ou le lieu changent. », au pluriel, puisque plusieurs peuvent changer. Les
  boutons sont « Apple / Outlook », identique à l’anglais (`same-as-english.json`), et
  « Google Agenda », le nom français de l’application.
- **Le bandeau hors ligne** (sc-22586) : « Hors ligne · mis à jour à {{time}} », et « … le {{day}}
  à {{time}} » quand le chargement date d’un autre jour. « Mis à jour » dit de quand date ce qui
  s’affiche, plutôt que de calquer « as of ». Pendant la nouvelle tentative, « Actualisation… ».
- **Le cadre des pages hors session** (sc-29037) : « New to Soirely? » est « Pas encore de
  compte ? », avant « Créer un compte » ; « Nouveau sur Soirely ? » s’accorde avec un genre.
  « © {{year}} Soirely » reste identique à l’anglais. Le bouton de langue se lit « Langue : {{language}} ».
- **Annuler une demande pour revenir** (sc-29979) : « Annuler votre demande ? » ; la sortie est « Continuer d’attendre », jamais « Annuler », et la confirmation reprend « Annuler la demande ».
- **L’état d’un champ refusé, seulement pour le lecteur d’écran** (`mobile:forms.invalid`, sc-31909) : « Données non valides », après le nom du champ (« Adresse e-mail, Données non valides »). C’est ce que dit VoiceOver sur le web ; rien ne s’accorde avec le nom, masculin ou féminin.
- **Le plan de table** (sc-33304 pour sc-3998, `seating.*`, `messages:seating.*`) : l’espace est « Plan de table », et le dessin « le plan de la salle ». Une "section" est une **zone**, jamais « section », réservée aux parties des paramètres : « Ajouter une zone », « Aucune zone », « La conserver ». Le lieu ouvre la ligne des unités comme une étiquette, « Lieu : {{venue}}. », pour ne jamais écrire « à Le Grand Hôtel » ; « là où se trouve {{organisation}} » évite tout accord avec l’organisation. "Seated" se dit « ayant une place », sans accord : « invités ayant une place passent dans Sans place ». Les couleurs : Bleu, Violet, Prune, Bordeaux, Rose, Marron, Vert olive, Bleu canard. L’aide en pieds reprend les abréviations CLDR françaises que le champ lit : « 12 pi 4 po, 12,5 pi ou 148 po ».
- **9 nov. 2026. Personnalisation** (sc-34920 pour sc-30441, `web:personalisation.*`,
  `mobile:personalisation.*`, `mobile:settings.personalisation*`,
  `messages:validation.colour_scheme_unknown`). Le choix, ce sont « vos couleurs », et rien ne
  s’accorde avec le nom d’un jeu : « Votre choix, {{picked}}, n’a pas été enregistré. Vous gardez
  {{kept}}. ». "Current" est « Choix actuel », jamais « Actuel·le », que « Fruits rouges » ou
  « Tenue de soirée » ne pourraient porter. « Toutes les pages sont désormais à vos couleurs ». Seul le
  refus de l’API dit « jeux de couleurs ». Les huit noms : Violet, Cobalt, Jardin, Agrumes,
  Fruits rouges, Tenue de soirée (Black tie, la tenue exigée), Sorbet et Terre cuite ; Violet,
  Cobalt et Sorbet sont les mots français (`same-as-english.json`).
- **9 Nov 2026. Les titres des feuilles Ajouter et Vérifier dans l’app** (sc-35661,
  `mobile:contacts.addEmail`, `addPhone`, `verifyEmail.title`, `verifyPhone.title`). La même clé
  sert de lien à droite du titre de section et de titre de feuille : « Nouvelle adresse »,
  « Nouveau numéro », que la section situe. Les feuilles de vérification disent « Ouvrez vos
  e-mails » et « Ouvrez vos messages », comme le bouton « Ouvrir la boîte mail » ; « Consultez
  votre boîte mail » était tronqué sur un téléphone Android et reste celui de l’écran du lien.
- **10 nov. 2026. Le titre de la feuille Vérifier le numéro dans l’app** (sc-35661,
  `mobile:verifyPhone.title`). « Code envoyé » remplace « Ouvrez vos messages », tronqué en
  « Ouvrez vos messa… » sur un Android de 360 dp, où tiennent environ 16 caractères entre
  Annuler et Vérifier. Le même titre sert au SMS et à WhatsApp : « Ouvrez vos SMS » est donc
  rejeté. La phrase sous le titre dit où le code est parti.
- **10 nov. 2026. Le titre de la feuille d’activation de la double authentification dans l’app**
  (sc-34792, `mobile:security.setupTitle`). « Deux facteurs », sans verbe : le bouton à droite dit
  déjà « Activer », et l’en-tête se lit « Annuler · Deux facteurs · Activer ». Environ 16 caractères
  tiennent entre Annuler et Activer sur un Android de 360 dp : « Double authentification » (9 nov.)
  y était coupé en « Double authentific… », et avant lui « Activer la double authentification ».
  Rejetés « 2FA », un sigle, et « Double vérification », trop long. Seulement dans cet en-tête ; le
  texte courant garde « double authentification ». `web:security.setupTitle` reste complet.
- **11 nov. 2026. « Ajouter à mon application d’authentification »** (sc-40162,
  `mobile:twoFactorCard.addToApp`). Le bouton parle au nom du membre, « mon », comme « J’ai
  enregistré ces codes… » ; le reste de l’étape dit « votre application d’authentification ».
  « Ajouter », comme `phoneSetupTitle`. Le dessin a prévu cette longueur : deux lignes centrées sur
  le téléphone, une seule dans la feuille de l’iPad. Rejeté « Ajouter à l’app d’authentification »,
  « app » n’étant pas le mot de l’étape.
- **13 nov. 2026. La liste d’invités de l’hôte et Ajouter un invité** (sc-43267 pour sc-1468, `web:guestList.*`, `eventDelete.removesGuests_*`, les `validation.guest_*`, `guest.already_listed` et `errors:guest_already_listed` de l’API). Un accompagnant sans nom est « Accompagne {{host}} », puis « Accompagne {{host}} · {{nth}} » : le verbe ne s’accorde pas, quand « Invité de » imposerait un genre. Pour la même raison, un ajout refusé commence par « Ajout impossible. », jamais « Non ajouté », et l’ajout réussi dit « {{name}} est maintenant sur la liste. ». Les réponses : « Vient », « À confirmer », « Ne vient pas », « Sans réponse », « En attente ». Une limite est la même phrase à l’écran et dans l’API.
- **13 nov. 2026. Retirer un accompagnant sans nom** (sc-43267, `web:guestList.removeCompanionOf(+Nth)`, lu seulement par le lecteur d’écran). « Retirer la personne qui accompagne {{host}} » : jamais deux verbes à la suite, et « la personne » ne s’accorde pas, quand « l’accompagnant » imposerait un genre.
- **13 nov. 2026. L’invité répond sur sa page et la modifie** (sc-43807 pour sc-1439, `web:guest.*`, `web:guestList.replied`, `guest.replies_closed` et `validation.guest_answer_unknown` de l’API). Sur sa propre page, l’invité lit sa réponse à la première personne, « Je viens », « Je ne viens pas », « À confirmer », car « Vient », le mot de l’hôte, ne se dit pas à quelqu’un qu’on vouvoie ; dans une phrase, entre guillemets : « Vous avez répondu « Je viens » le {{date}}. ». Les boutons : « Oui, je serai là », « Hélas, je ne pourrai pas » (jamais « Désolé », qui s’accorde), « Je ne sais pas encore ». « Merci de nous tenir au courant » plutôt que « de nous avoir prévenus », qui accorde les hôtes. La marque de la ligne choisie est « Réponse actuelle », sans « Votre », pour tenir sur un téléphone. "Contact your host" est « contactez votre hôte ».
- **23 nov. 2026. Le crédit des suggestions d’adresse** (sc-86673 pour sc-80918, `web:eventForm.creditOsm`, `mobile:eventForm.creditOsm`). « les contributeurs d’OpenStreetMap », la formule d’attribution qu’OpenStreetMap publie en français, si bien que la ligne se lit « © Stadia Maps © les contributeurs d’OpenStreetMap ». `creditStadia` reste « Stadia Maps » (same-as-english.json). Rejeté « contributeurs OpenStreetMap », calque de l’anglais.
