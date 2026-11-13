import { demoWords } from './demoWords.ts';
import type { Delivery, SampleGuest } from './messages.ts';
import type { Bit } from './messagesContext.ts';
import type { Extra, NoticeCase } from './messagesNotice.ts';
import { MW } from './messagesWords.ts';

/** sc-46343's lines in a guest's conversation, in l10n's English: (6) a tap that records, (7) one that changes nothing. */
export const TAPW = {
  answeredNotComing: '{{name}} answered Not coming by WhatsApp.',
  answeredNotSure: '{{name}} answered Not sure yet by WhatsApp.',
  tappedNotComing: '{{name}} tapped Not coming in WhatsApp. Nothing changed.',
  tappedNotSure: '{{name}} tapped Not sure yet in WhatsApp. Nothing changed.',
  tooFewCredits: 'Too few credits',
} as const;

const tapw = demoWords(TAPW);

/** Soirely's one message after a tap (l10n's (2) to (5)), in the guest's language: never typed by anyone. */
const GUEST_WORDS = {
  en: {
    notComing: 'Thank you. We have told {{hosts}} that you are not coming.',
    notSure: 'Thank you. We have told {{hosts}} that you are not sure yet.',
    companionsNotComing: 'Your companions won’t be coming either.',
    companionsOnHold: 'Your companions are on hold until you decide.',
    stillWork: 'If you change your mind, the buttons in the invitation still work.',
    coming:
      'You’re down as Coming, so nothing has changed. To change your answer, open your page with “Yes, I’ll be there” in the invitation.',
    same: 'You’re already down as {{answer}}. Nothing has changed.',
    statusNotComing: 'Not coming',
    statusNotSure: 'Not sure yet',
    closed: 'Answers closed on {{date}}. Contact your host if something has changed.',
  },
  es: {
    notComing: 'Gracias. Hemos avisado a {{hosts}} de que no viene.',
    notSure: 'Gracias. Hemos avisado a {{hosts}} de que aún no lo sabe.',
    companionsNotComing: 'Sus acompañantes tampoco vendrán.',
    companionsOnHold: 'Sus acompañantes quedan en espera hasta que usted decida.',
    stillWork: 'Si cambia de opinión, los botones de la invitación siguen funcionando.',
    coming:
      'Su respuesta es «Viene», así que no ha cambiado nada. Para cambiarla, abra su página con «Sí, allí estaré» en la invitación.',
    same: 'Su respuesta ya era «{{answer}}». No ha cambiado nada.',
    statusNotComing: 'No viene',
    statusNotSure: 'Por confirmar',
    closed:
      'El plazo para responder terminó el {{date}}. Si algo ha cambiado, contacte con quien organiza el evento.',
  },
} as const;

type Language = keyof typeof GUEST_WORDS;

const LOCALES: Record<Language, string> = { en: 'en-GB', es: 'es-ES' };

export const TAP_GROUP = 'WhatsApp answers in one tap (sc-46343)';

export const TAP_STATES = [
  { key: 'tapNotComing', name: 'A tap: Not coming, with companions' },
  { key: 'tapNotSure', name: 'A tap: Not sure yet' },
  { key: 'tapNeedsYou', name: 'A tap under a question that waits' },
  { key: 'tapFailed', name: 'A tap: the message failed' },
  { key: 'tapNoCredits', name: 'A tap: too few credits' },
  { key: 'tapStopped', name: 'A tap after stopping WhatsApp' },
  { key: 'tapComing', name: 'A Coming guest’s tap' },
  { key: 'tapComingNotSent', name: 'A Coming guest’s tap, too few credits' },
  { key: 'tapRepeat', name: 'A repeat tap, the first in 24 hours' },
  { key: 'tapRepeatAgain', name: 'A further repeat: no line' },
  { key: 'tapClosed', name: 'A tap after answers closed' },
] as const;

export type TapState = (typeof TAP_STATES)[number]['key'];

export function isTapState(key: string | null): key is TapState {
  return TAP_STATES.some((one) => one.key === key);
}

export type TapAnswer = 'notComing' | 'notSure';
export type Receipt = 'sent' | 'delivered' | 'read' | 'failed';
export type NotSent = 'credits' | 'stopped';
/** What the tap did: recorded the answer, or nothing, and why (pm, 'Decided, 13 Nov (pm, on ux's #46492)'). */
export type TapKind = 'recorded' | 'coming' | 'repeat' | 'closed';

export interface Tap {
  answer: TapAnswer;
  kind: TapKind;
  at: string;
  companions?: boolean;
  receipt?: Receipt;
  notSent?: NotSent;
}

export interface TapCase {
  id: 'kwame' | 'lucia';
  language: Language;
  done: boolean;
  taps: readonly Tap[];
  turn: Partial<SampleGuest>;
  extras?: readonly Extra[];
  blocks?: NoticeCase['blocks'];
}

export const TAPPED_AT = '08:20';
export const REPEAT_AT = '08:31';
export const DONE_AT = '21:30';
export const CLOSED_ON = '2026-11-02T12:00:00Z';

const KWAME: Pick<TapCase, 'id' | 'language' | 'done' | 'turn'> = {
  id: 'kwame',
  language: 'en',
  done: true,
  turn: { where: 'whatsApp', toldBy: 'whatsApp', canAlso: ['email', 'sms'] },
};

const LUCIA: Pick<TapCase, 'id' | 'language' | 'done' | 'turn'> = {
  id: 'lucia',
  language: 'es',
  done: false,
  turn: {},
};

const RECORDED_NOT_SURE: Tap = {
  answer: 'notSure',
  kind: 'recorded',
  at: TAPPED_AT,
  receipt: 'read',
};

const REPEATED: readonly Tap[] = [
  RECORDED_NOT_SURE,
  { answer: 'notSure', kind: 'repeat', at: REPEAT_AT, receipt: 'delivered' },
];

export function tapCaseOf(state: string | null): TapCase | null {
  const one = (tap: Omit<Tap, 'at'>): readonly Tap[] => [{ ...tap, at: TAPPED_AT }];

  switch (state) {
    case 'tapNotComing':
      return {
        ...KWAME,
        taps: one({ answer: 'notComing', kind: 'recorded', companions: true, receipt: 'read' }),
      };
    case 'tapNotSure':
      return { ...KWAME, taps: one({ answer: 'notSure', kind: 'recorded', receipt: 'delivered' }) };
    case 'tapNeedsYou':
      return {
        ...LUCIA,
        taps: one({ answer: 'notSure', kind: 'recorded', companions: true, receipt: 'sent' }),
      };
    case 'tapFailed':
      return { ...KWAME, taps: one({ answer: 'notComing', kind: 'recorded', receipt: 'failed' }) };
    case 'tapNoCredits':
      return { ...KWAME, taps: one({ answer: 'notComing', kind: 'recorded', notSent: 'credits' }) };
    case 'tapStopped':
      return {
        ...LUCIA,
        turn: { where: 'whatsApp' },
        extras: [{ kind: 'stopped', channel: 'whatsApp', at: '08:15' }],
        blocks: { whatsApp: 'stoppedWhatsApp' },
        taps: one({ answer: 'notComing', kind: 'recorded', notSent: 'stopped' }),
      };
    case 'tapComing':
      return { ...KWAME, taps: one({ answer: 'notComing', kind: 'coming', receipt: 'read' }) };
    case 'tapComingNotSent':
      return { ...KWAME, taps: one({ answer: 'notComing', kind: 'coming', notSent: 'credits' }) };
    case 'tapRepeat':
    case 'tapRepeatAgain':
      return { ...KWAME, taps: REPEATED };
    case 'tapClosed':
      return { ...KWAME, taps: one({ answer: 'notSure', kind: 'closed', receipt: 'delivered' }) };
    default:
      return null;
  }
}

/** The line in the host's language: one whole string per answer, the status word never the button's text (pm #46517). */
export function tapLine(tap: Tap, name: string): string {
  if (tap.kind === 'recorded')
    return tapw.filled(tap.answer === 'notComing' ? TAPW.answeredNotComing : TAPW.answeredNotSure, {
      name,
    });

  return tapw.filled(tap.answer === 'notComing' ? TAPW.tappedNotComing : TAPW.tappedNotSure, {
    name,
  });
}

/** Soirely's one message, line by line, in the guest's language; it says why nothing changed, so the line does not. */
export function tapMessage(tap: Tap, language: Language, hosts: string): readonly string[] {
  const words = GUEST_WORDS[language];
  const locale = LOCALES[language];
  const fill = demoWords(words).filled;

  switch (tap.kind) {
    case 'coming':
      return [words.coming];
    case 'repeat':
      return [
        fill(words.same, {
          answer: tap.answer === 'notComing' ? words.statusNotComing : words.statusNotSure,
        }),
      ];
    case 'closed':
      return [
        fill(words.closed, {
          date: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
            new Date(CLOSED_ON),
          ),
        }),
      ];
    default: {
      const joined = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
        hosts.split(' and '),
      );
      const notComing = tap.answer === 'notComing';

      return [
        fill(notComing ? words.notComing : words.notSure, { hosts: joined }),
        ...(tap.companions === true
          ? [notComing ? words.companionsNotComing : words.companionsOnHold]
          : []),
        words.stillWork,
      ];
    }
  }
}

const RECEIPT: Record<Receipt, { mark: Delivery; word: string }> = {
  sent: { mark: 'sent', word: MW.sent },
  delivered: { mark: 'delivered', word: MW.delivered },
  read: { mark: 'delivered', word: MW.read },
  failed: { mark: 'bounced', word: MW.failedReceipt },
};

export function receiptBit(receipt: Receipt): Bit {
  return { words: `${MW.whatsApp} · ${RECEIPT[receipt].word}`, mark: RECEIPT[receipt].mark };
}

/** Nothing went: the not-sent mark for credits, the opted-out mark for a guest who stopped WhatsApp. */
export function notSentBit(why: NotSent): Bit {
  return why === 'credits'
    ? { words: `${MW.notSent} · ${TAPW.tooFewCredits}`, mark: 'notsent' }
    : { words: `${MW.notSent} · ${MW.stoppedWhatsApp}`, mark: 'optout' };
}

/** The conversation's row after a tap: the latest line and its time; its section does not change. */
export function tapRow(kase: TapCase, name: string): { line: string; when: string } | null {
  const last = kase.taps.at(-1);

  return last == null ? null : { line: tapLine(last, name), when: last.at };
}
