import type { Lang, Visit } from './guest.ts';
import { type SampleEvent, localDay, sampleEvent } from './events.ts';
import type { DemoLink } from './settings.ts';

const WEDDING = sampleEvent('evt-wed-4') as SampleEvent;

/** The wedding's start date in its own timezone: every date here is a calendar date there. */
export const START_DAY = localDay(WEDDING.startsAt, WEDDING.timeZone);

export type AskKey = 'week' | 'twoWeeks' | 'weekBefore' | 'beforeClose' | 'never';
export type AskView = 'question' | 'saved' | 'wont' | 'closeNow' | 'none';
/** What the first Save meets: it lands, it does not reach us, a 422 a day later, or a 409. */
export type Outcome = 'ok' | 'net' | 'moved' | 'changed';

export interface Ask {
  today: string;
  view: AskView;
  pick: AskKey | null;
  saving: boolean;
  error: 'empty' | 'net' | null;
  moved: boolean;
  live: boolean;
  on: string | null;
  outcome: Outcome;
}

export function plusDays(day: string, days: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);

  return at.toISOString().slice(0, 10);
}

export function askDate(key: AskKey, today: string, replyBy: string | null): string | null {
  switch (key) {
    case 'week':
      return plusDays(today, 7);
    case 'twoWeeks':
      return plusDays(today, 14);
    case 'weekBefore':
      return plusDays(START_DAY, -7);
    case 'beforeClose':
      return replyBy == null ? null : plusDays(replyBy, -3);
    case 'never':
      return null;
  }
}

/** sc-1363: tomorrow or later, at least 3 days before the start, and by the Reply by date when it applies. */
export function offer(today: string, replyBy: string | null): AskKey[] {
  const third: AskKey = replyBy == null ? 'weekBefore' : 'beforeClose';
  const dates = (['week', 'twoWeeks', third] as const).filter((key) => {
    const day = askDate(key, today, replyBy);

    return (
      day != null &&
      day >= plusDays(today, 1) &&
      day <= plusDays(START_DAY, -3) &&
      (replyBy == null || day <= replyBy)
    );
  });

  return dates.length === 0 ? [] : [...dates, 'never'];
}

export function asking(visit: Visit): Ask | null {
  const { ask, recorded, view } = visit;

  return ask != null && recorded?.answer === 'notSure' && view.kind === 'recorded' ? ask : null;
}

/** What a Save lands on, worked out when it is pressed, and the field the focus goes to. */
export function landed(visit: Visit): { change: Partial<Visit>; want: string } {
  const ask = visit.ask;
  if (ask == null || ask.pick == null) return { change: {}, want: 'againSave' };
  const done: Ask = { ...ask, saving: false };

  switch (ask.outcome) {
    case 'net':
      return { change: { ask: { ...done, error: 'net', outcome: 'ok' } }, want: 'againSave' };
    case 'changed':
      return {
        change: {
          ask: { ...done, view: 'none' },
          recorded: { answer: 'coming', on: ask.today },
          view: { kind: 'recorded', same: false },
        },
        want: 'answered',
      };
    case 'moved': {
      const today = plusDays(ask.today, 1);
      const left = offer(today, visit.replyBy);

      return left.length === 0
        ? { change: { ask: { ...done, today, view: 'closeNow' } }, want: 'againClose' }
        : {
            change: { ask: { ...done, today, pick: null, moved: true, outcome: 'ok' } },
            want: 'againSave',
          };
    }
    case 'ok':
      return {
        change: {
          ask: {
            ...done,
            view: ask.pick === 'never' ? 'wont' : 'saved',
            on: askDate(ask.pick, ask.today, visit.replyBy),
            live: true,
            moved: false,
            error: null,
          },
        },
        want: 'againSaved',
      };
  }
}

/** A new answer cancels the ask; a Not sure yet after it asks the question again. */
export function askedAgain(ask: Ask): Ask {
  return { ...ask, view: 'question', pick: null, on: null, live: false, error: null, moved: false };
}

type AskWords = Record<
  'q' | AskKey | 'save' | 'empty' | 'saved' | 'wont' | 'net' | 'moved' | 'close' | 'closeReplyBy',
  string
>;

const ASK_WORDS: Record<Lang, AskWords> = {
  en: {
    q: 'When should we ask you again?',
    week: 'In a week',
    twoWeeks: 'In two weeks',
    weekBefore: 'A week before the event',
    beforeClose: 'Three days before answers close',
    never: 'Don’t ask me again',
    save: 'Save',
    empty: 'Choose when we should ask you, or Don’t ask me again.',
    saved: 'We’ll ask you on {date}.',
    wont: 'We won’t ask again.',
    net: 'Not saved. Check your connection and press Save again.',
    moved: 'Not saved. The choices have changed since you opened this page. Choose again.',
    close: 'Not saved. It is now too close to the event to ask you again.',
    closeReplyBy: 'Not saved. Answers close too soon for us to ask you again.',
  },
  es: {
    q: '[¿Cuándo se lo volvemos a preguntar?]',
    week: '[Dentro de una semana]',
    twoWeeks: '[Dentro de dos semanas]',
    weekBefore: '[Una semana antes del evento]',
    beforeClose: '[3 días antes del cierre de las respuestas]',
    never: '[No me lo vuelvan a preguntar]',
    save: '[Guardar]',
    empty: '[Elija cuándo se lo volvemos a preguntar, o No me lo vuelvan a preguntar.]',
    saved: '[Se lo preguntaremos el {date}.]',
    wont: '[No se lo volveremos a preguntar.]',
    net: '[No se ha guardado. Compruebe la conexión y vuelva a pulsar Guardar.]',
    moved:
      '[No se ha guardado. Las opciones han cambiado desde que abrió esta página. Vuelva a elegir.]',
    close: '[No se ha guardado. El evento ya está demasiado cerca para volver a preguntárselo.]',
    closeReplyBy:
      '[No se ha guardado. Las respuestas se cierran demasiado pronto para volver a preguntárselo.]',
  },
  fr: {
    q: '[Quand devons-nous vous le redemander ?]',
    week: '[Dans une semaine]',
    twoWeeks: '[Dans deux semaines]',
    weekBefore: '[Une semaine avant l’événement]',
    beforeClose: '[3 jours avant la clôture des réponses]',
    never: '[Ne plus me le demander]',
    save: '[Enregistrer]',
    empty: '[Choisissez quand nous devons vous le redemander, ou Ne plus me le demander.]',
    saved: '[Nous vous le redemanderons le {date}.]',
    wont: '[Nous ne vous le redemanderons pas.]',
    net: '[Non enregistré. Vérifiez votre connexion et appuyez de nouveau sur Enregistrer.]',
    moved:
      '[Non enregistré. Les choix ont changé depuis l’ouverture de cette page. Choisissez de nouveau.]',
    close: '[Non enregistré. L’événement est désormais trop proche pour vous le redemander.]',
    closeReplyBy: '[Non enregistré. Les réponses ferment trop tôt pour vous le redemander.]',
  },
  pt: {
    q: '[Quando lhe devemos voltar a perguntar?]',
    week: '[Daqui a uma semana]',
    twoWeeks: '[Daqui a duas semanas]',
    weekBefore: '[Uma semana antes do evento]',
    beforeClose: '[3 dias antes do fecho das respostas]',
    never: '[Não voltar a perguntar]',
    save: '[Guardar]',
    empty: '[Escolha quando lhe devemos voltar a perguntar, ou Não voltar a perguntar.]',
    saved: '[Voltamos a perguntar-lhe a {date}.]',
    wont: '[Não voltaremos a perguntar.]',
    net: '[Não foi guardado. Verifique a ligação à internet e toque novamente em Guardar.]',
    moved: '[Não foi guardado. As opções mudaram desde que abriu esta página. Escolha novamente.]',
    close: '[Não foi guardado. O evento está agora demasiado próximo para voltarmos a perguntar.]',
    closeReplyBy:
      '[Não foi guardado. As respostas fecham demasiado cedo para voltarmos a perguntar.]',
  },
};

export function askWords(lang: Lang): AskWords {
  return ASK_WORDS[lang];
}

function ask(today: string, extra: Partial<Ask> = {}): Ask {
  return {
    today,
    view: 'question',
    pick: null,
    saving: false,
    error: null,
    moved: false,
    live: false,
    on: null,
    outcome: 'ok',
    ...extra,
  };
}

/** The page on our clock at 10:00 in London on the day `days` before the start; no Reply by unless given. */
function maybe(days: number, extra: Partial<Ask> = {}, visit: Partial<Visit> = {}): Partial<Visit> {
  const today = plusDays(START_DAY, -days);

  return {
    now: `${today}T10:00:00Z`,
    replyBy: null,
    recorded: { answer: 'notSure', on: today },
    view: { kind: 'recorded', same: false },
    ask: ask(today, extra),
    ...visit,
  };
}

const EARLIER = (days: number) =>
  ({ recorded: { answer: 'notSure', on: plusDays(START_DAY, -days - 5) } }) as const;
const SAVED_ON = plusDays(START_DAY, -23);

export const GUEST_ASK_STATES = {
  maybe_recorded: {
    name: 'Not sure yet, 30 days before: When should we ask you again?',
    starts: maybe(30),
  },
  maybe_days_12: { name: 'Days to the event: 12', starts: maybe(12) },
  maybe_days_8: { name: 'Days to the event: 8, tomorrow only', starts: maybe(8) },
  maybe_too_close: { name: 'Days to the event: 7, no date left, no question', starts: maybe(7) },
  maybe_days_5: { name: 'Days to the event: 5, no question', starts: maybe(5) },
  maybe_reply_by: {
    name: 'A Reply by in 12 days: In a week and 3 days before answers close',
    starts: maybe(30, {}, { replyBy: plusDays(START_DAY, -18) }),
  },
  maybe_reply_by_none: {
    name: 'A Reply by in 3 days: no question',
    starts: maybe(30, {}, { replyBy: plusDays(START_DAY, -27) }),
  },
  maybe_reply_by_closed: {
    name: 'After the Reply by date: the closed view alone',
    starts: maybe(12, {}, { replyBy: plusDays(START_DAY, -14), view: { kind: 'closed' } }),
  },
  maybe_saving: {
    name: 'Saving',
    starts: maybe(30, { pick: 'week', saving: true }),
  },
  maybe_save_empty: {
    name: 'Save with nothing chosen',
    starts: maybe(30, { error: 'empty' }, { want: 'again-week' }),
  },
  maybe_save_empty_long: {
    name: 'Save with nothing chosen, at French length (open it at 320)',
    starts: maybe(30, { error: 'empty' }, { lang: 'fr', want: 'again-week' }),
  },
  maybe_ask_saved: {
    name: 'Saved: We’ll ask you on {date}.',
    starts: maybe(
      30,
      { view: 'saved', on: plusDays(START_DAY, -23), live: true },
      { want: 'againSaved' },
    ),
  },
  maybe_wont_ask: {
    name: 'Saved: We won’t ask again.',
    starts: maybe(30, { view: 'wont', pick: 'never', live: true }, { want: 'againSaved' }),
  },
  maybe_not_saved: {
    name: 'A Save that did not reach us',
    starts: maybe(30, { pick: 'week', error: 'net' }, { want: 'againSave' }),
  },
  maybe_coming_back_saved: {
    name: 'Coming back: a date saved, not sent yet',
    starts: maybe(25, { view: 'saved', on: SAVED_ON }, EARLIER(25)),
  },
  maybe_coming_back_wont: {
    name: 'Coming back: Don’t ask me again saved',
    starts: maybe(25, { view: 'wont', pick: 'never' }, EARLIER(25)),
  },
  maybe_coming_back_none: {
    name: 'Coming back: nothing saved, the question again',
    starts: maybe(25, {}, EARLIER(25)),
  },
  maybe_coming_back_sent: {
    name: 'Coming back: the ask sent, or Not sent: too late',
    starts: maybe(20, { view: 'none' }, EARLIER(20)),
  },
  maybe_dates_moved: {
    name: 'Save refused, a day later (422): the choices have changed',
    starts: maybe(12, { pick: 'week', outcome: 'moved' }, { want: 'againSave' }),
  },
  maybe_too_close_now: {
    name: 'Save refused, a day later (422): too close to ask again',
    starts: maybe(8, { pick: 'weekBefore', outcome: 'moved' }, { want: 'againSave' }),
  },
  maybe_too_close_now_reply_by: {
    name: 'Save refused under a Reply by (422): answers close too soon',
    starts: maybe(
      30,
      { today: plusDays(START_DAY, -24), pick: 'beforeClose', outcome: 'moved' },
      {
        now: `${plusDays(START_DAY, -24)}T10:00:00Z`,
        replyBy: plusDays(START_DAY, -20),
        want: 'againSave',
      },
    ),
  },
  maybe_reply_changed: {
    name: 'Save refused, answered on another device (409)',
    starts: maybe(30, { pick: 'week', outcome: 'changed' }, { want: 'againSave' }),
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestAskState = keyof typeof GUEST_ASK_STATES;

export function isGuestAskState(value: string | null): value is GuestAskState {
  return value != null && Object.hasOwn(GUEST_ASK_STATES, value);
}

export function guestAskStarts(state: GuestAskState): Partial<Visit> {
  return GUEST_ASK_STATES[state].starts as Partial<Visit>;
}

export const GUEST_ASK_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'When should we ask you again? (sc-1363)',
    states: (Object.keys(GUEST_ASK_STATES) as GuestAskState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_ASK_STATES[state].name,
    })),
  },
];
