import { LOCALES, hostsLine } from '@soirely/domain';
import i18next from 'i18next';

import { writtenTime } from './clock.ts';
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
/** A guest's message holds at most 1,000 characters, counted from 900 (pm, 7 Nov 2026). */
export const MESSAGE_MOST = 1000;
export const MESSAGE_COUNT_FROM = 900;
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
      'We’re so glad you’re coming! The ceremony starts at 18:00, so please be at The Landmark by 17:30.',
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

export const LONG_MESSAGE =
  'Thank you so much for the invitation, and congratulations to you both! We are travelling ' +
  'from Lisbon on Wednesday and land at Heathrow at about two in the afternoon, so we ' +
  'should reach The Landmark in good time. My mother is coming with us and uses a ' +
  'wheelchair, so I wanted to ask a few things before Thursday. Is there step-free access ' +
  'to the ceremony room, and is there a lift between the floors? Could my mother sit near ' +
  'the front, at the end of a row, to see you both and to leave easily if needed? Is there ' +
  'a quiet room for a short rest between the ceremony and the dinner? My mother also eats ' +
  'no gluten; I have added it to what the kitchen should know, but I wanted you to hear it ' +
  'from us too. My brother would love to bring a guitar for the party afterwards, if that ' +
  'would be welcome, and would only play if you would like it. We are so happy to be part ' +
  'of your day, and we cannot wait to celebrate with you both in London. Thank you again ' +
  'for all of that. With love from all three of us, and see you very soon at The Landmark, ' +
  'Maria.';

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
  companionsComing: number;
  view: View;
  photo: boolean;
  lang: Lang;
  menuOpen: boolean;
  readerZone: string;
  messages: number;
  mine: readonly Mine[];
  draft: string;
  draftFailed: boolean;
  draftTried: boolean;
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
  companionsComing: COMPANIONS,
  view: OPEN,
  photo: false,
  lang: 'en',
  menuOpen: false,
  readerZone: READER_ZONE,
  messages: 0,
  mine: [],
  draft: '',
  draftFailed: false,
  draftTried: false,
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
  comingAlone: {
    name: 'Answered Coming, no companion coming',
    starts: { recorded: COMING, view: RECORDED, companionsComing: 0, want: 'greeting' },
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
  overNever: {
    name: 'Over, never answered',
    starts: { phase: 'over', started: true, view: CLOSED },
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
  messageLong: {
    name: 'A long message, the count showing',
    starts: { ...MESSAGED, draft: LONG_MESSAGE.slice(0, 950), want: 'box' },
  },
  messageTooLong: {
    name: 'A message over 1,000 characters',
    starts: { ...MESSAGED, draft: LONG_MESSAGE, draftTried: true, want: 'box' },
  },
  calledOffMessages: {
    name: 'Called off, with the hosts’ messages',
    starts: { phase: 'calledOff', recorded: COMING, view: CLOSED, messages: 3 },
  },
  finishedMessages: {
    name: 'Over, with the thank-you and the hosts’ messages',
    starts: { phase: 'finished', started: true, recorded: COMING, view: CLOSED, messages: 3 },
  },
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
        'comingAlone',
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
        'overNever',
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
        'messageLong',
        'messageTooLong',
        'replySending',
        'replySent',
        'replyFailed',
        'calledOffMessages',
        'finishedMessages',
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
  return writtenTime(EVENT.startsAt, TAGS[lang], EVENT.timeZone);
}

export function shortDay(at: string, lang: Lang, zone: string): string {
  return format(at, lang, zone, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function timeIn(at: string, lang: Lang, zone: string): string {
  return writtenTime(at, TAGS[lang], zone);
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

/** The board's English, held in the demo until the product's screen puts it in the four catalogues (SHARED.md, Step three). */
const BOARD_ENGLISH = {
  yourAnswer: 'Your answer',
  replyBy: 'Please answer by {{date}}. You can change your answer any time before then.',
  yes: 'Yes, I’ll be there',
  no: 'Sorry, I can’t',
  maybe: 'I’m not sure yet',
  coming: 'Coming',
  notComing: 'Not coming',
  notSure: 'Not sure yet',
  answered: 'You answered {{answer}} on {{date}}.',
  greetComing: 'See you there, {{name}}.',
  greetNotComing: 'We’ll miss you, {{name}}.',
  greetNotSure: 'Thanks for letting us know, {{name}}.',
  companionsOnHold: 'Your companions are on hold until you decide.',
  change: 'Change my answer',
  newAnswer: 'Your new answer',
  answerNow: 'Your answer now',
  keep: 'Keep my answer',
  back: 'Back',
  check: 'Check and send',
  answerLine: 'Your answer: {{answer}}',
  changeShort: 'Change',
  send: 'Send my answer',
  nothingSent: 'Nothing is sent until you press Send my answer.',
  notSent: 'Your answer wasn’t sent. Everything you chose is still here. Try again.',
  notSentTap: 'Your answer wasn’t sent. Check your connection and tap it again.',
  same: 'You’re already down as {{answer}}. Nothing has changed.',
  unsent: 'You haven’t sent your answer yet.',
  closedBy: 'Answers closed on {{date}}. Contact your host if something has changed.',
  closedByNotSure: 'Answers closed on {{date}}. Contact your host if you can still come.',
  kitchen: 'Update what the kitchen should know',
  refused: 'Answers closed before this was sent. Everything you chose is still here.',
  closed: 'Answers have closed. Contact your host if something has changed.',
  didNotAnswer: 'You didn’t answer.',
  pausedNotice:
    'This event is paused. Answers are closed. Nothing you sent has been lost, and this page will update if the event resumes.',
  pausedReason: 'Answers are closed while the event is paused. Anything you sent is kept.',
  calledOff: 'Called off',
  calledOffNotice:
    'This event has been called off. It will not go ahead. There is nothing you need to do.',
  finishedNotice: 'This event has taken place. This page stays here as a keepsake.',
  noAccount: 'You do not need an account to answer.',
  goneBody:
    'It may have expired, been replaced by a newer one, or been mistyped. If you think it should work, ask whoever invited you.',
  closing: 'This invitation is for you and your family. Other guests cannot see your answer.',
  tell: 'Not {{name}}? Tell us',
  tellQuestion: 'Tell {{hosts}} this link reached the wrong person?',
  tellLine:
    'They will see a note on {{name}}’s invitation and can send a new link. This does not answer the invitation or change anything on it.',
  tellThem: 'Tell them',
  goBack: 'Go back',
  tellFailed: 'Not sent. Check your connection and try again.',
  tellLimited: 'Too many tries from this link. Try again later.',
  tellThanksOne:
    'Thank you. {{hosts}} has been told and will look into it. You can close this page.',
  tellThanksOther:
    'Thank you. {{hosts}} have been told and will look into it. You can close this page.',
  doorTitle: 'Show this at the door',
  doorLine: 'It lets you and your companions in. A screenshot works too.',
  doorLineAlone: 'A screenshot works too.',
  doorCode: 'Your code for the door. It holds no name.',
  calendarTitle: 'Add to calendar',
  calendarLine: 'Your calendar updates by itself if the date, time or place changes.',
  calendarApple: 'Apple / Outlook',
  calendarGoogle: 'Google Calendar',
  messages: 'Messages',
  writeTo: 'Write to {{hosts}}',
  sendMessage: 'Send',
  sent: 'Sent',
  messageFailed: 'Your message wasn’t sent. Your words are still here. Try again.',
  messageCount: '{{count}} of {{most}} characters',
  messageTooLong: 'Shorten your message to {{most}} characters or fewer.',
} as const;

type BoardKey = keyof typeof BOARD_ENGLISH;

/** French as the board writes it: #5535's settled words, and [bracketed] proposals l10n has not settled. */
const BOARD_FRENCH: Partial<Record<BoardKey, string>> = {
  yourAnswer: '[Votre réponse]',
  replyBy: '[Merci de répondre avant le {{date}}. Vous pourrez modifier votre réponse d’ici là.]',
  yes: '[Oui, je serai là]',
  no: '[Je ne pourrai pas venir]',
  maybe: '[Je ne sais pas encore]',
  closing:
    'Cette invitation est pour vous et votre famille. Les autres invités ne voient pas votre réponse.',
  tell: 'Vous n’êtes pas {{name}} ? Dites-le-nous',
};

export const LEGAL: Record<Lang, { terms: string; privacy: string }> = {
  en: { terms: 'Terms', privacy: 'Privacy' },
  es: { terms: 'Terms', privacy: 'Privacy' },
  fr: { terms: '[Conditions]', privacy: '[Confidentialité]' },
  pt: { terms: 'Terms', privacy: 'Privacy' },
};

type Slots = Record<string, string | number>;

export function wordsFor(lang: Lang) {
  const t = i18next.getFixedT(lang);
  const numbers = new Intl.NumberFormat(TAGS[lang]);
  const board = (key: BoardKey, slots: Slots = {}): string =>
    ((lang === 'fr' ? BOARD_FRENCH[key] : undefined) ?? BOARD_ENGLISH[key]).replaceAll(
      /\{\{(\w+)\}\}/gu,
      (whole, slot: string) => {
        const value = slots[slot];

        return value == null ? whole : typeof value === 'number' ? numbers.format(value) : value;
      },
    );
  const hosts = hostsOf(lang);
  const one = new Intl.PluralRules('en').select(EVENT.hosts.length) === 'one';
  const answerWord = (answer: Answer): string => board(answer);
  const english = lang === 'en';

  return {
    hosts,
    invited: t('guest.invitationTitle'),
    gone: t('guest.invalidTitle'),
    goneBody: english ? board('goneBody') : t('guest.invalidBody'),
    noAccount: english ? board('noAccount') : t('guest.noAccountNeeded'),
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
    calledOff: board('calledOff'),
    pausedNotice: board('pausedNotice'),
    pausedReason: board('pausedReason'),
    calledOffNotice: board('calledOffNotice'),
    finishedNotice: board('finishedNotice'),
    yourAnswer: board('yourAnswer'),
    replyBy: (date: string) => board('replyBy', { date }),
    choice: (answer: Answer): string =>
      board(({ coming: 'yes', notComing: 'no', notSure: 'maybe' } as const)[answer]),
    answerWord,
    answered: (answer: Answer, date: string) =>
      board('answered', { answer: answerWord(answer), date }),
    greeting: (answer: Answer): string =>
      board(
        (
          {
            coming: 'greetComing',
            notComing: 'greetNotComing',
            notSure: 'greetNotSure',
          } as const
        )[answer],
        { name: GUEST },
      ),
    companions: board('companionsOnHold'),
    change: board('change'),
    newAnswer: board('newAnswer'),
    answerNow: board('answerNow'),
    keep: board('keep'),
    back: board('back'),
    check: board('check'),
    answerLine: (answer: Answer) => board('answerLine', { answer: answerWord(answer) }),
    changeShort: board('changeShort'),
    send: board('send'),
    nothingSent: board('nothingSent'),
    notSent: board('notSent'),
    notSentTap: board('notSentTap'),
    same: (answer: Answer) => board('same', { answer: answerWord(answer) }),
    unsent: board('unsent'),
    closedBy: (date: string) => board('closedBy', { date }),
    closedByNotSure: (date: string) => board('closedByNotSure', { date }),
    kitchen: board('kitchen'),
    refused: board('refused'),
    closed: board('closed'),
    didNotAnswer: board('didNotAnswer'),
    closing: board('closing'),
    tell: board('tell', { name: GUEST }),
    tellQuestion: board('tellQuestion', { hosts }),
    tellLine: board('tellLine', { name: GUEST }),
    tellThem: board('tellThem'),
    goBack: board('goBack'),
    tellFailed: board('tellFailed'),
    tellLimited: board('tellLimited'),
    tellThanks: board(one ? 'tellThanksOne' : 'tellThanksOther', { hosts }),
    doorTitle: board('doorTitle'),
    doorLine: (companionsComing: number) =>
      board(companionsComing > 0 ? 'doorLine' : 'doorLineAlone'),
    doorCode: board('doorCode'),
    calendarTitle: board('calendarTitle'),
    calendarLine: board('calendarLine'),
    calendarApple: board('calendarApple'),
    calendarGoogle: board('calendarGoogle'),
    messages: board('messages'),
    writeTo: board('writeTo', { hosts }),
    sendMessage: board('sendMessage'),
    messageCount: (count: number) => board('messageCount', { count, most: MESSAGE_MOST }),
    messageTooLong: board('messageTooLong', { most: MESSAGE_MOST }),
    sent: board('sent'),
    messageFailed: board('messageFailed'),
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

export function characters(words: string): number {
  return Array.from(words).length;
}
