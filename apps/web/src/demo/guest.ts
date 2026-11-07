import { LOCALES, hostsLine } from '@soirely/domain';
import i18next from 'i18next';

import { type SampleEvent, sampleEvent } from './events.ts';
import type { DemoLink } from './settings.ts';

/** The guest's own page in A · The cover card (sc-31306), on the boards' sample: main's evt-wed-4 and one guest. */
export const EVENT: SampleEvent = sampleEvent('evt-wed-4') as SampleEvent;
export const GUEST = 'Maria Fernanda Albuquerque Santos';
export const COMPANIONS = 2;

export const TODAY = '2026-10-27';
export const EARLIER = '2026-10-20';
export const REPLY_BY = '2026-10-30';

/** The reader's zone is the browser's; the sample reads in London, and the zone state from São Paulo. */
export const READER_ZONE = 'Europe/London';
export const AWAY_ZONE = 'America/Sao_Paulo';

export const SEND_MS = 900;
export const HOLD_MS = 8000;

export const THANK_YOU =
  'Thank you for dancing with us, for the songs and for every kind word. Our day was better because you were in it.';

export interface Message {
  id: string;
  at: string;
  words: string;
}

export const MESSAGES: readonly Message[] = [
  {
    id: 'm-1',
    at: '2026-10-31T10:05:00Z',
    words:
      'We’re so glad you’re coming! The ceremony starts at 6:00 PM, so please be at The Landmark by 5:30 PM.',
  },
  {
    id: 'm-2',
    at: '2026-11-02T21:14:00Z',
    words: 'Parking is on Marylebone Road, and the dress code is formal.',
  },
  {
    id: 'm-3',
    at: '2026-11-03T08:30:00Z',
    words: 'If you have any questions before Thursday, write to us here.',
  },
];

export const MINE = 'Thank you! Is there a cloakroom at The Landmark?';
export const MINE_AT = '2026-11-03T09:41:00Z';

export type Answer = 'coming' | 'notComing' | 'notSure';
export const ANSWERS: readonly Answer[] = ['coming', 'notComing', 'notSure'];
export type Phase = 'live' | 'paused' | 'calledOff' | 'over' | 'finished';
export type Lang = 'en' | 'es' | 'fr' | 'pt';
export type Page = 'event' | 'gone' | 'unreachable' | 'loading';

export type View =
  | { kind: 'answer'; busy: Answer | null; note: 'unsent' | 'notSentTap' | null }
  | { kind: 'check'; busy: boolean; failed: boolean; refused: boolean; from: 'answer' | 'changing' }
  | { kind: 'recorded'; same: boolean }
  | { kind: 'changing'; busy: Answer | null }
  | { kind: 'closed' }
  | { kind: 'tellUs'; busy: boolean; result: 'failed' | 'limited' | 'thanks' | null; back: View };

export interface Mine {
  words: string;
  at: string;
  sent: boolean;
}

export interface Visit {
  page: Page;
  phase: Phase;
  started: boolean;
  replyBy: string | null;
  replyByPassed: boolean;
  recorded: { answer: Answer; on: string } | null;
  view: View;
  photo: boolean;
  lang: Lang;
  menuOpen: boolean;
  readerZone: string;
  messages: number;
  mine: readonly Mine[];
  draft: string;
  draftFailed: boolean;
  arrival: boolean;
  want: string | null;
  wantId: number;
}

export const OPEN: View = { kind: 'answer', busy: null, note: null };
const RECORDED: View = { kind: 'recorded', same: false };
const CLOSED: View = { kind: 'closed' };

const BASE: Visit = {
  page: 'event',
  phase: 'live',
  started: false,
  replyBy: REPLY_BY,
  replyByPassed: false,
  recorded: null,
  view: OPEN,
  photo: false,
  lang: 'en',
  menuOpen: false,
  readerZone: READER_ZONE,
  messages: 0,
  mine: [],
  draft: '',
  draftFailed: false,
  arrival: false,
  want: null,
  wantId: 0,
};

const COMING = { answer: 'coming', on: TODAY } as const;
const MESSAGED: Partial<Visit> = { recorded: COMING, view: RECORDED, messages: 3 };
const SENT_MINE: Mine = { words: MINE, at: MINE_AT, sent: true };

function check(extra: Partial<Extract<View, { kind: 'check' }>> = {}): View {
  return { kind: 'check', busy: false, failed: false, refused: false, from: 'answer', ...extra };
}

function tellUs(result: 'failed' | 'limited' | 'thanks' | null = null): View {
  return { kind: 'tellUs', busy: false, result, back: OPEN };
}

/** Every state the boards draw, with its `?state=` name, the board's title and what it starts as. */
const STATES = {
  open: { name: 'Not answered yet, with a date to answer by', starts: {} },
  openNoDate: { name: 'Not answered yet, no date to answer by', starts: { replyBy: null } },
  check: {
    name: 'Yes, I’ll be there, then Check and send',
    starts: { view: check(), want: 'checkHead' },
  },
  sending: {
    name: 'Sending Send my answer',
    starts: { view: check({ busy: true }), want: 'send' },
  },
  notSent: {
    name: 'A send that failed, on Check and send',
    starts: { view: check({ failed: true }), want: 'send' },
  },
  sendingTap: {
    name: 'Sending a one-tap answer',
    starts: { view: { kind: 'answer', busy: 'notComing', note: null }, want: 'row-notComing' },
  },
  notSentTap: {
    name: 'A one-tap answer that failed',
    starts: { view: { kind: 'answer', busy: null, note: 'notSentTap' }, want: 'row-notComing' },
  },
  coming: {
    name: 'Answered Coming',
    starts: { recorded: COMING, view: RECORDED, want: 'greeting' },
  },
  notComing: {
    name: 'Answered Not coming, in one tap',
    starts: { recorded: { answer: 'notComing', on: TODAY }, view: RECORDED, want: 'greeting' },
  },
  notSure: {
    name: 'Answered Not sure yet, with companions',
    starts: { recorded: { answer: 'notSure', on: TODAY }, view: RECORDED, want: 'greeting' },
  },
  changing: {
    name: 'Changing the answer',
    starts: {
      recorded: { answer: 'coming', on: EARLIER },
      view: { kind: 'changing', busy: null },
      want: 'newHead',
    },
  },
  sameAnswer: {
    name: 'The same answer sent again',
    starts: {
      recorded: { answer: 'coming', on: EARLIER },
      view: { kind: 'recorded', same: true },
      want: 'greeting',
    },
  },
  unsentReturn: {
    name: 'Back after leaving part-way',
    starts: { view: { kind: 'answer', busy: null, note: 'unsent' } },
  },
  replyByClosed: {
    name: 'After the date to answer by, Coming',
    starts: { replyByPassed: true, recorded: COMING, view: CLOSED },
  },
  replyByClosedNotSure: {
    name: 'After the date to answer by, Not sure yet',
    starts: { replyByPassed: true, recorded: { answer: 'notSure', on: TODAY }, view: CLOSED },
  },
  closedRefused: {
    name: 'Answers closed while sending (409)',
    starts: { replyByPassed: true, view: check({ refused: true }) },
  },
  closed: {
    name: 'Closed at the start, Coming',
    starts: { started: true, recorded: COMING, view: CLOSED },
  },
  closedNever: {
    name: 'Closed at the start, never answered',
    starts: { started: true, view: CLOSED },
  },
  paused: {
    name: 'Paused before the start, answered',
    starts: { phase: 'paused', recorded: COMING, view: CLOSED },
  },
  pausedNever: {
    name: 'Paused before the start, never answered',
    starts: { phase: 'paused', view: CLOSED },
  },
  pausedAfterStart: {
    name: 'Paused after the start',
    starts: { phase: 'paused', started: true, recorded: COMING, view: CLOSED },
  },
  zone: { name: 'A guest in another time zone', starts: { readerZone: AWAY_ZONE } },
  calledOff: {
    name: 'Called off',
    starts: { phase: 'calledOff', recorded: COMING, view: CLOSED },
  },
  over: {
    name: 'Over, with no thank-you',
    starts: { phase: 'over', started: true, recorded: COMING, view: CLOSED },
  },
  finished: {
    name: 'Over, with the hosts’ thank-you',
    starts: { phase: 'finished', started: true, recorded: COMING, view: CLOSED },
  },
  gone: { name: 'A link that does not work, or an event that is gone', starts: { page: 'gone' } },
  unreachable: { name: 'Cannot reach Soirely', starts: { page: 'unreachable', want: 'h1' } },
  loading: { name: 'Loading', starts: { page: 'loading' } },
  french: {
    name: 'In French, the language menu open',
    starts: { lang: 'fr', menuOpen: true },
  },
  photo: { name: 'An organiser’s cover photo', starts: { photo: true } },
  tellUs: {
    name: 'Not {full name}? Tell us',
    starts: { view: tellUs(), want: 'tellHead' },
  },
  tellUsFailed: {
    name: 'Tell them, failed',
    starts: { view: tellUs('failed'), want: 'tellThem' },
  },
  tellUsLimited: {
    name: 'Tell them, too many tries (429)',
    starts: { view: tellUs('limited'), want: 'tellThem' },
  },
  tellUsThanks: { name: 'Told the hosts', starts: { view: tellUs('thanks'), want: 'thanks' } },
  message: {
    name: 'A message from the hosts',
    starts: { ...MESSAGED, messages: 1 },
  },
  messages: { name: 'Several messages from the hosts', starts: MESSAGED },
  messageArrival: {
    name: 'Opened from the fixed notice',
    starts: { ...MESSAGED, arrival: true },
  },
  replyWriting: {
    name: 'Writing back, the keyboard up',
    starts: { ...MESSAGED, draft: MINE, want: 'box' },
  },
  replySending: {
    name: 'Sending a message',
    starts: { ...MESSAGED, mine: [{ words: MINE, at: MINE_AT, sent: false }] },
  },
  replySent: { name: 'A message sent', starts: { ...MESSAGED, mine: [SENT_MINE] } },
  replyFailed: {
    name: 'A message that failed',
    starts: { ...MESSAGED, draft: MINE, draftFailed: true, want: 'sendMessage' },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestStateName = keyof typeof STATES;

export function isGuestState(value: string | null): value is GuestStateName {
  return value != null && Object.hasOwn(STATES, value);
}

export function startOf(value: string | null): Visit {
  const state = isGuestState(value) ? value : 'open';

  return { ...BASE, ...(STATES[state].starts as Partial<Visit>) };
}

export function stateName(state: GuestStateName): string {
  return STATES[state].name;
}

function link(state: GuestStateName): DemoLink {
  const fragment = state === 'messageArrival' ? `#${MESSAGES.at(-1)?.id ?? ''}` : '';

  return { to: `/demo/guest?state=${state}${fragment}`, name: STATES[state].name };
}

export const GUEST_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Answering',
    states: (
      [
        'open',
        'openNoDate',
        'check',
        'sending',
        'notSent',
        'sendingTap',
        'notSentTap',
        'coming',
        'notComing',
        'notSure',
        'changing',
      ] as const
    ).map(link),
  },
  {
    name: 'Coming back, and answers closing',
    states: (
      [
        'sameAnswer',
        'unsentReturn',
        'replyByClosed',
        'replyByClosedNotSure',
        'closedRefused',
        'closed',
        'closedNever',
        'paused',
        'pausedNever',
        'pausedAfterStart',
        'zone',
      ] as const
    ).map(link),
  },
  {
    name: 'Over, gone, and the rest',
    states: (
      [
        'calledOff',
        'over',
        'finished',
        'gone',
        'unreachable',
        'loading',
        'french',
        'photo',
        'tellUs',
        'tellUsFailed',
        'tellUsLimited',
        'tellUsThanks',
      ] as const
    ).map(link),
  },
  {
    name: 'The hosts’ messages and the guest’s own',
    states: (
      [
        'message',
        'messages',
        'messageArrival',
        'replyWriting',
        'replySending',
        'replySent',
        'replyFailed',
      ] as const
    ).map(link),
  },
];

export function shows(visit: Visit): { details: boolean; foot: boolean; hosts: boolean } {
  const alone = visit.view.kind === 'check' || visit.view.kind === 'tellUs';

  return { details: !alone, foot: !alone, hosts: visit.phase !== 'calledOff' };
}

/** The door code and Add to calendar: for Coming, while there is still something to attend (pm, 7 Nov). */
export function forTheDay(visit: Visit): boolean {
  const { view, recorded, phase } = visit;

  return (
    recorded?.answer === 'coming' &&
    phase === 'live' &&
    (view.kind === 'recorded' || view.kind === 'closed')
  );
}

export function showsMessages(visit: Visit): boolean {
  return (
    visit.messages > 0 &&
    (visit.view.kind === 'answer' || visit.view.kind === 'recorded' || visit.view.kind === 'closed')
  );
}

export type Layout = 'small' | 'phone' | 'upright' | 'side' | 'desk';

/** The widths the boards measure at: 320 under 22.5rem, 402 to 40rem, 834 to 64rem, 1194 to 80rem, 1280 from it. */
export function layoutOf(matches: {
  small: boolean;
  phone: boolean;
  wide: boolean;
  desk: boolean;
}): Layout {
  if (matches.desk) return 'desk';
  if (matches.wide) return 'side';
  if (matches.small) return 'small';

  return matches.phone ? 'phone' : 'upright';
}

export const LAYOUT_MEDIA = {
  small: '(width < 22.5rem)',
  phone: '(width <= 40rem)',
  wide: '(width >= 64rem)',
  desk: '(width >= 80rem)',
} as const;

export function twoColumns(layout: Layout): boolean {
  return layout === 'side' || layout === 'desk';
}

const TAGS: Record<Lang, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' };

export function tagOf(lang: Lang): string {
  return TAGS[lang];
}

function format(at: string | Date, lang: Lang, zone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(TAGS[lang], { timeZone: zone, ...options }).format(
    typeof at === 'string' ? new Date(at) : at,
  );
}

export function dayOf(day: string, lang: Lang): string {
  return format(`${day}T12:00:00Z`, lang, 'UTC', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function eventDay(lang: Lang): string {
  return format(EVENT.startsAt, lang, EVENT.timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function eventTime(lang: Lang): string {
  return format(EVENT.startsAt, lang, EVENT.timeZone, { hour: 'numeric', minute: '2-digit' });
}

export function shortDay(at: string, lang: Lang, zone: string): string {
  return format(at, lang, zone, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function timeIn(at: string, lang: Lang, zone: string): string {
  return format(at, lang, zone, { hour: 'numeric', minute: '2-digit' });
}

export function sentWhen(at: string, lang: Lang, zone: string): string {
  return `${shortDay(at, lang, zone)} · ${timeIn(at, lang, zone)}`;
}

export function hostsOf(lang: Lang): string {
  return hostsLine(EVENT.hosts, TAGS[lang]);
}

export const LANGUAGES: readonly { code: Lang; name: string }[] = LOCALES.map((one) => ({
  code: one.code as Lang,
  name: one.nativeName,
}));

export function mapsLink(): string {
  const query = [EVENT.venue?.name, EVENT.venue?.address].filter(Boolean).join(', ');

  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

/** French as the board writes it where fr.json holds English: #5535's settled words and [bracketed] proposals. */
const BOARD_FRENCH: Readonly<Record<string, string>> = {
  'guestPage.yourAnswer': '[Votre réponse]',
  'guestPage.replyBy':
    '[Merci de répondre avant le {{date}}. Vous pourrez modifier votre réponse d’ici là.]',
  'guestPage.yes': '[Oui, je serai là]',
  'guestPage.no': '[Je ne pourrai pas venir]',
  'guestPage.maybe': '[Je ne sais pas encore]',
  'guestPage.closing':
    'Cette invitation est pour vous et votre famille. Les autres invités ne voient pas votre réponse.',
  'guestPage.tell': 'Vous n’êtes pas {{name}} ? Dites-le-nous',
};

export const LEGAL: Record<Lang, { terms: string; privacy: string }> = {
  en: { terms: 'Terms', privacy: 'Privacy' },
  es: { terms: 'Terms', privacy: 'Privacy' },
  fr: { terms: '[Conditions]', privacy: '[Confidentialité]' },
  pt: { terms: 'Terms', privacy: 'Privacy' },
};

type Slots = Record<string, string | number>;

export function wordsFor(lang: Lang) {
  const fixed = i18next.getFixedT(lang);
  const t = (key: string, slots: Slots = {}): string => {
    const french = lang === 'fr' ? BOARD_FRENCH[key] : undefined;

    return french == null
      ? fixed(key, slots)
      : french.replaceAll(/\{\{(\w+)\}\}/gu, (whole, slot: string) => String(slots[slot] ?? whole));
  };
  const hosts = hostsOf(lang);
  const count = EVENT.hosts.length;
  const answerWord = (answer: Answer): string =>
    ({
      coming: t('guestPage.coming'),
      notComing: t('guestPage.notComing'),
      notSure: t('guestPage.notSure'),
    })[answer];

  return {
    hosts,
    invited: t('guest.invitationTitle'),
    gone: t('guest.invalidTitle'),
    // The stories reword two of main's keys (sc-28008, sc-1439); l10n changes the catalogues, so English is written here.
    goneBody:
      lang === 'en'
        ? 'It may have expired, been replaced by a newer one, or been mistyped. If you think it should work, ask whoever invited you.'
        : t('guest.invalidBody'),
    noAccount: lang === 'en' ? 'You do not need an account to answer.' : t('guest.noAccountNeeded'),
    hostedBy: t('eventHosts.heading'),
    openInMaps: t('eventPage.openInMaps'),
    unreachable: t('session.unreachableTitle'),
    unreachableBody: t('session.unreachableBodySignedOut'),
    retry: t('error.retry'),
    retrying: t('session.retrying'),
    loading: t('pending.loading'),
    copyright: t('auth.copyright', { year: 2026 }),
    languageLabel: t('language.label'),
    languageCurrent: (language: string) => t('language.current', { language }),
    timeInZone: (time: string, timeZone: string) => t('calendar.timeInZone', { time, timeZone }),
    sending: t('recovery.sending'),
    paused: t('events.paused'),
    finished: t('events.finished'),
    calledOff: t('guestPage.calledOff'),
    pausedNotice: t('guestPage.pausedNotice'),
    pausedReason: t('guestPage.pausedReason'),
    calledOffNotice: t('guestPage.calledOffNotice'),
    finishedNotice: t('guestPage.finishedNotice'),
    yourAnswer: t('guestPage.yourAnswer'),
    replyBy: (date: string) => t('guestPage.replyBy', { date }),
    choice: (answer: Answer): string =>
      ({
        coming: t('guestPage.yes'),
        notComing: t('guestPage.no'),
        notSure: t('guestPage.maybe'),
      })[answer],
    answerWord,
    answered: (answer: Answer, date: string) =>
      t('guestPage.answered', { answer: answerWord(answer), date }),
    greeting: (answer: Answer): string =>
      ({
        coming: t('guestPage.greetComing', { name: GUEST }),
        notComing: t('guestPage.greetNotComing', { name: GUEST }),
        notSure: t('guestPage.greetNotSure', { name: GUEST }),
      })[answer],
    companions: t('guestPage.companionsOnHold'),
    change: t('guestPage.change'),
    newAnswer: t('guestPage.newAnswer'),
    answerNow: t('guestPage.answerNow'),
    keep: t('guestPage.keep'),
    back: t('guestPage.back'),
    check: t('guestPage.check'),
    answerLine: (answer: Answer) => t('guestPage.answerLine', { answer: answerWord(answer) }),
    changeShort: t('guestPage.changeShort'),
    send: t('guestPage.send'),
    nothingSent: t('guestPage.nothingSent'),
    notSent: t('guestPage.notSent'),
    notSentTap: t('guestPage.notSentTap'),
    same: (answer: Answer) => t('guestPage.same', { answer: answerWord(answer) }),
    unsent: t('guestPage.unsent'),
    closedBy: (date: string) => t('guestPage.closedBy', { date }),
    closedByNotSure: (date: string) => t('guestPage.closedByNotSure', { date }),
    kitchen: t('guestPage.kitchen'),
    refused: t('guestPage.refused'),
    closed: t('guestPage.closed'),
    didNotAnswer: t('guestPage.didNotAnswer'),
    closing: t('guestPage.closing'),
    tell: t('guestPage.tell', { name: GUEST }),
    tellQuestion: t('guestPage.tellQuestion', { hosts }),
    tellLine: t('guestPage.tellLine', { name: GUEST, count }),
    tellThem: t('guestPage.tellThem'),
    goBack: t('guestPage.goBack'),
    tellFailed: t('guestPage.tellFailed'),
    tellLimited: t('guestPage.tellLimited'),
    tellThanks: t('guestPage.tellThanks', { hosts, count }),
    doorTitle: t('guestPage.doorTitle'),
    doorLine: t('guestPage.doorLine'),
    doorCode: t('guestPage.doorCode'),
    calendarTitle: t('guestPage.calendarTitle'),
    calendarLine: t('guestPage.calendarLine'),
    calendarApple: t('guestPage.calendarApple'),
    calendarGoogle: t('guestPage.calendarGoogle'),
    messages: t('guestPage.messages'),
    writeTo: t('guestPage.writeTo', { hosts }),
    sendMessage: t('guestPage.sendMessage'),
    sent: t('guestPage.sent'),
    messageFailed: t('guestPage.messageFailed'),
  };
}

export type Words = ReturnType<typeof wordsFor>;

function mulberry(seed: number): () => number {
  let a = seed;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A placeholder pattern in the shape of a code, never a real one (the boards' sample). */
export function codePath(size = 25, seed = 1301): string {
  const next = mulberry(seed);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => next() < 0.5));
  const finder = (top: number, left: number) => {
    for (let r = -1; r < 8; r += 1) {
      for (let c = -1; c < 8; c += 1) {
        const row = grid[top + r];
        if (row == null || left + c < 0 || left + c >= size) continue;
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        row[left + c] = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (edge || core);
      }
    }
  };

  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  return grid
    .flatMap((row, r) => row.map((on, c) => (on ? `M${c + 2} ${r + 2}h1v1h-1z` : '')))
    .join('');
}
