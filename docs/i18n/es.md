# Spanish at Soirely

Kept by `/soirely-linguist es`. Read it before writing a string in Spanish, and add to it
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

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

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
