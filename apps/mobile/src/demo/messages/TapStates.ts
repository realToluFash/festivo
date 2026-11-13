import { listFormat } from '@soirely/domain';

import type { Messages } from './MessagesModel.ts';
import { DAYS, GUESTS, type MarkKey } from './MessagesSample.ts';
import { CHANNEL_WORD, W, say } from './MessagesWords.ts';
import type { NoticeCase } from './NoticeStates.ts';

export const TAP_STATES = [
  'tapNotComing',
  'tapNotSure',
  'tapNeedsYou',
  'tapFailed',
  'tapNoCredits',
  'tapStopped',
  'tapComing',
  'tapComingNotSent',
  'tapRepeat',
  'tapRepeatAgain',
  'tapClosed',
] as const;

export type TapState = (typeof TAP_STATES)[number];

export function isTapState(state: string | null): state is TapState {
  return TAP_STATES.some((one) => one === state);
}

export type TapAnswer = 'notComing' | 'notSure';
export type TapReceipt = 'sent' | 'delivered' | 'read' | 'failed';
export type TapNotSent = 'credits' | 'stopped';
export type TapReply = 'recorded' | 'coming' | 'repeat' | 'closed';
export type TapLanguage = 'en' | 'es';

export interface Tap {
  answer: TapAnswer;
  time: string;
  recorded: boolean;
  reply: TapReply | null;
  companions?: boolean;
  receipt?: TapReceipt;
  notSent?: TapNotSent;
}

export interface TapCase {
  key: 'kwame' | 'lucia';
  language: TapLanguage;
  taps: readonly Tap[];
}

export type TapItem =
  | { kind: 'today' }
  | { kind: 'line'; text: string; time: string }
  | { kind: 'message'; lines: readonly string[]; receipt: { word: string; mark: MarkKey } }
  | { kind: 'notSent'; word: string; mark: MarkKey };

export const TAP_AT = '08:20';
export const TAP_AGAIN_AT = '08:31';
export const CLOSED_ON = '2026-11-02';
export const HOST_NAMES = ['Adaeze Obi', 'Tunde Bakare'] as const;

export const TW = {
  notComing: 'Not coming',
  notSure: 'Not sure yet',
  tooFewCredits: 'Too few credits',
};

export const sayTap = {
  answered: (name: string, answer: string) => `${name} answered ${answer} by WhatsApp.`,
  tapped: (name: string, answer: string) =>
    `${name} tapped ${answer} in WhatsApp. Nothing changed.`,
  coming: () =>
    'You’re down as Coming, so nothing has changed. To change your answer, open your page with “Yes, I’ll be there” in the invitation.',
  repeat: (answer: string) => `You’re already down as ${answer}. Nothing has changed.`,
  closed: (date: string) =>
    `Answers closed on ${date}. Contact your host if something has changed.`,
};

const RECORDED: Record<
  TapLanguage,
  {
    told: Record<TapAnswer, (hosts: string) => string>;
    companions: Record<TapAnswer, string>;
    stillWork: string;
  }
> = {
  en: {
    told: {
      notComing: (hosts) => `Thank you. We have told ${hosts} that you are not coming.`,
      notSure: (hosts) => `Thank you. We have told ${hosts} that you are not sure yet.`,
    },
    companions: {
      notComing: 'Your companions won’t be coming either.',
      notSure: 'Your companions are on hold until you decide.',
    },
    stillWork: 'If you change your mind, the buttons in the invitation still work.',
  },
  es: {
    told: {
      notComing: (hosts) => `Gracias. Hemos avisado a ${hosts} de que no viene.`,
      notSure: (hosts) => `Gracias. Hemos avisado a ${hosts} de que aún no lo sabe.`,
    },
    companions: {
      notComing: 'Sus acompañantes tampoco vendrán.',
      notSure: 'Sus acompañantes quedan en espera hasta que usted decida.',
    },
    stillWork: 'Si cambia de opinión, los botones de la invitación siguen funcionando.',
  },
};

const RECEIPT_MARK: Record<TapReceipt, MarkKey> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'delivered',
  failed: 'bounced',
};

const RECEIPT_WORD: Record<TapReceipt, string> = {
  sent: W.sent,
  delivered: W.delivered,
  read: W.read,
  failed: W.failedReceipt,
};

const once = (tap: Omit<Tap, 'time'>): readonly Tap[] => [{ ...tap, time: TAP_AT }];
const REPEAT: readonly Tap[] = [
  { answer: 'notSure', time: TAP_AT, recorded: true, reply: 'recorded', receipt: 'read' },
  { answer: 'notSure', time: TAP_AGAIN_AT, recorded: false, reply: 'repeat', receipt: 'delivered' },
];

export function tapCaseOf(state: string | null): TapCase | null {
  const kwame = (taps: readonly Tap[]): TapCase => ({ key: 'kwame', language: 'en', taps });

  switch (state) {
    case 'tapNotComing':
      return kwame(
        once({
          answer: 'notComing',
          recorded: true,
          reply: 'recorded',
          companions: true,
          receipt: 'read',
        }),
      );
    case 'tapNotSure':
      return kwame(
        once({ answer: 'notSure', recorded: true, reply: 'recorded', receipt: 'delivered' }),
      );
    case 'tapNeedsYou':
      return {
        key: 'lucia',
        language: 'es',
        taps: once({
          answer: 'notSure',
          recorded: true,
          reply: 'recorded',
          companions: true,
          receipt: 'sent',
        }),
      };
    case 'tapFailed':
      return kwame(
        once({ answer: 'notComing', recorded: true, reply: 'recorded', receipt: 'failed' }),
      );
    case 'tapNoCredits':
      return kwame(once({ answer: 'notComing', recorded: true, reply: null, notSent: 'credits' }));
    case 'tapStopped':
      return {
        key: 'lucia',
        language: 'es',
        taps: once({ answer: 'notComing', recorded: true, reply: null, notSent: 'stopped' }),
      };
    case 'tapComing':
      return kwame(
        once({ answer: 'notComing', recorded: false, reply: 'coming', receipt: 'read' }),
      );
    case 'tapComingNotSent':
      return kwame(once({ answer: 'notComing', recorded: false, reply: null, notSent: 'credits' }));
    case 'tapRepeat':
    case 'tapRepeatAgain':
      return kwame(REPEAT);
    case 'tapClosed':
      return kwame(
        once({ answer: 'notSure', recorded: false, reply: 'closed', receipt: 'delivered' }),
      );
    default:
      return null;
  }
}

function noticeFor(state: TapState, key: TapCase['key']): NoticeCase {
  if (key === 'kwame') return { key, turn: { channel: 'wa', asked: { where: 'wa' } } };
  if (state !== 'tapStopped') return { key };

  return {
    key,
    turn: { asked: { where: 'wa' } },
    blocks: { wa: 'stoppedWhatsApp' },
    extras: [{ kind: 'stopped', channel: 'wa', time: '08:15' }],
  };
}

/** Kwame's conversation was marked done before his tap, and stays in Done; Lucía's waits in Needs you. */
export function tapStart(state: string | null): Partial<Messages> {
  const tap = tapCaseOf(state);

  if (tap == null || !isTapState(state)) return {};

  return {
    tap,
    notice: noticeFor(state, tap.key),
    open: { kind: 'guest', key: tap.key },
    ...(tap.key === 'kwame' ? { done: ['kwame'], doneAt: { kwame: '21:30' } } : {}),
  };
}

export function tapFor(m: Pick<Messages, 'tap'>, key: string): TapCase | null {
  return m.tap?.key === key ? m.tap : null;
}

export function hostsIn(language: TapLanguage): string {
  return listFormat(language, { style: 'long', type: 'conjunction' }).format(HOST_NAMES);
}

export function closedOn(): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${CLOSED_ON}T12:00:00Z`),
  );
}

export function tapLine(name: string, tap: Tap): string {
  const answer = TW[tap.answer];

  return tap.recorded ? sayTap.answered(name, answer) : sayTap.tapped(name, answer);
}

export function replyLines(tap: Tap, language: TapLanguage): readonly string[] {
  const words = RECORDED[language];

  switch (tap.reply) {
    case 'recorded':
      return [
        words.told[tap.answer](hostsIn(language)),
        ...(tap.companions === true ? [words.companions[tap.answer]] : []),
        words.stillWork,
      ];
    case 'coming':
      return [sayTap.coming()];
    case 'repeat':
      return [sayTap.repeat(TW[tap.answer])];
    case 'closed':
      return [sayTap.closed(closedOn())];
    default:
      return [];
  }
}

function notSentOf(why: TapNotSent): { word: string; mark: MarkKey } {
  return why === 'credits'
    ? { word: say.where(W.notSent, TW.tooFewCredits), mark: 'notsent' }
    : { word: say.where(W.notSent, W.stoppedWhatsApp), mark: 'optout' };
}

/** The tap lines in a guest's stream, each with Soirely's message under it or why none went; a Today rule first when the question came earlier. */
export function tapItemsOf(kase: TapCase): TapItem[] {
  const name = GUESTS[kase.key].name;
  const today: TapItem[] = GUESTS[kase.key].asked.day === DAYS.today ? [] : [{ kind: 'today' }];

  return [
    ...today,
    ...kase.taps.flatMap((tap): TapItem[] => {
      const line: TapItem = { kind: 'line', text: tapLine(name, tap), time: tap.time };

      if (tap.notSent != null) return [line, { kind: 'notSent', ...notSentOf(tap.notSent) }];
      if (tap.reply == null || tap.receipt == null) return [line];

      return [
        line,
        {
          kind: 'message',
          lines: replyLines(tap, kase.language),
          receipt: {
            word: say.where(CHANNEL_WORD.wa, RECEIPT_WORD[tap.receipt]),
            mark: RECEIPT_MARK[tap.receipt],
          },
        },
      ];
    }),
  ];
}

export function lineWords(item: { text: string; time: string }): string {
  return `${item.text} · ${item.time}`;
}

/** A conversation's row when its latest item is a tap line: that line and its time, in the same section. */
export function tapRowOf(
  m: Pick<Messages, 'tap'>,
  key: string,
): { line: string; time: string } | null {
  const tap = tapFor(m, key);
  const last = tap?.taps.at(-1);

  if (tap == null || last == null) return null;

  return { line: tapLine(GUESTS[tap.key].name, last), time: last.time };
}
