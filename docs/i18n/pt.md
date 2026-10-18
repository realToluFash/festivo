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

| English                       | Portuguese                   | Notes                                                            |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Settings                      | Definições                   |                                                                  |
| Organisation                  | Organização                  |                                                                  |
| Sign in                       | Iniciar sessão               |                                                                  |
| Sign out                      | Encerrar sessão              | Settled 17 Oct 2026. "A sessão foi encerrada", never "terminada" |
| Email                         | Endereço de e-mail           |                                                                  |
| Password                      | Palavra-passe                |                                                                  |
| Continue                      | Continuar                    |                                                                  |
| Cancel                        | Cancelar                     |                                                                  |
| Two-factor authentication     | Autenticação de dois fatores | In a comma list of Security's contents, "dois fatores" alone     |
| Home (tab)                    | Início                       | Settled 17 Oct 2026. Not "Página inicial": too long for the tab  |
| Recovery code                 | Código de recuperação        |                                                                  |
| Phone (device)                | Telemóvel                    | Settled 18 Oct 2026. Never "celular"                             |
| Account (Settings section)    | Conta                        | Settled 18 Oct 2026. A bare label: "em Conta", "Voltar a Conta"  |
| Alternative (address, number) | alternativo                  | Settled 18 Oct 2026. Not primary; never "secundário"             |

## Never translated

- Soirely, feminine in a sentence ("a Soirely", "na Soirely"); see Decided phrasings
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **18 Oct 2026. Verifying an alternative from Account (sc-2594)** (`verifyEmail.doneBodyAlternative`,
  `verifyPhone.doneBodyAlternative`, `contacts.verifiedDone*`, `contacts.backToAccount`,
  `contacts.removeInAccount*`, web and app): "{{address}} está verificado. Continua a ser um
  endereço alternativo até o tornar principal em Conta." and the done line "{{address}} está
  verificado.". Endereço and número are both masculine, so the two keys read alike in
  Portuguese and agree as "foi removido" does. "Conta" is the section, a bare label like
  "Segurança": "em Conta", "Voltar a Conta" (as "voltar a Segurança"), never the page title
  "A sua conta". "Remove it in Account" is "Removê-lo em Conta", the infinitive of the link
  "Alterá-lo" after "Número errado?". Rejected "Remova-o em Conta": it breaks the link's
  shape on the same screen. "Alternativo" over "secundário", which ranks it.
- **18 Oct 2026. The power to change an area is "quem pode alterar {{area}}"**
  (`rolesScreen.lockedLine`, `describeSeededReadOnly`): "Quem pode alterar Membros e funções
  decide o que inclui." Impersonal, so it agrees with nobody; rejected "alguém que possa
  alterar", which is longer and says the same power in a second way. A read-only twin keeps
  its editable line's first sentence and agrees with "a função": "É predefinida…",
  "Criada por {{name}}." A name that carries its own full stop gets a second one until the
  renderer drops it (`docs/i18n/en.md`, sc-2251); no line is reworded around it.
- **18 Oct 2026. A browser session is "Safari no iPhone"** (`devices.agent`, web and app, and
  `emails:password.device.agent`): "{{browser}} no {{platform}}", beside "Aplicação Soirely no
  iPhone" in the same list and the same email line. Every platform the parser names (iPhone,
  iPad, Android, macOS, Windows, ChromeOS, Linux) is masculine, so "no" agrees with all of
  them; a feminine one added later needs a `[dev]` context. Rejected "em iPhone": a bare noun
  after "em" is the Brazilian habit, and it sat oddly beside "no iPhone".
- **18 Oct 2026. "Devices you do not recognise" is "os dispositivos que não reconheça"**
  (`emails:newDevice.notYou*`, `provider.linked.notYouNoPassword`,
  `provider.unlinked.notYouNoPassword`, and "qualquer um que não reconheça" in `devices.intro`).
  The subjunctive, since the email cannot know which devices those are; "que não reconhece"
  reads as a set both sides already know.
- **18 Oct 2026. The brand is feminine everywhere, "a Soirely"**, on screens, in emails and in
  `errors:` and `messages:`: "A Soirely não pode verificar", "Continuar para a Soirely",
  "iniciar sessão na Soirely", "o e-mail mais recente da Soirely", "Adicione a Soirely à sua
  aplicação de autenticação". It reads as "a plataforma" and "a empresa" at once, and the
  password and new-device emails already said it. Rejected scoping it, "a Soirely" for the
  company and "o Soirely" for the app: nobody can see which one a sentence means, and the brand
  changed gender between the new-device email and Devices. Before a noun it stays a bare label
  with no article: "conta Soirely", "código Soirely", "Aplicação Soirely". A number is
  contacted as "contactar o {{number}}" (`verifyPhone.doneBody`), not "contactá-lo", whose
  clitic assumes a man; "on the night" is "na noite do evento".
- **18 Oct 2026. Other addresses and numbers "servem para contacto"** (`contacts.*`, web and
  app, and `messages:contacts.*`). The primary "serve para iniciar sessão e recebe o e-mail da
  conta"; the others "servem para contacto, mas não permitem iniciar sessão". Rejected "podem
  contactá-lo", whose clitic assumes a man. The card says "Números de telefone", since another
  number may be a landline; the field we text says "Número de telemóvel". "Stays unverified" is
  "fica por verificar", and the badge "Não verificado". "Make primary" is "Tornar principal",
  and a refusal puts "primeiro" before the noun: "Torne primeiro outro endereço principal".
  "Prove it is yours" agrees with the address, not the person: "confirmar que o endereço é seu".

- **18 Oct 2026. A role named in a sentence is "a função Proprietário"** (`messages:roles.*`).
  The role's name stays a label after "a função", so nothing agrees with it: "A função
  Proprietário é predefinida", "a única pessoa com a função Proprietário", never "o único
  proprietário", which assumes a man. A role "holds" permissions as "inclui", as on the Roles
  screen. "Leave it unassigned" is "não a atribua a ninguém". A refusal over a length limit says
  what to do: "Encurte o nome para um máximo de {count} caracteres." The API catalogue has no
  plural, and the limit is always well above 1. The Roles screen's own check
  (`web:rolesScreen.nameTooLong`) says the same sentence with `{{most}}`, so a person who meets
  the server's check from a stale page reads what the screen would have said.

- **18 Oct 2026. An email's footer is "Está a receber esta mensagem porque…"** (`emails:newDevice.why`,
  as `provider.why`). "Recebeu este e-mail" reads as a past event; the footer explains why it
  arrives at all. The brand is feminine, as decided above: "Novo início de sessão na Soirely"
  (`newDevice.subject`). Sending someone to a
  section is "vá a Segurança e…" (`newDevice.notYouNoPassword`), as "voltar a Segurança", so
  the action comes after the place rather than trailing at the end.

- **18 Oct 2026. An app session is "Aplicação Soirely no iPhone"** (`devices.app*`, web and
  app, and `emails:password.device.app*`): "no iPhone", "no iPad", "num telemóvel Android",
  "num tablet Android". "Aplicação", never "app"; "telemóvel", never "celular"; "tablet" is
  masculine in PT-PT. Soirely, iPhone, iPad and Android stay as they are. Every string that
  takes a device name (`devices.ended`, `devices.checkTitle`, `password.changed.where`) is
  worded so it needs no agreement with it.
- **17 Oct 2026. "Sign out everywhere else" is "Encerrar as outras sessões"** (`devices.everywhere*`,
  web and app). Shorter than "Encerrar a sessão nos outros dispositivos", so it fits the phone
  button, and it keeps "encerrar". The confirm and keep buttons follow the card's `devices.end`
  and `devices.keep` ("Encerrar a sessão", "Manter a sessão"; plural "as sessões"), the Done
  lines echo `passwordCard.done_*`, and "it" in the warning is "o dispositivo", as
  `devices.signInAgain`. Confirming identity is "confirme que é você", as `waysCard.proveLink`;
  rejected "que é o próprio", which agrees with a man.
- **17 Oct 2026. The email-address refusal is one sentence everywhere** (`orgGeneral.contactInvalid`
  and `forms.emailShape`, web and app): "Isso não parece um endereço de e-mail. Confirme que tem
  um @ e um domínio." The English of all four keys is the same, so the Portuguese is too;
  "Verifique se tem" was the odd one out.
- **17 Oct 2026. A settings section's line names its contents with "Em … estão"**
  (`settings.chooseLine`, `settings.chooseLineWithOrganisation`): "Em Organização estão as
  definições de {{name}}." A search field's placeholder is "Pesquisar" plus the plural noun
  (`orgGeneral.searchCurrency`, `searchTimezone`).
- **17 Oct 2026. A status mark agrees with "o pedido"** (`lostTwoFactor.*Mark`): "Substituído",
  as "Cancelado", "Confirmado", "Recusado". The daily limit is "um dos 3 pedidos que pode fazer
  por dia" (`replacedNote`), echoing `limitedBody`, "Pode pedir 3 vezes por dia".
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
  said "terminar", which made one action read as two. Since sc-1677 every sign-out on
  screens, in emails and in `errors:` says "encerrar": "encerra a sessão", "a sessão foi
  encerrada nos dispositivos…", "todas as sessões foram encerradas", "a sessão continua
  encerrada". "Terminar" stays only for a request that ends or expires ("o pedido terminou")
  and for the Finish button.
- **17 Oct 2026. "It" in the device dialog is "o dispositivo"** (`devices.signInAgain`):
  Portuguese drops the subject, and on its own the sentence reads as if the person had to
  sign in again.
- **18 Oct 2026. A moment in a sentence is "a {when}"** (`emails:password.changed.body`,
  `password.added.body`, `recovery.changed.body`, `twoFactor.off.body`): "foi alterada a
  18 de outubro de 2026 às 14:30". European Portuguese dates a day with "a"; "em {when}" is
  the Brazilian habit, and two password emails disagreed. A label keeps the colon
  ("Quando: {when}"), and a range keeps "até" / "a partir de".
