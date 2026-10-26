# Spanish at Soirely

Kept by `/soirely-linguist`. Read it before writing a string in Spanish, and add to it
whenever you decide something a second string will need.

## Variant and register

Spain Spanish (es-ES). Formal: _usted_, consistent across every surface. Spain vocabulary:
_ordenador_, _móvil_, _correo electrónico_.

The rules every locale shares are in `.claude/skills/locale-parity`.

## Glossary

One way to say each recurring thing, everywhere. Seeded from the catalogues as they stood on
17 October 2026; the linguist reviews each row and marks it settled in Notes.

| English                                                         | Spanish                                                                      | Notes                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Settings                                                        | Configuración                                                                |                                                      |
| Organisation                                                    | Organización                                                                 |                                                      |
| Sign in                                                         | Iniciar sesión                                                               |                                                      |
| Sign out                                                        | Cerrar sesión                                                                |                                                      |
| Email                                                           | Correo electrónico                                                           |                                                      |
| Password                                                        | Contraseña                                                                   |                                                      |
| Continue                                                        | Continuar                                                                    |                                                      |
| Cancel                                                          | Cancelar                                                                     |                                                      |
| Two-factor authentication                                       | Verificación en dos pasos                                                    |                                                      |
| Recovery code                                                   | Código de recuperación                                                       |                                                      |
| Home (tab)                                                      | Inicio                                                                       | Settled, sc-1420                                     |
| Account (Settings row)                                          | Cuenta                                                                       | Settled, sc-1420; the screen title stays «Su cuenta» |
| Security                                                        | Seguridad                                                                    | Settled, sc-1420                                     |
| Signed-in devices                                               | Dispositivos con sesión abierta                                              | Settled, sc-1420                                     |
| Switch organisation                                             | Cambiar de organización                                                      | Settled, sc-1420                                     |
| Your role                                                       | Su función                                                                   | Settled, web switcher                                |
| Owner / Administrator / Event manager / Coordinator / Read-only | Propietario / Administrador / Gestor de eventos / Coordinador / Solo lectura | Settled; app and web say the same                    |
| Currency                                                        | Moneda                                                                       | Settled, sc-1585                                     |
| Time zone                                                       | Zona horaria                                                                 | Settled, sc-1585                                     |
| Contact address                                                 | Dirección de contacto                                                        | Settled, sc-1585                                     |
| Role (Settings > Roles), built-in role                          | Rol, rol predefinido                                                         | Settled, sc-2150; the switcher's «Su función» is not |

## Never translated

- Soirely
- iPhone, iPad, Android
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **26 Oct 2026. El lugar del evento y la lista de eventos en la app** (`web:eventForm.venue*`,
  `web:eventPage.venue*`, `addVenue`, `openInMaps`, `messages:validation.event_venue_*`,
  `mobile:eventsScreen.*`, sc-3589 y sc-1593 via sc-13205). Venue es «Lugar» («Nombre del
  lugar», «Lugar por confirmar», «Añadir el lugar»), no «recinto» ni «local», que suenan a
  edificio o a bar. El límite de longitud dice lo mismo en pantalla y en la API, «Acorte el
  nombre del lugar a {count} caracteres como máximo.». La oferta de zona horaria pregunta
  «¿Quiere usar esa zona horaria?», con botones «Usar {{zone}}» / «Mantener {{zone}}». La app
  repite las palabras de la web: «Cargando eventos…», «Borrador», «Este evento no está
  disponible»; su botón de reintento es «Inténtelo de nuevo», como el resto de la app.

- **26 Oct 2026. El tipo de evento** (`web:eventForm.type*`, `web:eventTypes.*`,
  `messages:validation.event_type_required`, sc-3588 via sc-13205). «Tipo», «Elija el tipo de
  evento», y el rechazo, igual en pantalla y en la API, «Elija qué tipo de evento es.». Las
  etiquetas: «Pedida de mano» para engagement (lo que se celebra en España, no «Compromiso»);
  «Congreso» para conference (una «conferencia» es una charla); «Homenaje póstumo» para
  memorial; «Gala o evento benéfico»; «Evento de empresa». «Baby shower» se queda en inglés, como
  se dice en España (está en `same-as-english.json`).

- **25 Oct 2026. A count of a round million, `_many`** (every web and app count family,
  sc-8529, now that the key-parity guard allows it, PR #324). At 1 000 000 and every exact
  million, i18next picks `_many`. It is `_other` with «de» between the count and the noun it
  counts, «1 000 000 de personas», «las {{count}} de sesiones», as the waiting email already
  does. Where no noun follows the count («y {{count}} más», «en los {{count}}», «Puede añadir
  {{count}} más»), `_many` is `_other` as it stands. Every new count family gets its `_many`,
  except the proof window's lines (`waysCard.proveLink_*`, `proveUnlink_*`, `codeKeepsSignIn_*`):
  they count PROOF_MINUTES, a constant that is never a million, and the app's test holds them to
  `_one` and `_other`.
- **25 Oct 2026. Settings > Members on the web, the invitation link and the invitation email**
  (`web:membersScreen.*`, `web:join.*`, `invitations.*` web and app, `emails:invitation.*`,
  `messages:invitations.*`, sc-2922). The web twins of the app's Members keys are the app's
  words. An invitation is feminine and its states agree with it: «Pendiente», «Caducada»,
  «Retirada» (revoked and withdrawn alike), «Rechazada», «Aceptada», «Eliminada»; "Revoke" is
  «Retirar». "Works until" is «Válida hasta el {{date}}» (as a sentence, «Esta invitación es válida hasta el {{date}}»), never «funciona hasta», which reads as a machine working (QA, 26 Oct). Who sent it is «invitación enviada por {{inviter}}», and the reader as sender is «usted», «enviada por usted». An invited
  person is «con invitación» in the subtitle and the chip, so no count agrees with anyone. The
  history lines name what was acted on, as «Solicitud rechazada por {{by}}»: «Invitación
  enviada por», «Solicitud aprobada por», «Acceso suspendido / restablecido / retirado por»;
  the joins are past simple, «Aceptó la invitación», «Se unió con …», as «Creó». A role given
  is «con el rol {{role}}». "Declining tells … you said no" is «Si la rechaza, {{inviter}} sabrá
  que ha dicho que no». The invitee is «le» (cortesía), «quien le invitó».
- **25 Oct 2026. Deleting an organisation** (`errors:owner_required`,
  `messages:organisation.owner_required`, `delete_name_mismatch`, `emails:organisationDeleted.*`,
  sc-3215). The refusals name the role, «Solo alguien con el rol Propietario…», as
  `transfer_owner_required`. `delete_name_mismatch` is `ownership.deleteMismatch` word for
  word, and `restore` is the second sentence of `ownership.deleteWindow`. The subject opens on
  the verb, «Se ha eliminado {organisation}», so nothing agrees with the name. The footer says
  «era miembro», as the organisation is gone when it is read.
- **25 Oct 2026. The API's refusals** (`messages:*`, sc-10809). An HTTP request is «la
  petición», never «la solicitud», which is a request to join or a recovery request; an API
  path is «esta URL», since «dirección» is a postal or email address here. An id is «ese
  identificador». Field names an integrator sends (`idToken`, `code`, `recoveryCode`,
  `If-Match`, `context`, the assistant's roles) stay as written, in straight quotes where the
  English quotes them; "system prompt" stays English. Where a screen says the same sentence
  (`lostTwoFactor.*`, `signIn.timedOutBody_*`, `createOrganisation.limitedTitle`, the
  lock-outs' «Inténtelo de nuevo a las {time}»), the refusal says it too.
- **25 Oct 2026. The article before an API time** (sc-11332). The 01 hour is «la una», so the
  lock-outs (`messages+intl-icu:limits.*`) and `emails+intl-icu:time.dateAt` choose the article
  from `{hour}` (0–23): `{hour, plural, =1 {a la {time}} other {a las {time}}}`, «a la 01:05», «a las
  00:05», «a las 13:05». Any new string that puts an article before a clock time takes the same
  form, or «la hora {time}» where no `{hour}` reaches it.
- **25 Oct 2026. A time the clocks skip** (`eventForm.clocksSkip`, `clocksSkipNextDay`,
  sc-10675, reworded in sc-11163). «En {{zone}}, la hora {{time}} del {{day}} no existe: esa noche
  se adelantan los relojes. Se guardará como {{savedAs}}.»; the next-day line ends «Se guardará
  el {{savedDay}}, como {{savedAs}}.». The short date («sáb, 27 mar») sits inside the clause,
  never before the colon or at the full stop, where it read heavily (qa3, at 320 px). «La hora {{time}}», never «las {{time}}», which would need «la» at 01:30. «Se
  adelantan los relojes» says what the reader sees happen, half-hour gap included; rejected
  «cambio al horario de verano», which names the rule rather than the missing hour.
- **25 Oct 2026. Editing an event's details (sc-9704, `eventEdit.*`).** «Editar detalles» opens
  and heads the form, «Guardar cambios» saves it. A refused save starts «No se ha guardado.»; the
  colleague is «otra persona», as `errors:precondition_failed`. "Show the latest" is «Ver la
  última versión», a whole noun, as the dialog asks. «Cambios guardados» is announced after a
  save. The currency refusal is one sentence in `web` and `errors`, «… en este evento».
- **24 Oct 2026. Suspending a member by hand and restoring them** (`membersScreen.suspend*`,
  `restore*`, `seats*`, `emails:memberSuspended.*`, `memberRestored.*`, `messages:members.*`,
  sc-8735). Suspending is «suspender a {{name}}», restoring «restablecer el acceso». What is
  suspended or restored is «el acceso», so «Se ha suspendido el acceso de {{name}}» agrees with
  no one; the admins read «Esta persona» before any «su». A team seat is «plaza de equipo» of
  «el plan», as `errors:team_seats_in_use`. "An administrator of" in the email is «quien
  administre {organisation}», which also covers owners. The email facts read «Fecha de
  suspensión» and «Fecha de restablecimiento». The screen's `ownerNoSuspend` and
  `members.suspend_owner` open on the same sentence.
- **24 Oct 2026. The claim that lapsed** (`emails:ownerClaim.lapsed.*`, sc-9219). "Lapse" is
  «caducar», as the web. The subject puts the claimant as subject, «{claimant} no ha obtenido la
  propiedad de {organisation}. La solicitud ha caducado», never «la solicitud de {claimant}»
  with a bare address. Each reason ends «así que la propiedad no se ha transferido»; the date
  «Caducada el {deadline}», as «Retirada el».
- **24 Oct 2026. The rest of a role's holders** (`rolesScreen.moreHolders_*`, web and app,
  sc-9068). «y {{count}} más», after the five names it continues; nothing agrees with the
  people, so one form serves every count. `_many` as the 25 Oct entry says.
- **24 Oct 2026. A request refused for its shape** (`messages:validation.invalid_shape`,
  `validation.request_shape`, sc-8716). The field «no admite ese valor», which also reads right
  for a required field left out; «Revíselo y vuelva a intentarlo». The 422 `detail` speaks of «los
  datos enviados», never «la solicitud», which here is a request to join.
- **24 Oct 2026. Withdrawing your own claim** (`ownerClaim.withdraw*`, `youWithdrew*`,
  `emails:ownerClaim.withdrawn.*`, `messages:owner_claims.not_claimant`, sc-8556). The claimant
  «retira» su solicitud; anybody else «detiene» una. Button «Retirar mi solicitud», confirm
  «¿Retirar su solicitud?» with «Retirar» / «Mantener mi solicitud». "You included" is «también
  usted», as «usted incluido» assumes a man. The email puts the claim as «la solicitud», not «su
  solicitud», which reads as the reader's; the date «Retirada el {deadline}», as «Detenida el».
- **24 Oct 2026. Getting an owner back** (`ownerClaim.*`, web and app, `emails:ownerClaim.*`,
  `messages:owner_claims.*`, `errors:owner_claim_*`, sc-8216). "Become the owner" is «obtener la
  propiedad», never «convertirse en propietario», which assumes a man; the claim is «la
  solicitud» and the claimant «ha solicitado la propiedad», which holds before and after the
  record is found. Ownership «se transfiere»; a person with it «tiene el rol Propietario».
  The claimant's record is «el registro DNS de esta persona», as «su» reads as the reader's.
  "Soirely support" is «el servicio de asistencia de Soirely», as `ownership.deleteWindow`;
  restoring is «restablecer». Dates take «el {{when}}» and «hasta el {{when}}».
- **24 Oct 2026. The only owner left suspended** (`accessPaused.stillOnlyOwner`,
  `membersScreen.suspendedOnlyOwner`, `onlyOwnerNotRemovable`, `onlyOwnerRestoreNeedsAddress`,
  `history.suspendedAddressGone`, sc-7831). As `emails:domainSuspended.keptOnlyOwner`: «la única
  persona con el rol Propietario en {{organisation}}» and «no sale de la organización», never
  «no se le quita». The refusal is «no se puede quitar a esta persona de la organización».
  Restoring needs «la dirección principal de esta persona», since «su dirección» could read as
  the admin's. The history line is «Acceso suspendido: …», a state that agrees with no one.
- **23 Oct 2026. Ownership and leaving** (`ownership.*`, web and app,
  `messages:organisation.transfer_owner_required`, `emails:ownershipTransferred.*`, sc-7715).
  The act is «transferir la propiedad», and the organisation is «cedida»; the people are
  «alguien con el rol Propietario» and «el rol Administrador», never «el nuevo propietario»,
  which assumes a man: "the new owner" is «la persona elegida», the legend «Transferir a», the
  email subject «Cambio de propietario en {organisation}». Both people are named, «Usted y
  {{name}} recibirán…», never «los dos». "Stay" is «No salir», the refusal of the act, since a
  bare «Quedarse» reads oddly on a button. Deleting is «eliminar», as for a role; the counts
  come before nothing that agrees, «Con ella se eliminan {{events}}, …». `_many` as the
  25 Oct entry says. A slot appears once per key (the parity guard counts them), so `transferred`
  closes «… a las dos cuentas», not a second {{name}}.

- **21 Oct 2026. Approving or turning down a request to join** (`membersScreen.awaiting.*`,
  `membersScreen.history.turnedDown`, `requestExpired`, `emails:joinRequest.*`,
  `messages:members.request_answered`, sc-7217). "Approve" is «Aprobar», "turn down" is
  «Rechazar», and what is turned down is «la solicitud», never the person: «¿Rechazar la
  solicitud de {{name}}?», «Rechazar la solicitud de {{name}}», «Solicitud rechazada por {{by}}». A
  request nobody answered «se retira», as a member is «quitado». The card's title is the state,
  «Pendiente de aprobación». A role given on approval is «con el rol {{role}}», so nothing
  agrees with the person («Aprobar con el rol {{role}}»). The waiting email's count takes
  `many`, «1 000 000 de personas».

- **24 Oct 2026. Who did it, in a history line** (`membersScreen.byYou`, `membersScreen.someone`,
  sc-7217, from QA). Both fill `{{by}}` after «por»: the reader is «usted» («Solicitud rechazada por
  usted»), and a person who has since left is «alguien que ya no es miembro».

- **21 Oct 2026. A domain member paused** (`accessPaused.*`, `membersScreen.suspended*`,
  `restore*`, `emails:domainSuspended.*`, sc-6703). The person reads «En pausa», the admins
  «Acceso suspendido», as the English keeps them apart. Restoring is «restablecer». In the
  admins' lines the member is «esta persona», so «se quitará a esta persona», «quítela» and
  «dejará de formar parte» agree with no one; «su acceso» alone would read as the reader's.
  "Account settings" is «Configuración de la cuenta», button and sentence alike. The footer
  says «propietario o administrador», as `twoFactorRecovery.approver.footer`.
  24 Oct (qa2, #8038): the email subject opens on what happened, «Acceso en pausa: {name} en
  {organisation}», so a phone inbox shows it before the names. The admins' label is «Acceso
  suspendido: dominio de empresa», as the setting, for all three reasons. "… first" is
  «necesita primero», never an opening «Antes,». The member's history line
  (`history.suspendedAddressGone`, sc-8868) is the label's words, whatever the reason.
- **21 Oct 2026. Request link** (`requestLink.*`, `requestToJoin.*`,
  `messages:request_link.*`, `errors:request_link_dead`, `join_request_*`, sc-6460). The act
  is «solicitar unirse», as domain joining; the setting «Solicitudes para unirse», so its state
  agrees in the feminine plural, «Activadas» / «Desactivadas». The link is «el enlace de
  solicitud» and «el enlace» is masculine: «Conservarlo», «lo sustituya». What waits is «su
  solicitud … pendiente de respuesta». A cooling-off date is «a partir del {{date}}», as the
  day starts with its weekday. dev2's drafts of the three `errors:` codes used «tú»; they now
  say «usted».

- **21 Oct 2026. Creating an event** (`events.*`, `eventForm.*`, `eventPage.*`,
  `rolesScreen.createEvents*`, `messages:validation.event_*`, sc-6302). A draft is «Borrador»;
  the form's legends are «Inicio» and «Fin». An end before the start is «El evento termina
  antes de empezar», so nothing names «el fin» twice. The organisation's defaults are «Valores
  tomados de la configuración de {{name}}», so nothing agrees with zona and moneda. An owner
  is «alguien con el rol Propietario», as in Members. The permission's states are «Permitido»
  / «No permitido». A refused send closes «así que no se ha enviado nada», as en's wanted
  shape.

- **21 Oct 2026. Two-factor for everyone** (`signInRules.everyone*`, `due*`, `overdue*`,
  `twoFactorCard.keptByRule`, `emails:signInRules.twoFactorDue.*`, sc-5702). "Require" is
  «exigir», as the server's errors; "for everyone" is «para todos». The date is «a partir del
  {{deadline}}» and «hasta el {{deadline}}», as `limitedBody` and `endsBy`. "Set it up" is
  «activarla», never «configurarla», as "turn on" in en. The overdue screen's body says why,
  «… y el plazo para activarla ha terminado», since the title already says «para continuar».
  "Single-event access" is «su acceso a eventos concretos». The card and the server's refusal
  say the same sentence, «… así que no puede desactivarla».

- **26 Oct 2026. Two-factor for everyone, the artboard's lines** (sc-13182,
  `signInRules.everyoneOn`, `everyoneOff`, `everyoneWithoutBody_*`, `everyoneStillWithout_*`,
  `emails:signInRules.twoFactorDue.*`). A banner is «un aviso». A person who must act is
  «cada una» after the count's «personas», with the verb in the singular. Their deadline is
  «su fecha límite», and the email's facts label it «Fecha límite», since «Obligatoria a partir
  del:» cannot stand before a colon. "Turns it on once" is «Se activa una sola vez».

- **21 Oct 2026. Company domain joining** (`domainJoining.*`, `companyDomains.*`,
  `messages:domain_joining.*`, sc-4434). The act is «solicitar unirse», the button «Solicitar
  unirse», and the wait «Pendiente de aprobación», as the Members state. The approver is
  «alguien de la organización», never «de allí»; what waits is «su solicitud», so nothing
  needs «le» to agree. "… instead" buttons are «Prefiero …». The setting is «Unirse por
  dominio de empresa»; a working domain «Admite solicitudes», a stopped one «Sin efecto».
  A domain is masculine: «Conservarlo», «Se ha quitado {{domain}}». Dev's draft of
  `errors:join_offer_unavailable` used «tú»; it now says «usted», as everything else.

- **21 Oct 2026. Members in the app** (`mobile:membersScreen.*`, sc-4259). A member is
  «miembro»; the screen is «Miembros», and a role here is «rol», as «Miembros y roles» on the
  Roles screen. A person's state never agrees with them: «Con acceso», «Pendiente de
  aprobación», «Acceso suspendido», «Ha salido», «Acceso retirado», and in the row line «en
  suspenso desde el {{date}}», «salió el {{date}}». Groups on the chips take the plural,
  «Todos», «Suspendidos», «Antiguos». Removing a member is «quitar a {{name}}», while a role is
  «eliminado» on the Roles screen. "On their next request" is «en cuanto vuelva a usar Soirely», since «solicitud»
  reads as a request to join. An owner named in a sentence is «alguien con el rol
  Propietario», as «la función Propietario» in sc-3490 avoids «el propietario».
- **21 Oct 2026. Invitations waiting on Complete your profile** (`completeProfile.*`, web and
  app, sc-4188). Waiting is «pendiente». With several, "join that organisation" is «unirse a la
  organización que le invita», since «esa» after «una» reads as nobody's. A button named in a
  sentence goes in «», with the verb: "Pulse «Guardar y continuar» para entrar en ella". "Nothing
  is waiting" says what is gone, «No queda ninguna invitación pendiente». "Accept an invitation above" is «acepte una invitación
  pendiente», the word the intro uses, not «acepte arriba», which reads stiffly. `_many` as the
  25 Oct entry says.

- **21 Oct 2026. Starting your own organisation** (`noOrganisation.start*`, web, and the app
  once sc-5932 adds it, sc-6897). "Start" is «crear», since «iniciar una organización» is not
  Spanish: the heading is «Cree su propia organización», the button «Crear organización», as
  `createOrganisation.create`. The help and the derived-settings line are `createOrganisation`'s
  words, so both screens say the same.

- **21 Oct 2026. Creating another organisation** (`createOrganisation.*`, web and app, sc-3490).
  "You will be its owner" is «Usted tendrá la función Propietario», the role and not
  «su propietario», which assumes a man. The rate limit says what happened, «Por ahora no se
  pueden crear más organizaciones», not «Demasiadas organizaciones nuevas», which reads as a
  fragment. A path in Settings is «Configuración > General»; «cambiarlas» agrees with moneda,
  zona horaria and dirección, all feminine.

- **21 Oct 2026. The organisation's language (sc-3311, `orgGeneral.language*`, web and app).**
  The label is «Idioma», as the English "Language"; if English lengthens it to "Language for
  invitations", it becomes «Idioma de las invitaciones». "Invitation emails" are «los correos de invitación»,
  and the people are «quienes no tienen cuenta de Soirely». Language names are «Inglés,
  Español, Francés, Portugués» as options and lower case in a sentence («se envían en
  francés»). A refused save is «No se ha guardado nada.» and the server's
  `permission_required` words unchanged.
- **21 Oct 2026. The re-proof's step two after a provider sign-in** (`waysCard.signedInWith`,
  `codeKeepsSignIn_*`, sc-2908). The status box is «Sesión iniciada con {{provider}}», a state
  rather than «Ha iniciado sesión», with no full stop. Under the code field: «Si se equivoca de
  código, no tendrá que volver a {{provider}}. Su inicio de sesión con {{provider}} es válido
  durante {{count}} minutos.» A condition about the person, not «un código incorrecto no le
  hace volver», which is literal and needs «le». A window is «es válido durante», not «dura».
- **19 Oct 2026. Sign-in rules are «Normas de inicio de sesión»** (`signInRules.*`, web and
  app, and `emails:signInRules.*`, sc-3030). «Normas», not «reglas», because they are set by
  an organisation for its members. A member held back by one «podrá consultar, pero no cambiar
  nada», the same words on the banner, the owner's preview and the email. Where a list of
  names is the subject (`effectStranded`'s `{{names}}`, one name or several), the sentence is
  impersonal, «Afecta a {{names}}: … se puede consultar…», so no verb has to agree with a count
  the string does not have. "Turn on two-factor" is «Activar la verificación en dos pasos», as
  `twoFactorCard.turnOn`, and a sentence says «la active». "The shortest of your organisations"
  is «la más estricta», since the shortest limit is the strictest rule and «la más corta» reads
  as a short rule. People who can manage are «quienes puedan gestionar»; roles are «roles»,
  as on the Roles screen.

- **18 Oct 2026. The contact cap says the refusal's words.** Under each Account card:
  «Puede añadir una más» / «uno más», then «Una cuenta admite hasta {{most}} direcciones de
  correo electrónico, incluida la principal» / «… números de teléfono, incluido el
  principal»; when full, «Tiene {{most}}, el máximo que admite una cuenta. Quite una para
  añadir otra.» / «Quite uno para añadir otro.» «Admite» and «Quite una…» as the server's
  `contacts.limit_*` and the card's `limit*` already say it, so the line and the refusal
  read alike. The number before the noun is left to the card title, as the English does;
  the gender of «una», «incluida» and «otra» is why each card has its own key
  (`contacts.cap*`, sc-2149).

- **18 Oct 2026. An alternative address or number, verified from Account.** "Alternative"
  is «alternativa» / «alternativo», a plain Spanish adjective here, never «secundaria», which
  ranks it. The verified line agrees with the noun: «{{address}} está verificada», because
  the sentence goes on «una dirección alternativa… hasta que la haga principal», and
  «{{number}} está verificado». "It stays" is «Seguirá siendo», since it was alternative
  before it was verified. A section is its bare label after «a» and «en», as «volver a
  Seguridad» already says it: «Volver a Cuenta», «en Cuenta». "Remove it in Account" after
  the question is the infinitive, «Quitarla en Cuenta» / «Quitarlo en Cuenta», the shape of
  «¿Número equivocado? Cambiarlo» (`verifyEmail.doneBodyAlternative`,
  `verifyPhone.doneBodyAlternative`, `contacts.verifiedDone*`, `contacts.backToAccount`,
  `contacts.removeInAccount*`, sc-2594).

- **18 Oct 2026. Who decides, for someone who cannot.** A line shown to a viewer without the
  power names who has it with `lockedLine`'s words, «alguien que pueda cambiar {{area}}»,
  and never «Usted»: «Lo que incluye lo decide alguien que pueda cambiar {{area}}» is the
  twin of «Usted decide lo que incluye». A read-only twin keeps its editable line's first
  sentence word for word and drops what the viewer cannot do («Creado por {{name}}.»).
  Rejected «Quien pueda cambiar…», shorter but a second wording for the same power
  (`rolesScreen.describeSeededReadOnly`, `describeCustomReadOnly`, sc-2472).

- **18 Oct 2026. The Roles refusals speak the Roles screen's words.** «Rol», «predefinido»
  and «eliminar» for a role, because the screen already says «Eliminar rol» and
  «Predefinido»; a server refusal and the screen's own check say the same sentence
  (`roles.name_required` = `rolesScreen.nameBlank`, `roles.name_too_long` =
  `rolesScreen.nameTooLong`). A length limit is «Acorte el nombre a {count} caracteres como
  máximo», where the plural always reads right, since a limit is never 1. «General» and «Roles» are the Spanish words, so they are in
  `same-as-english.json` (sc-2150).

- **18 Oct 2026. A phone number is «número de teléfono»; the one we text is «de móvil».**
  The Account card and its lists, limits and refusals say «Números de teléfono», because an
  alternative may be a landline; the field we send an SMS code to keeps «Nuevo número de
  móvil», as the phone screens' «Número de móvil» does. The rule against «teléfono» is for a
  phone as a device (`devices.app*`), not for a number. "Make primary" is «Hacer
  principal», short enough for the row button; "Make another one primary first" puts
  «Antes» first and names the noun, «Antes, haga principal otra dirección» / «… otro
  número». A key shared by addresses and numbers takes no gender: «Quitar», «Conservar»,
  «Sin verificar», «Este dato ya está vinculado…». Since the number card has its own
  `verifiedPhone`, «Verificado», the address card's `verified` agrees with «dirección»:
  «Verificada». "Remove" is «Quitar», never «Eliminar», because the address still exists (sc-2149).

- **18 Oct 2026. The new-device email.** The subject is «Nuevo inicio de sesión en
  Soirely», a noun phrase that fits a phone inbox. The body puts the device first, «Un
  dispositivo que nunca había iniciado sesión en su cuenta de Soirely acaba de hacerlo.»,
  because «acaba de» says "just" without a time adverb. "Network address" is «Dirección de
  red», not «Dirección IP», as the English chose the plain word. Its facts reuse
  `twoFactorRecovery.fact.*` («Cuándo:», «Dispositivo:»). "Sign out … from Security" is
  «vaya a Seguridad y cierre la sesión en …», because «desde Seguridad» at the end reads as
  if the devices were not recognised from there. «Si no fue usted» as in the provider emails
  (sc-1283).

- **18 Oct 2026. The app as a device is «Aplicación de Soirely en …».** «Aplicación de
  Soirely en iPhone», «… en iPad», «… en un móvil Android», «… en una tableta Android»
  (`devices.app*`, `password.device.app*`). «Aplicación» rather than «app» for the formal
  register; the article before «móvil» and «tableta» because they name a kind of device,
  where iPhone and iPad are names. «Móvil», never «teléfono» or «celular» (sc-1283).

- **18 Oct 2026. "Sign out everywhere else" is «Cerrar las demás sesiones».** Shorter than
  «Cerrar sesión en los demás dispositivos», so it fits the phone button, and it is how
  Spanish interfaces already say it. The confirm buttons follow `devices.end`: «Cerrar su
  sesión» / «Cerrar sus sesiones», and «Cerrar las {{count}} sesiones» when this device is
  among them; "Keep it/them signed in" is «Mantener la sesión» / «Mantener las sesiones».
  "Nothing was signed out" is «No se ha cerrado ninguna sesión», the perfect because it has
  just happened; the result lines keep the preterite of `passwordCard.done_*`. A disabled
  "Try again at {{time}}" button is «Reintentar a las {{time}}», short where a sentence would
  say «Inténtelo de nuevo» (sc-1193).

- **17 Oct 2026. A picker's search field is «Buscar» and the plural noun.** «Buscar
  monedas», «Buscar zonas horarias», as the country picker's «Buscar países» already says
  (`orgGeneral.searchCurrency`, `orgGeneral.searchTimezone`). The Settings row line follows
  its siblings: lower case after the «·», «nombre, dirección de contacto, moneda, zona
  horaria»; the tablet pane's line names each section as «X reúne…», so Organisation is
  «Organización reúne la configuración de {{name}}», where «de» needs no agreement with the
  name (sc-1585). The email-address refusal was already formal without a contraction, so
  it stays as it is.

- **17 Oct 2026. A minute count in the API catalogue takes no agreement.** The API's
  catalogues have no ICU plural, so `{minutes}` sits where the plural reads right at 5:
  «en los últimos {minutes} minutos» (`messages:proof.required`). "Continue with {provider}
  again" is «Vuelva a iniciar sesión con {{provider}}», which names what happens rather than
  quoting the button (`waysCard.proofExpired_*`). The provider emails' "If this wasn't you"
  stays «Si no fue usted», as their `notYou` siblings say it (sc-1315).

- **17 Oct 2026. "You're signed in" is «Ha iniciado sesión».** On the app's Home
  (`home.signedIn`, `home.signedInTo`: «Ha iniciado sesión en {{name}}»). The English
  contraction is warmth; Spanish carries it in the plain perfect, still _usted_, and «en»
  needs no agreement with the organisation's name. "Open Settings" is «Abrir
  Configuración», with the capital because it names the tab (sc-1420).

- **17 Oct 2026. A device's state, not its timing.** Signed-out devices are described as
  done: «Se cerró la sesión en sus otros dispositivos.» with no delay or "hasta 15 minutos",
  matching the English (sc-117). When the subject is a device that must sign in again, use
  the impersonal «En ese dispositivo habrá que volver a iniciar sesión», never «tendrá que»,
  which reads as if _usted_ had to (`devices.signInAgain`).
- **17 Oct 2026. One sentence for "every other device has been signed out".** In an email
  it is «Se ha cerrado la sesión en todos los demás dispositivos.», the perfect tense for a
  report that has just happened, and identical in the password-changed and recovery emails
  (`password.changed.devices`, `recovery.changed.body`). On screen, where the person has
  just pressed Save, the preterite «Se cerró la sesión en sus otros dispositivos» stays
  (`passwordCard.done_*`).
- **17 Oct 2026. A replaced request.** The mark is «Sustituida», feminine like «Cancelada»
  and «Rechazada» because it agrees with «solicitud», and the verb matches `resendNote`
  («sustituyen»). "Start again" is «Empezar de nuevo» on the button and «Empiece de nuevo» in
  a sentence. A request started elsewhere is reported in the perfect, «Se ha iniciado…», on
  screen and in `errors:recovery_request_replaced` alike. The daily limit is worded as
  `limitedBody` words it: «una de las 3 veces al día que puede pedirlo» (sc-1457).
- **25 Oct 2026. Moving the people off a removed role** is worded so it reads for one person
  or many, because the button and the refusal get no {{count}}: «Reasignar y eliminar {{role}}»,
  and «Elija el rol de sustitución», the same noun as the legend «Rol de sustitución». Not
  «Pasarlas…» or «estas personas» after «1 persona tiene este rol» (sc-13017).
- **26 Oct 2026. The beyond-grant line names access** (`membersScreen.beyondGrant`, sc-13089). «… así que no puede cambiarle el rol ni el acceso»: the «le» points at the member, so neither noun takes «su», which would read as the reader's.
