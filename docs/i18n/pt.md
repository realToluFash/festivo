# Portuguese at Soirely

Kept by `/soirely-linguist pt`. Read it before writing a string in Portuguese, and add to it
whenever you decide something a second string will need.

## Variant and register

European Portuguese (pt-PT). Formal and impersonal, never Brazilian _você_ phrasing. PT-PT
vocabulary: _ficheiro_, _palavra-passe_, _secção_, _ecrã_, _telemóvel_.

The rules every locale shares are in `.claude/skills/locale-parity`.

## Glossary

One way to say each recurring thing, everywhere. Seeded from the catalogues as they stood on
17 October 2026; the linguist reviews each row and marks it settled in Notes.

| English                   | Portuguese                   | Notes                                                            |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Settings                  | Definições                   |                                                                  |
| Organisation              | Organização                  |                                                                  |
| Sign in                   | Iniciar sessão               |                                                                  |
| Sign out                  | Encerrar sessão              | Settled 17 Oct 2026. "A sessão foi encerrada", never "terminada" |
| Email                     | Endereço de e-mail           |                                                                  |
| Password                  | Palavra-passe                |                                                                  |
| Continue                  | Continuar                    |                                                                  |
| Cancel                    | Cancelar                     |                                                                  |
| Two-factor authentication | Autenticação de dois fatores | In a comma list of Security's contents, "dois fatores" alone     |
| Home (tab)                | Início                       | Settled 17 Oct 2026. Not "Página inicial": too long for the tab  |
| Recovery code             | Código de recuperação        |                                                                  |

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **17 Oct 2026. An API detail with a bare number takes it without agreement**
  (`messages:proof.required`): "nos últimos {minutes} minutos". The API catalogue has no
  plural, so the number is always 5 and the sentence is written for it.
- **17 Oct 2026. A provider in prose takes the article, in a button it does not**
  (`waysCard.proofExpired_*`): "continue novamente com o {{provider}}", beside the button
  "Continuar com {{provider}}". "Carry on" is "prosseguir", so it does not repeat "continuar".
- **17 Oct 2026. The app's switcher and roles copy the web's** (`switcher.*`, `roles.*`), so
  both clients say the same; `switcher.close` is "Fechar", as `recovery.dismiss`.
- **17 Oct 2026. "You're signed in" is "Tem sessão iniciada"** (`home.signedIn`,
  `home.signedInTo` with "em {{name}}"). A friendly statement in the formal register,
  impersonal like the rest; "Está ligado" reads as a connection, and agrees with a gender.
- **17 Oct 2026. Contact details are "as formas de contacto"** (`settings.chooseLine`).
  Rejected "como o contactar": the clitic "o" assumes a man.

- **17 Oct 2026. A former name is "ex-{{name}}"** (`timeZone.was`, `timeZone.countryWas`):
  "Índia · ex-Calcutta". Rejected "antes {{name}}" (not a phrase in Portuguese) and
  "antiga {{name}}" (it has to agree, and the name may be a city, a country code such as GB,
  or a zone such as US/Eastern). "ex-" agrees with all of them.
- **17 Oct 2026. Signing out other devices is "encerrar a sessão"**, as in the glossary
  (`passwordCard.*`, `emails:password.changed.devices`, `devices.*`). The password card
  said "terminar", which made one action read as two.
- **17 Oct 2026. "It" in the device dialog is "o dispositivo"** (`devices.signInAgain`):
  Portuguese drops the subject, and on its own the sentence reads as if the person had to
  sign in again.
