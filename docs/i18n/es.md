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
  come before nothing that agrees, «Con ella se eliminan {{events}}, …». No `_many`, as
  sc-4188 says. A slot appears once per key (the parity guard counts them), so `transferred`
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

- **21 Oct 2026. A domain member paused** (`accessPaused.*`, `membersScreen.suspended*`,
  `restore*`, `emails:domainSuspended.*`, sc-6703). The person reads «En pausa», the admins
  «Acceso suspendido», as the English keeps them apart. Restoring is «restablecer». In the
  admins' lines the member is «esta persona», so «se quitará a esta persona», «quítela» and
  «dejará de formar parte» agree with no one; «su acceso» alone would read as the reader's.
  "Account settings" is «Configuración de la cuenta», button and sentence alike. The footer
  says «propietario o administrador», as `twoFactorRecovery.approver.footer`.
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
  pendiente», the word the intro uses, not «acepte arriba», which reads stiffly. No `_many` yet: the
  key-parity guard refuses a form English lacks (sc-4188, [dev2]), so 1 000 000 falls back to English.

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
