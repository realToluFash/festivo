# Portuguese at Soirely

Kept by `/soirely-linguist`. Read it before writing a string in Portuguese, and add to it
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

- **28 Oct 2026. O evento que começou noutro dia** (sc-17870 para sc-17853, `events.startedOn`
  web e `eventsScreen.startedOn` app). "Início: {{date}} · {{time}} {{timeZone}}". `{{date}}` abre
  com o dia da semana ("terça-feira, 27/10"), que não aceita "a" e com que "na"/"no" não pode
  concordar, por isso é um rótulo, pela regra do dia da semana (19 Oct), e não "Começou {{date}}".
- **27 Oct 2026. Duplicar um evento** (sc-15883 para sc-3593, `web:eventDuplicate.*`). "Duplicar"
  e "Criar rascunho"; o evento novo é "a cópia" até existir. O painel diz "O que é copiado" / "O
  que não é copiado", porque um particípio sozinho teria de concordar com cada linha. Length é
  "Duração". Uma recusa começa "Não foi criado.", como "Não foi publicado.". As horas e os
  minutos juntam-se com "e" em `hoursAndMinutes` ("2 horas e 20 minutos"); a data leva "no dia
  {{end}}", como `calledOffNotice`, e "Horas no fuso horário {{timeZone}}", como o formulário.
- **27 Oct 2026. Os anfitriões de um evento** (sc-15427 para sc-6713, `web:eventHosts.*`,
  `eventLive.needsHost*|addHosts` web e app, `messages:validation.event_host*`,
  `messages:event.host_required|last_host`). Host é "anfitrião", como `errors:event_host_required`;
  a secção é "Anfitriões" e cada linha "Anfitrião {{position}}". "Add who is hosting" é "Indicar
  os anfitriões". Um anfitrião é um nome tal como os convidados o leem, por vezes um casal numa
  linha, por isso nada concorda com {{name}}: "{{name}} já consta da lista de anfitriões", "… já
  não consta da lista de anfitriões", "{{name}}: posição {{position}} de {{count}}". Remover é
  "Remover", como em Conta. O limite é a mesma frase no ecrã e na API. O último anfitrião
  explica-se do lado dos convidados: "Os convidados podem ver este evento, por isso …".
- **26 Oct 2026. Eliminar um evento** (sc-14417 para sc-3592, `eventDelete.*` web e app,
  `messages:event.delete_name_mismatch`). Como para uma organização: "Eliminar o evento", com
  o artigo, como "Cancelar o evento"; o diálogo "Eliminar {{event}}?" e a saída "Manter o
  evento", como em `eventEnd`. `mismatch` e a API são a mesma frase. "Support" é "o apoio ao
  cliente da Soirely" e restaurar é "restaurá-lo", como `ownership.deleteWindow`; a data é "até
  {{deadline}}". O aviso é "O evento {{event}} foi eliminado", com o particípio a concordar com
  "evento", nunca com o nome. A equipa é "toda a equipa". O apóstrofo é "reto" ou "curvo".
  `failed` repete `ownership.failed`.
- **26 Oct 2026. O formulário de evento na app** (sc-14367 para sc-3595,
  `eventsScreen.newEvent|noneCreate`, `eventForm.searchType|timesIn|pickerDone|created|leaveBody`,
  `eventForm.venueSuggestionsBelow_*`). O botão que confirma um seletor de data ou hora é "OK",
  como no iOS, nunca "Concluído" nem "Terminado", que é o estado de um evento. O título da folha
  é "Horas no fuso horário {{zone}}", como em `clocksSkip`. A pesquisa segue a regra "Pesquisar"
  mais o nome no plural: "Pesquisar tipos de evento".
- **26 Oct 2026. A decorrer, terminar ou cancelar um evento** (sc-14189 para sc-3585,
  `events.happeningNow`, `eventsScreen.happeningNow`, `eventEnd.*` web e app,
  `eventEdit.schedule*`, `messages:event.already_over|schedule_concluded`). "A decorrer" na
  pílula, a forma pt-PT, nunca "Acontecendo agora". "End now" é "Terminar agora", como o estado
  "Terminado"; "Call off" é "Cancelar o evento", com o nome, porque um "Cancelar" sozinho lê-se
  como o botão que fecha o diálogo. A saída é "Manter o evento" nos dois diálogos. Uma recusa
  começa "Não foi terminado.". Os convidados são "os convidados que abrirem a sua ligação". A
  data do aviso leva "no dia {{date}}", pela regra do dia da semana. `scheduleLocked` e
  `scheduleConcluded` são a mesma frase: o português não tem a contração que as distingue.
- **27 Oct 2026. Pausar e retomar um evento** (sc-15439 para sc-3586, `eventPause.*` web e
  app). "Pausar", como a permissão; "Retomar"; a saída é "Manter publicado". As recusas: "Não
  foi pausado.", "Não foi retomado.". "Check-in" é "o registo de entradas" dos convidados,
  nunca "a receção", que é a festa. O resultado concorda com "evento", nunca com o nome: "O
  evento {{name}} voltou a estar publicado".
- **26 Oct 2026. Publicar um rascunho e os estados de um evento** (sc-13956, sc-3584,
  `eventLive.*` web e app, `events.*`, `eventsScreen.*`, `messages:event.*`,
  `event.plan_limit`). "Make live" é "Publicar", como a permissão "Criar, publicar, pausar e
  concluir eventos". Os estados concordam com "evento": "Rascunho", "Publicado", "Em pausa",
  "Terminado". Uma recusa começa "Não foi publicado.", como "Não foi guardado."; o colega é
  "outra pessoa". O limite do plano é a mesma frase no ecrã e na API, "O seu plano {{plan}}
  permite ter {{count}} evento publicado ou em pausa de cada vez", com "de eventos" em `many`;
  0 é `other` em pt-PT. "Call off" é "cancelar". "Depois de este evento ser publicado", sem
  contrair a preposição antes do sujeito do infinitivo.
- **26 Oct 2026. O local do evento e a lista de eventos na app** (`web:eventForm.venue*`,
  `web:eventPage.venue*`, `addVenue`, `openInMaps`, `messages:validation.event_venue_*`,
  `mobile:eventsScreen.*`, sc-3589 and sc-1593 via sc-13205). Venue is "Local" ("Nome do
  local", "Local a confirmar", "Adicionar o local"), never "recinto" or "espaço"; its address is
  "Morada", the postal word, not "Endereço". "Open in maps" is "Ver no mapa". The zone offer asks
  "Pretende usá-lo?", impersonal and formal. The app's empty list says "na versão web da
  Soirely", feminine, as everywhere.
- **26 Oct 2026. A capa de um evento** (sc-13587, `web:eventCover.*`,
  `messages:validation.cover_*`). «Capa» para a secção e «Fotografia de capa» para o diálogo;
  «fotografia», nunca «foto», em toda a secção, e «imagem» só em «Descreva a imagem», a palavra
  do leitor de ecrã. «Carregar» para upload, com o gerúndio de PT-PT «A carregar…»; «píxeis», não
  «pixels». A linha do evento criado, «O evento foi guardado sem a fotografia. {{reason}}», lê-se
  com qualquer das recusas a seguir.
  Depois de uma recusa, os botões do diálogo são «Escolher outra fotografia» e, com a moldura
  vazia, «Escolher uma fotografia» (sc-16573): no infinitivo, como «Carregar uma fotografia» e
  «Usar esta fotografia», enquanto a recusa pede no imperativo, «Escolha uma maior».
- **26 Oct 2026. O tipo de evento** (`web:eventForm.type*`, `web:eventTypes.*`,
  `messages:validation.event_type_required`, sc-3588 via sc-13205). "Tipo", "Escolha o tipo de
  evento", e a recusa, igual no ecrã e na API, "Escolha que tipo de evento é.". Birthday é
  "Aniversário", por isso anniversary é "Aniversário de casamento": dois "Aniversário" na mesma
  lista não se distinguem. "Chá de bebé" (PT-PT, com acento agudo), "Cerimónia de graduação"
  (nunca "Formatura", que é do Brasil), "Homenagem póstuma" para memorial, "Gala ou evento
  solidário", "Evento empresarial".

- **25 Oct 2026. A count of a round million, `_many`** (every web and app count family,
  sc-8529, now that the key-parity guard allows it, PR #324). At 1 000 000 and every exact
  million, i18next picks `_many`. It is `_other` with "de" between the count and the noun it
  counts, "1 000 000 de pessoas", "os {{count}} de lugares", as the waiting email already does.
  Where no noun follows the count ("e mais {{count}}", "todos os {{count}}", "Pode adicionar mais
  {{count}}"), `_many` is `_other` as it stands. Every new count family gets its `_many`,
  except the proof window's lines (`waysCard.proveLink_*`, `proveUnlink_*`, `codeKeepsSignIn_*`):
  they count PROOF_MINUTES, a constant that is never a million, and the app's test holds them to
  `_one` and `_other`.
- **25 Oct 2026. Settings > Members on the web, the invitation link and the invitation email**
  (`web:membersScreen.*`, `web:join.*`, `invitations.*` web and app, `emails:invitation.*`,
  `messages:invitations.*`, sc-2922). The web twins of the app's Members keys are the app's
  words. An invitation is "convite", masculine, and its states agree with it: "Pendente",
  "Expirado", "Retirado" (revoked and withdrawn alike), "Recusado", "Aceite"; the deleted
  organisation is "Eliminada". "Revoke" is "Retirar". Joining is "aderir a {{organisation}}".
  The invitee is never the object of "convidar", which agrees with a gender: "enviou-lhe um
  convite", "quem lhe enviou o convite", and the email subject "Convite de {inviter} para
  aderir a {organisation} na Soirely". `formatDay` dates take "no dia" ("Enviado no dia
  {{sent}} · expira no dia {{ended}}") or "até", and never close a sentence: "Até {{date}},
  pode usar este convite." The email's `{date}` has a full month, so "válido até {date}."
  ends it. The subtitle names its counts after a colon, "com acesso: {{active}} · convites:
  {{invited}}". History lines name what was acted on, "Convite enviado por", "Pedido aprovado
  por", "Acesso suspenso / reposto / retirado por". Who sent an invitation in a list is "convite enviado por {{inviter}}", and the reader as sender is "si", "convite enviado por si" (`membersScreen.invitedAsByYou`), never "de a sua conta" (QA, 26 Oct). The row marker `membersScreen.you` stays "a sua conta", never "si" (QA #15272).
- **25 Oct 2026. Deleting an organisation** (`errors:owner_required`,
  `messages:organisation.owner_required`, `delete_name_mismatch`, `emails:organisationDeleted.*`,
  sc-3215). The refusals name the role, "Só alguém com a função Proprietário…", as
  `transfer_owner_required`. `delete_name_mismatch` is `ownership.deleteMismatch` word for
  word, and `restore` the second sentence of `ownership.deleteWindow`, "restaurá-la" included.
  The subject is "A organização {organisation} foi eliminada", so the participle agrees with
  "organização", never with a name. The date is "a {when}", as `password.changed.body`. The
  footer says "era membro".
- **25 Oct 2026. The API's refusals** (`messages:*`, sc-10809). An HTTP request is "o pedido
  HTTP" where a recovery or join "pedido" could be meant (the body refusals), and "o pedido" in
  the assistant's lines; an API path is "este URL", masculine. An id is "esse identificador",
  and a postal address is "morada". Field names an integrator sends (`idToken`, `code`,
  `recoveryCode`, `If-Match`, `context`, the assistant's roles) stay as written, in straight
  quotes where the English quotes them; "system prompt" stays English. Where a screen says the
  same sentence (`lostTwoFactor.*`, `signIn.timedOutBody_*`, `createOrganisation.limitedTitle`,
  the lock-outs' "Tente novamente às {time}"), the refusal says it too.
- **25 Oct 2026. The article before an API time** (sc-11332). The 01 hour is "a uma", so the
  lock-outs (`messages+intl-icu:limits.*`) and `emails+intl-icu:time.dateAt` choose the
  contraction from `{hour}` (0–23): `{hour, plural, =1 {à {time}} other {às {time}}}`, "à 01:05",
  "às 00:05" (zero horas), "às 13:05". Any new string that puts "à/às" before a clock time takes
  the same form, or "a hora {time}" where no `{hour}` reaches it.
- **25 Oct 2026. A time the clocks skip** (`eventForm.clocksSkip`, `clocksSkipNextDay`,
  sc-10675, reworded in sc-11163). "Em {{zone}}, a hora {{time}} do dia {{day}} não existe:
  nessa noite, os relógios são adiantados. Será guardada como {{savedAs}}." The next-day line
  ends "guardada no dia {{savedDay}}, às {{savedAs}}.", so the date never stands before the
  colon ("mar.:") or closes the sentence. "Do dia" and "no dia"
  agree with "dia", not with the weekday, which is how a weekday date takes a preposition
  inside a sentence (the 19 Oct rule forbids "a" and "na/no" alone). "Guardada" agrees with
  "a hora". Rejected "hora de verão", which names the rule rather than the missing hour.
- **25 Oct 2026. Editing an event's details (sc-9704, `eventEdit.*`).** "Edit details" is
  "Editar detalhes", "Save changes" "Guardar alterações", and changes are always "alterações",
  never "mudanças". A refused save starts "Não foi guardado."; the colleague is "outra pessoa",
  as `errors:precondition_failed`. What was typed is "o que escreveu". After a save the live
  region says "Alterações guardadas". The currency refusal is one sentence in `web` and
  `errors`, "… neste evento".
- **24 Oct 2026. Suspending a member by hand and restoring them** (`membersScreen.suspend*`,
  `restore*`, `seats*`, `emails:memberSuspended.*`, `memberRestored.*`, `messages:members.*`,
  sc-8735). "Suspender {{name}}", "Repor o acesso". What is suspended is "o acesso", so nothing
  agrees with the member: "O acesso de {{name}} foi suspenso", "Um acesso suspenso não ocupa
  lugar", "Só é possível suspender um acesso ativo". The member's language is "o idioma que
  usa", never "o seu idioma", which reads as the admin's. A team seat is "lugar de equipa" of
  "o plano", as `errors:team_seats_in_use`. "An administrator of" in the email is "alguém que
  administre {organisation}", which also covers owners. The email facts read "Data da
  suspensão" and "Data da reposição". `ownerNoSuspend` and `members.suspend_owner` say the
  same sentence.
- **24 Oct 2026. The claim that lapsed** (`emails:ownerClaim.lapsed.*`, sc-9219). "Lapse" is
  "caducar", as the web. The subject leads with the outcome, "Pedido caducado: {organisation}", as
  sc-14100: the sentence ran past one row of a 360dp inbox (QA, 26 Oct). The heading keeps
  "{claimant} não assumiu a propriedade de {organisation}. O pedido caducou", never "o pedido
  de {claimant}" with a bare address. Each
  reason ends "por isso a propriedade não foi transferida"; the date takes a label, "Data em
  que o pedido caducou: {deadline}.", as the withdrawn email.
- **24 Oct 2026. The rest of a role's holders** (`rolesScreen.moreHolders_*`, web and app,
  sc-9068). "e mais {{count}}", after the five names, the order Portuguese counts on in; "e
  outros" or "outras pessoas" would make the count agree with a gender nobody knows. `_many`
  is the same (25 Oct).
- **24 Oct 2026. A request refused for its shape** (`messages:validation.invalid_shape`,
  `validation.request_shape`, sc-8716). "Este campo não aceita esse valor", which also holds for
  a required field left out, then "Verifique-o e tente novamente", the pronoun for the field. The
  422 `detail` speaks of "os dados enviados", not "o pedido", which here is a request to join.
- **24 Oct 2026. Withdrawing your own claim** (`ownerClaim.withdraw*`, `youWithdrew*`,
  `emails:ownerClaim.withdrawn.*`, `messages:owner_claims.not_claimant`, sc-8556). The claimant
  "retira" o pedido; anybody else "interrompe" um. Button "Retirar o meu pedido", confirm
  "Retirar o seu pedido?" with "Retirar" / "Manter o meu pedido", pending "A retirar". "Any
  Administrator, you included" became "Pode voltar a fazer um pedido, tal como qualquer pessoa
  com a função Administrador", since "incluindo-o a si" agrees with a gender. The email date
  takes a label, "Data em que o pedido foi retirado: {deadline}", never "retirada", a retreat.
- **24 Oct 2026. Getting an owner back** (`ownerClaim.*`, web and app, `emails:ownerClaim.*`,
  `messages:owner_claims.*`, `errors:owner_claim_*`, sc-8216). "Become the owner" is "assumir a
  propriedade", never "tornar-se proprietário", which agrees with a gender; the claim is "o
  pedido", and the claimant "pediu para assumir a propriedade", true before and after the
  record is found. dev3's draft of `owner_claim_own` said "você" and "reivindicação"; it now
  says "Não pode interromper o seu próprio pedido". A DNS record is "registo", never
  "registro"; the claimant's is "o registo DNS desta pessoa". "Stop" is "interromper",
  "Soirely support" "o apoio ao cliente da Soirely", restoring "repor". The weekday dates
  follow the rule below: "até {{when}}" where the meaning allows, otherwise a label at the
  end, "Data da transferência: {{when}}"; the email subject puts it in brackets.
- **24 Oct 2026. The only owner left suspended** (`accessPaused.stillOnlyOwner`,
  `membersScreen.suspendedOnlyOwner`, `onlyOwnerNotRemovable`, `onlyOwnerRestoreNeedsAddress`,
  `history.suspendedAddressGone`, sc-7831). As `emails:domainSuspended.keptOnlyOwner`: "a única
  pessoa com a função Proprietário em {{organisation}}" and "não sai da organização". The
  refusal names "esta pessoa", so "removida" agrees with the noun, not the member, as the app's
  `onlyOwner`. Restoring needs "o endereço de e-mail principal desta pessoa". The history line
  is "Acesso suspenso: o endereço de e-mail da empresa deixou de dar acesso".
- **23 Oct 2026. Ownership and leaving** (`ownership.*`, web and app,
  `messages:organisation.transfer_owner_required`, `emails:ownershipTransferred.*`, sc-7715).
  The act is "transferir a propriedade", the organisation "cedida"; the people are "alguém com
  a função Proprietário" and "a função Administrador", never "o novo proprietário". "The new
  owner" is "quem receber a propriedade", the legend "Transferir para". "You become an
  Administrator" is "a sua função passa a ser Administrador", so the subject is never left to
  guess. Both people are told by "… a si e a {{name}}". The email subject "{organisation}
  mudou de proprietário" keeps the fixed phrase, which names no person. "Support" is "o apoio
  ao cliente da Soirely". The delete counts put the verb first, "São eliminados com ela
  {{events}}, …". i18next's 'pt' counts 0 as one, so a 0 shows "0 convidado" until [dev]
  gives the clients PT-PT's rule (sc-3030); raised again on sc-68. A slot appears once per key (the parity
  guard counts them), so `transferred` closes "… para as duas contas", not a second {{name}}.

- **21 Oct 2026. Approving or turning down a request to join** (`membersScreen.awaiting.*`,
  `membersScreen.history.turnedDown`, `requestExpired`, `emails:joinRequest.*`,
  `messages:members.request_answered`, sc-7217). "Approve" is "Aprovar", "turn down"
  "Recusar", and what is refused is "o pedido", never the person: "Recusar o pedido de
  {{name}}?", "Recusar o pedido de {{name}}", "Pedido recusado por {{by}}". A request nobody answered "é
  removido se ninguém responder até {{deadline}}": the slot opens on a weekday, so "até",
  never "a" (24 Oct, from QA; see the weekday rule below). A role given on approval is
  "com a função {{role}}"; the person refused "não passou a fazer parte da organização", never
  "não foi adicionado", so nothing agrees with them. The waiting email's count takes `=0`
  (PHP's ICU counts 0 as one in "pt") and `many`, "1 000 000 de pessoas".

- **24 Oct 2026. Who did it, in a history line** (`membersScreen.byYou`, `membersScreen.someone`,
  sc-7217, from QA). Both fill `{{by}}` after "por": the reader is "si" ("Pedido recusado por si"),
  never Brazilian "você", and a person who has since left is "alguém que já não é membro".

- **21 Oct 2026. A domain member paused** (`accessPaused.*`, `membersScreen.suspended*`,
  `restore*`, `emails:domainSuspended.*`, sc-6703). The person reads "Em pausa", the admins
  "Acesso suspenso", as the English keeps them apart. Restoring is "repor", as the drafted
  error had it. Nothing agrees with the member: "o acesso é retirado", "esta pessoa deixa de
  fazer parte", and the only Owner "não sai da organização" rather than "não é removido". A
  closed domain "deixou de aceitar adesões", as the setting's "Adesão por domínio da empresa".
  "Account settings" is "Definições da conta", button and sentence alike.
  24 Oct (qa2, #8038): the email subject opens on what happened, "Acesso em pausa: {name} em
  {organisation}", so a phone inbox shows it before the names. The admins' label is "Acesso
  suspenso: domínio da empresa" for all three reasons, as the setting. The member's history
  line (`history.suspendedAddressGone`, sc-8868) is the label's words, whatever the reason.
- **21 Oct 2026. Request link** (`requestLink.*`, `requestToJoin.*`,
  `messages:request_link.*`, `errors:request_link_dead`, `join_request_*`, sc-6460). A link
  is "a ligação", never "o link" (dev2's draft of `errors:request_link_dead` said "link"); the
  setting's is "a ligação de adesão". The setting is "Pedidos de adesão", so its state agrees:
  "Ativados" / "Desativados". The act stays "pedir para aderir", as domain joining; what waits
  is "o pedido de adesão … já aguarda resposta". `formatDay` ends on "nov.", so a date never
  closes a sentence: "A partir de {{date}}, pode voltar a pedir para aderir."

- **21 Oct 2026. Creating an event** (`events.*`, `eventForm.*`, `eventPage.*`,
  `rolesScreen.createEvents*`, `messages:validation.event_*`, sc-6302). A draft is "Rascunho";
  the form's legends "Início" and "Fim". An end before the start is "O evento termina antes de
  começar". "Carry on planning" is "prosseguir com o planeamento". An owner is "alguém com a
  função Proprietário", as "função" for a role. The permission's states are "Permitido" /
  "Não permitido". A refused send closes "por isso nada foi enviado".

- **21 Oct 2026. Two-factor for everyone** (`signInRules.everyone*`, `due*`, `overdue*`,
  `twoFactorCard.keptByRule`, `emails:signInRules.twoFactorDue.*`, sc-5702). "Require" is
  "exigir", as the server's errors; "for everyone" is "para todos". The date is "a partir de
  {{deadline}}" and "até {{deadline}}", as `limitedBody` and `endsBy`. "Set it up" is
  "ativar", as "turn on" in en; "carry on" is "prosseguir". A person who must act is "cada
  pessoa", with the verb in the singular, so nothing agrees with a gender. The overdue
  screen's body says why, "… e o prazo para a ativar já terminou". "Single-event access" is
  "o seu acesso a eventos individuais". The card and the server's refusal say the same
  sentence, "… por isso não a pode desativar".

- **26 Oct 2026. Two-factor for everyone, the artboard's lines** (sc-13182,
  `signInRules.everyoneOn`, `everyoneOff`, `everyoneWithoutBody_*`, `everyoneStillWithout_*`,
  `emails:signInRules.twoFactorDue.*`). A banner is "um aviso". Their deadline is "a sua
  data-limite", "até à sua data-limite", and the email's facts label it "Data-limite", since
  "Obrigatória a partir de" cannot stand before a colon. "Turn it on once" is "Basta ativá-la
  uma vez".

- **21 Oct 2026. Company domain joining** (`domainJoining.*`, `companyDomains.*`,
  `messages:domain_joining.*`, sc-4434). The act is "pedir para aderir", the wait "A
  aguardar aprovação", as the Members state. What gets approved is "o pedido", so no "o/a"
  agrees with the person; an invitation is asked for as "peça um convite a alguém", never
  "peça que o convide". "… instead" buttons are "Prefiro …". The setting is "Adesão por
  domínio da empresa", "Ativada" / "Desativada"; a working domain "Aceita pedidos", a
  stopped one "Sem efeito". People at a domain are "quem usa {{domain}}".

- **21 Oct 2026. Members in the app** (`mobile:membersScreen.*`, sc-4259). The screen is
  "Membros", a role "função", and a member is removed with "Remover", as on Account. A
  person's state never agrees with them: "Com acesso", "A aguardar aprovação", "Acesso
  suspenso", "Saiu", "Acesso retirado"; dates in the row line take "a" ("saiu a {{date}}").
  "You" beside your own row is "a sua conta", and "You · {{role}}" is "A sua função: {{role}}",
  never "você". "Their events" is "os eventos desta pessoa", since "os seus" reads as the
  reader's and "dela" assumes a woman. "On their next request" is "assim que voltar a usar a
  Soirely". Groups on the chips take the plural, "Todos", "Suspensos", "Antigos".
- **21 Oct 2026. Invitations waiting on Complete your profile** (`completeProfile.*`, web and
  app, sc-4188). An invitation is "convite", waiting is "pendente". With several, "that
  organisation" is "a organização que o enviou", where "o" is the invitation, never the
  person. A button in a sentence goes in «» after "Selecione": "Selecione «Guardar e
  continuar» para entrar nela". Switching is "mudar para", as "Mudar de organização". "Accept an invitation above" is "aceite um convite pendente", the
  word the intro uses, not "aceite acima", which reads stiffly. `_many` as
  the 25 Oct entry says.

- **21 Oct 2026. Starting your own organisation** (`noOrganisation.start*`, web, and the app
  once sc-5932 adds it, sc-6897). "Start" is "criar", since "iniciar uma organização" is not
  how PT-PT says it: the heading is "Crie a sua própria organização", the button "Criar
  organização", as `createOrganisation.create`. One character is "carácter", several
  "caracteres". The help and the derived-settings line are `createOrganisation`'s words.

- **21 Oct 2026. Creating another organisation** (`createOrganisation.*`, web and app, sc-3490).
  "You will be its owner" is "Terá a função Proprietário", never "será o proprietário".
  The rate limit says what happened, "Por agora, não é possível criar mais organizações".
  Where a list mixes genders (moeda, fuso horário, endereço), the sentence after it says
  "estes dados" rather than agreeing with one noun. A path in Settings is "Definições >
  Geral"; "Creating…" is "A criar…", the PT-PT progressive.

- **21 Oct 2026. The organisation's language (sc-3311, `orgGeneral.language*`, web and app).**
  The label is "Idioma", as the English "Language"; if English lengthens it to "Language for
  invitations", it becomes "Idioma dos convites". "Invitation emails" are "os e-mails de convite", and the people
  are "pessoas sem conta Soirely". Language names are "Inglês, Espanhol, Francês, Português"
  as options and lower case in a sentence ("são enviados em inglês"). A refused save is "Nada
  foi guardado." and the server's `permission_required` words unchanged.
- **21 Oct 2026. The re-proof's step two after a provider sign-in** (`waysCard.signedInWith`,
  `codeKeepsSignIn_*`, sc-2908, reworded 29 Oct). The status box is "Sessão iniciada com a
  conta {{provider}}", with no full stop. Under the code field: "Se errar o código, não tem de
  voltar à sua conta {{provider}}. O início de sessão com a conta {{provider}} é válido
  durante {{count}} minutos." Every slot the English has stays, so the second mention is "a conta
  {{provider}}", not "ela". A condition on the
  person, because "não o faz voltar" would have to agree (o/a). A window is "é válido durante".
- **19 Oct 2026. Sign-in rules are "Regras de início de sessão"** (`signInRules.*`, web and
  app, and `emails:signInRules.*`, sc-3030). A member held back by one "pode consultar tudo,
  mas sem alterar nada", the same words on the banner, the owner's preview and the email;
  the state is "Só de leitura". A session that ends "é encerrada", as the glossary says, and
  `errors:session_timed_out` now says so too. In prose a provider is "uma conta Google ou
  Apple", which needs no article for either; a button keeps "Associar Google ou Apple", as
  `waysCard.link`. Where a list of names is the subject (`effectStranded`'s `{{names}}`), the
  sentence opens "Abrange {{names}}:" and goes on with "é possível", so no verb has to agree
  with a count the string does not have. "Turn on two-factor" is "Ativar a autenticação de
  dois fatores", as `twoFactorCard.turnOn`; "the shortest of your organisations" is "a mais
  exigente", since the shortest limit is the strictest rule. Roles are "funções", as on the
  Roles screen; people who can manage are "quem pode gerir".

- **18 Oct 2026. The contact cap is "Uma conta pode ter até {{most}} …, incluindo o
  principal"** (`contacts.capEmails_*`, `capPhones_*`, `capFullEmails`, `capFullPhones`, web
  and app), as `contacts.limitEmails` and `limitPhones` already say. One more is "Pode
  adicionar mais um"; the full line is "Já tem {{most}}, o máximo que uma conta pode ter.
  Remova um para adicionar outro." "Endereço" and "número" are both masculine, so a number's
  own keys (`contacts.verifiedPhone`, `primaryPhone`, `makePrimaryPhone`, `removeConfirmPhone`,
  `removeKeepPhone`) hold the address card's words, and "Não verificado" serves both, with no
  `unverifiedPhone`. The count is never 0 here (the full line shows instead) and never large,
  so `_one` and `_other` cover it.
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
- **19 Oct 2026. A weekday date is never preceded by "a"** (`signInRules.changedBody`, web and
  app, sc-3030). `{{day}}` is "segunda-feira, 19 de out.": before a weekday PT-PT says "na" or
  "no" (sábado, domingo), which the copy cannot agree with, and the abbreviated month brings
  its own full stop. It is a label at the end, with no full stop after the slot:
  "{{organisation}} alterou as regras de início de sessão. Data da alteração: {{day}}". After a
  status it is lowercase, with the time after a comma: "data do pedido: {{day}}, às {{time}}"
  (`domainJoining.asked`, sc-4434). The
  "a {when}" rule below stays for a date without a weekday. A period without use is "Quem
  passar {{count}} dias sem utilizar a Soirely terá de…" (`effectIdle_*`,
  `emails+intl-icu:signInRules.rule.inactivity`), not "Quem não utilizar… há", which mixes a
  future subjunctive with "há". ICU's and i18next's 'pt' count 0 as one, the Brazilian rule:
  an ICU plural in PT-PT carries `=0 {# dias}`; the clients' `_one` needs `[dev]` (sc-3030).

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
  and `forms.emailShape`, web and app; `membersScreen.emailShape` and the API's
  `validation.email_invalid`, `validation.contact_address_invalid` and
  `validation.invite_email_invalid` since sc-20577): "Isso não parece um endereço de e-mail.
  Confirme que tem um @ e um domínio." The English of every one is the same, so the Portuguese
  is too; "Verifique se tem" was the odd one out.
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
- **17 Oct 2026, corrected 29 Oct. A provider in prose never takes a bare article**
  (`waysCard.proofExpired_*`): the article differs, "a Apple" but "o Google", and one string
  serves both. Write "a sua conta {{provider}}" or "uma conta {{provider}}" instead, as
  `ownership.transferNoteProvider` ("Antes, terá de confirmar com a sua conta {{provider}}.",
  sc-18978). A button has no article: "Continuar com {{provider}}", and so does a
  title that repeats one, "Desassociar {{provider}}". Every string is rewritten this way
  (sc-20444): "a sua conta {{provider}}" in a sentence, "a conta {{provider}}" in a short
  label or bullet, and what agrees with it is feminine ("associada", "desassociada",
  "removida", "com ela"). Where the provider acted ("{{provider}} confirmed it is you"), the
  sentence is "Identidade confirmada através da sua conta {{provider}}"; where it opens,
  "abre-se uma janela {{provider}}". "Carry on" is "prosseguir", so it does not repeat "continuar".
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
- **25 Oct 2026. Moving the people off a removed role** is worded so it reads for one person
  or many, because the button and the refusal get no {{count}}: "Reatribuir e remover {{role}}",
  and "Escolha a função de substituição", the legend's own noun. Not "Passá-las…" or "estas
  pessoas" after "1 pessoa tem esta função" (sc-13017).
  The line under the chosen role, `rolesScreen.removeAfter`, takes the role as subject and an
  infinitive: "A função {{role}} aplica-se ao voltar a usar a Soirely", not "Passam a ser…" (sc-14755).
- **26 Oct 2026. The beyond-grant line names access** (`membersScreen.beyondGrant`, sc-13089). "… por isso não pode alterar-lhe a função nem o acesso": the enclitic "lhe" points at the member, so "o acesso" is never read as the reader's.
- **26 Oct 2026. A security email's subject opens on the feature, then its state**
  (`emails:twoFactor.on.subject`, `twoFactor.off.subject`, sc-14100): "Autenticação de dois
  fatores ativada" / "desativada", a pair that differs only in its last word. "A autenticação
  de dois fatores foi desativada" ran past one line of a 360dp inbox row.
- **27 Oct 2026. An event's dates are "o calendário", never "o programa"** (`timeline.*`,
  sc-15756). "Programa" is the organiser's Schedule (epic 33); the list of an event's dates is
  "Todas as datas" (sc-19010, after the English became All dates; "calendário" alone is the organisation's Calendar), its panel "Próximas datas"; "A carregar as datas…", "Não foi possível carregar as datas." The owner pill "You" is "A seu cargo",
  since "Você" is Brazilian. Distances follow the date: "hoje", "daqui a 3 dias", "há 2 dias".
  The API titles keep the name as subject, "{name} começa", "{name} termina", so no article
  has to agree with it.
- **27 Oct 2026. Os separadores de Eventos e os seus estados vazios** (sc-15981 para sc-3594,
  `events.*`, `eventsScreen.*`). Os separadores são "Próximos", "Rascunhos" e "Anteriores".
  "Make live" continua a ser "publicar"; "Called off on" é "Cancelado a {{date}}", com "a" antes
  da data, à maneira pt-PT. "Next up" é "A seguir", como `timeline.nextUp`. O botão enquanto
  carrega diz "A carregar mais…". A contagem anunciada concorda o verbo: "Foi mostrado mais 1 …",
  "Foram mostrados mais …", com "de eventos" em `many`; 0 é `other`. `moreFailed` repete a
  segunda frase da falha de carregamento do seu ecrã, como em inglês.
- **28 Oct 2026. The two-factor-due subject opens on the deadline**
  (`emails:signInRules.twoFactorDue.subject`, sc-15219): "Até {deadline}: autenticação de dois
  fatores em {organisation}". With the feature first a 390 px inbox cut inside the weekday
  (qa2, #18836); "Até" takes 4 characters, so the date and time show at 360 px. "até" needs no
  article before the weekday. A subject whose news is a deadline opens on it; the rest keep the
  feature first (sc-14100).
- **27 Oct 2026. A página de dados nomeia a regra, não a função** (sc-16443 para sc-16265,
  `orgGeneral.readOnlyUntil*`, `refusedByRule`). Cada linha abre com a regra nas palavras do
  aviso (`signInRules.unlinkedBody`, `gateBody`; "só aceita", porque aqui a regra não é nova) e
  fecha como `orgGeneral.readOnly`: "pode ver estes dados mas não alterá-los", e não o "pode
  consultar tudo, mas sem alterar nada" do aviso, porque a linha fala dos dados acima dela. Um
  guardar recusado pela regra diz só "Nada foi guardado.", o início de `refused`.
- **27 Oct 2026. O marco de um evento cancelado** (sc-16725 para sc-16709,
  `messages:timeline.event_called_off`). "Cancelamento de {name}", um substantivo, para não
  concordar com um nome de evento cujo género o código não conhece.
- **27 Oct 2026. Uma contagem de eliminação que falha** (`ownership.deleteUncounted`,
  `ownership.deleteRetry`, web e app, sc-16928 para sc-16866). "Não foi possível contar o que
  contém", com o verbo de `deleteLoading`. "Se a eliminar … são eliminados na mesma", e
  "restaurá-la", como `deleteWindow`, com o prazo fixo "durante 30 dias". O botão é "Tentar
  novamente", como no ecrã Eventos.
