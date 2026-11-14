import type { BoardKey, Lang } from './guest.ts';

type Samples = Partial<Record<BoardKey, string>>;

/** French the product does not have yet: #5535's settled words, and [bracketed] samples l10n has not settled (sc-3790). */
const FRENCH: Samples = {
  replyBy: '[Merci de répondre avant le {{date}}. Vous pourrez modifier votre réponse d’ici là.]',
  answerIsComing: '[Votre réponse est « Je viens ».]',
  answerIsNotComing: '[Votre réponse est « Je ne viens pas ».]',
  answerIsNotSure: '[Votre réponse est « À confirmer ».]',
  recordedFor:
    '[{{name}} a enregistré cette réponse pour vous le {{date}}. Si elle n’est pas exacte, modifiez-la ici.]',
  recordedOn: '[{{name}} a enregistré cette réponse pour vous le {{date}}.]',
  doorTitle: '[Montrez ceci à l’entrée]',
  doorLine: '[Il vous fait entrer, vous et vos accompagnants. Une capture d’écran suffit.]',
  doorLineAlone: '[Une capture d’écran suffit.]',
  doorCode: '[Votre code pour l’entrée. Il ne contient aucun nom.]',
  calendarTitle: '[Ajouter au calendrier]',
  calendarLine: '[Votre calendrier se met à jour si la date, l’heure ou le lieu changent.]',
  switched: '[Cette page est maintenant en français.]',
  notSaved:
    '[Votre langue n’a pas été enregistrée. Cette page reste en français sur cet appareil, mais un autre appareil peut l’ouvrir dans une autre langue.]',
  changeStartTime: 'Nouvelle heure de début : {{new}} (avant : {{old}}).',
  changeVenue: 'Nouveau lieu : {{new}} (avant : {{old}}).',
  changeCalledOff: '[Événement annulé : {{event}}. Il n’aura pas lieu.]',
  noteFrom: '[Un mot de {{hosts}}]',
};

/** Portuguese (Portugal) the product does not have yet, as samples in [brackets] until l10n writes them. */
const PORTUGUESE: Samples = {
  replyBy: '[Responda até {{date}}. Pode alterar a sua resposta até lá.]',
  answerIsComing: '[A sua resposta é «Vem».]',
  answerIsNotComing: '[A sua resposta é «Não vem».]',
  answerIsNotSure: '[A sua resposta é «Por confirmar».]',
  recordedFor:
    '[{{name}} registou esta resposta por si a {{date}}. Se não estiver certa, altere-a aqui.]',
  recordedOn: '[{{name}} registou esta resposta por si a {{date}}.]',
  doorTitle: '[Mostre isto à entrada]',
  doorLine: '[Deixa-o entrar, a si e aos seus acompanhantes. Uma captura de ecrã também serve.]',
  doorLineAlone: '[Uma captura de ecrã também serve.]',
  doorCode: '[O seu código para a entrada. Não contém nenhum nome.]',
  calendarTitle: '[Adicionar ao calendário]',
  calendarLine: '[O seu calendário atualiza-se se a data, a hora ou o local mudarem.]',
  switched: '[Esta página está agora em português.]',
  notSaved:
    '[O seu idioma não foi guardado. Esta página continua em português neste dispositivo, mas outro dispositivo pode abri-la noutro idioma.]',
  changeStartTime: 'Nova hora de início: {{new}} (antes: {{old}}).',
  changeVenue: 'Novo local: {{new}} (antes: {{old}}).',
  changeCalledOff: '[Evento cancelado: {{event}}. Não se vai realizar.]',
  noteFrom: '[Uma nota de {{hosts}}]',
};

/** Spanish (Spain) the product does not have yet, as samples in [brackets] until l10n writes them. */
const SPANISH: Samples = {
  replyBy: '[Responda antes del {{date}}. Puede cambiar su respuesta hasta entonces.]',
  answerIsComing: '[Su respuesta es «Viene».]',
  answerIsNotComing: '[Su respuesta es «No viene».]',
  answerIsNotSure: '[Su respuesta es «Por confirmar».]',
  recordedFor:
    '[{{name}} registró esta respuesta por usted el {{date}}. Si no es correcta, cámbiela aquí.]',
  recordedOn: '[{{name}} registró esta respuesta por usted el {{date}}.]',
  doorTitle: '[Muestre esto en la entrada]',
  doorLine: '[Le deja entrar a usted y a sus acompañantes. Una captura de pantalla también vale.]',
  doorLineAlone: '[Una captura de pantalla también vale.]',
  doorCode: '[Su código para la entrada. No contiene ningún nombre.]',
  calendarTitle: '[Añadir al calendario]',
  calendarLine: '[Su calendario se actualiza si cambian la fecha, la hora o el lugar.]',
  switched: '[Esta página está ahora en español.]',
  notSaved:
    '[Su idioma no se ha guardado. Esta página sigue en español en este dispositivo, pero otro dispositivo puede abrirla en otro idioma.]',
  changeStartTime: 'Nueva hora de inicio: {{new}} (antes: {{old}}).',
  changeVenue: 'Nuevo lugar: {{new}} (antes: {{old}}).',
  changeCalledOff: '[Evento cancelado: {{event}}. No se celebrará.]',
  noteFrom: '[Una nota de {{hosts}}]',
};

export const BOARD_SAMPLES: Record<Exclude<Lang, 'en'>, Samples> = {
  fr: FRENCH,
  pt: PORTUGUESE,
  es: SPANISH,
};
