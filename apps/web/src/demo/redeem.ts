import { callingCode, formatPhone } from '@soirely/domain';

import {
  BAR,
  DOOR_EVENT,
  DOOR_EVENT_ID,
  DOOR_ORG,
  EVENT_ENDS,
  clockOf,
  dayOf,
  normalCode,
} from './doorCode.ts';
import { meshFor } from '../mesh.ts';
import { numberLine, SAMPLE } from './rules.ts';
import type { DemoLink } from './settings.ts';

/** The browser's redeem pages, signed out (Access-A-Phone-Joining, page e28): words, the sample and the states. */
export const COUNTRY = 'PT';
export const CALLING = '+351';
export const MESH = meshFor(DOOR_EVENT_ID);
export const LIVE_CODE = BAR.code;
export const CODE_LENGTH = 8;
export const PHONE_CODE_LENGTH = 6;
export const TRIES_A_MINUTE = 10;
export const RESEND_FROM = 60;
export const DRAWN_RESEND = 54;
/** Ten tries at the briefing, 13:31 on the day, wait for the next minute. */
export const LIFTS_AT = '13:32';

export const R = {
  enterTitle: 'Enter a join code',
  joinCode: 'Join code',
  continue: 'Continue',
  codeBlank: 'Enter the join code.',
  codeShort: 'A join code is 8 letters and numbers.',
  refused: 'That code doesn’t work. Check it with whoever gave it to you.',
  tooMany: 'Too many tries',
  tryAt: (time: string) => `Try again at ${time}`,
  yourName: 'Your name',
  mobile: 'Mobile number',
  countryCode: 'Country code',
  sendCode: 'Send code',
  nameBlank: 'Enter your full name.',
  joinAs: (name: string) => `Join as ${name}`,
  signOut: 'Sign out',
  memberTitle: `You’re already a member of ${DOOR_ORG}`,
  memberLine: 'Members reach an event through its People. Ask its lead or an admin to add you.',
  openEvents: 'Open Events',
  checkWhatsApp: 'Check WhatsApp',
  sentWhatsApp: (number: string) => `We sent a code to your WhatsApp on ${number}.`,
  checkMessages: 'Check your messages',
  texted: (number: string) => `We texted a code to ${number}.`,
  codeLabel: 'Code, 6 digits',
  textInstead: 'Text it to me instead',
  sendNew: 'Send a new code',
  wrongWhatsApp:
    'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
  wrongText: 'That code does not match. Check the newest text from Soirely and try again.',
  expiredTitle: 'That code has expired',
  expiredBody: 'Codes only work for a while. Send a new one and use the code in the newest text.',
  exhaustedTitle: 'Too many wrong tries',
  exhaustedBody: 'That code no longer works. Send a new one to carry on.',
  failedTitle: 'That did not work',
  failedBody: 'Something went wrong on the way. Try again in a moment.',
  inTitle: `You’re in for ${DOOR_EVENT} · ${BAR.label ?? ''}`,
  endsLine: 'Access ends when the event concludes.',
  openEvent: 'Open the event',
  signedInAs: (name: string) => `Signed in as ${name}`,
  signedOutAt: `You’ll be signed out at ${clockOf(EVENT_ENDS)}.`,
  signedOut: 'Signed out.',
  eventLater: 'The event in the browser has its own design.',
  eventsLater: 'Events has its own design.',
} as const;

export const EVENT_LINE = [dayOf(EVENT_ENDS), DOOR_ORG, BAR.role, BAR.label].join(' · ');

export function sendNewIn(seconds: number): string {
  return `Send a new code in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The join code's check before anything is sent: any case, spaces and hyphens ignored (sc-72). */
export function joinCodeLine(typed: string): string | null {
  const code = normalCode(typed);
  if (code === '') return R.codeBlank;

  return code.length === CODE_LENGTH ? null : R.codeShort;
}

export interface EventLines {
  name?: string;
  number?: string;
}

export function eventLines(name: string, number: string, country = COUNTRY): EventLines {
  const lines: EventLines = {};
  const numberRefusal = numberLine(number, country, false);
  if (name.trim() === '') lines.name = R.nameBlank;
  if (numberRefusal != null) lines.number = numberRefusal;

  return lines;
}

/** "+351 912 345 412", as the app shows the number it sent to. */
export function shownNumber(typed: string, country = COUNTRY): string {
  return formatPhone(`${callingCode(country) ?? CALLING}${typed.replace(/\D/gu, '')}`);
}

export const rightPhoneCode = (digits: string) => digits === SAMPLE.code;

export type Via = 'whatsapp' | 'text';
export type CodeProblem = 'wrong' | 'expired' | 'exhausted' | 'failed';

export type Step =
  | {
      kind: 'enter';
      typed: string;
      line: 'blank' | 'short' | 'refused' | null;
      busy: Busy;
      signedOut: boolean;
    }
  | { kind: 'tooMany' }
  | { kind: 'event'; name: string; number: string; checked: boolean; busy: Busy; usedUp: boolean }
  | { kind: 'joinAs'; busy: Busy }
  | { kind: 'member' }
  | { kind: 'code'; via: Via; digits: string; problem: CodeProblem | null; resend: number }
  | { kind: 'in'; name: string };

/** `held`: a deep-linked wait, long enough to look at. */
export type Busy = 'no' | 'busy' | 'held';

export const REDEEM_STATES = [
  'browser-event',
  'enter',
  'enter-blank',
  'enter-short',
  'checking',
  'refused',
  'too-many',
  'event',
  'event-blank',
  'event-short',
  'sending',
  'join-as',
  'member',
  'code',
  'code-texted',
  'code-wrong',
  'code-expired',
  'code-exhausted',
  'code-failed',
  'used-up',
  'browser-in',
  'signed-out',
] as const;

export type RedeemState = (typeof REDEEM_STATES)[number];

export const JOAO = { name: 'João Pereira', number: '912 345 412' };
export const HUGO = { name: 'Hugo Faria', number: '913 222 908' };
export const KEMI = 'Kemi Okafor';

export function redeemStateOf(name: string | null): RedeemState {
  return REDEEM_STATES.find((one) => one === name) ?? 'enter';
}

const enter = (extra: Partial<Extract<Step, { kind: 'enter' }>> = {}): Step => ({
  kind: 'enter',
  typed: '',
  line: null,
  busy: 'no',
  signedOut: false,
  ...extra,
});

const event = (extra: Partial<Extract<Step, { kind: 'event' }>> = {}): Step => ({
  kind: 'event',
  ...JOAO,
  checked: false,
  busy: 'no',
  usedUp: false,
  ...extra,
});

const code = (extra: Partial<Extract<Step, { kind: 'code' }>> = {}): Step => ({
  kind: 'code',
  via: 'whatsapp',
  digits: '',
  problem: null,
  resend: DRAWN_RESEND,
  ...extra,
});

/** Who the person is on the phone code's steps, and in the browser: João typed, Hugo scanned. */
export function redeemStart(state: RedeemState): { step: Step; number: string; name: string } {
  const start = startOf(state);

  return start.step.kind === 'event'
    ? { ...start, name: start.step.name, number: start.step.number }
    : start;
}

function startOf(state: RedeemState): { step: Step; number: string; name: string } {
  const joao = { number: JOAO.number, name: JOAO.name };
  const hugo = { number: HUGO.number, name: HUGO.name };

  switch (state) {
    case 'browser-event':
      return { step: event(HUGO), ...hugo };
    case 'enter-blank':
      return { step: enter({ line: 'blank' }), ...joao };
    case 'enter-short':
      return { step: enter({ typed: 'Q7KM 4X', line: 'short' }), ...joao };
    case 'checking':
      return { step: enter({ typed: 'Q7KM 4XP2', busy: 'held' }), ...joao };
    case 'refused':
      return { step: enter({ typed: 'Q7KM 4XP3', line: 'refused' }), ...joao };
    case 'too-many':
      return { step: { kind: 'tooMany' }, ...joao };
    case 'event':
      return { step: event(), ...joao };
    case 'event-blank':
      return { step: event({ name: '', number: '', checked: true }), ...joao };
    case 'event-short':
      return { step: event({ number: '912 345', checked: true }), ...joao };
    case 'sending':
      return { step: event({ busy: 'held' }), ...joao };
    case 'join-as':
      return { step: { kind: 'joinAs', busy: 'no' }, name: KEMI, number: '' };
    case 'member':
      return { step: { kind: 'member' }, ...joao };
    case 'code':
      return { step: code({ digits: '71' }), ...joao };
    case 'code-texted':
      return { step: code({ via: 'text', digits: '71' }), ...joao };
    case 'code-wrong':
      return { step: code({ digits: '713908', problem: 'wrong' }), ...joao };
    case 'code-expired':
      return { step: code({ via: 'text', problem: 'expired', resend: 0 }), ...joao };
    case 'code-exhausted':
      return { step: code({ problem: 'exhausted', resend: 0 }), ...joao };
    case 'code-failed':
      return { step: code({ digits: '713908', problem: 'failed' }), ...joao };
    case 'used-up':
      return { step: event({ ...HUGO, usedUp: true }), ...hugo };
    case 'browser-in':
      return { step: { kind: 'in', name: HUGO.name }, ...hugo };
    case 'signed-out':
      return { step: enter({ signedOut: true }), ...joao };
    default:
      return { step: enter({ typed: 'Q7KM 4XP2' }), ...joao };
  }
}

/** A code typed at the redeem page: the live one opens its event, anything else is the one refusal (sc-72). */
export function codeOpens(typed: string): boolean {
  return normalCode(typed) === LIVE_CODE;
}

const redeem = (state: RedeemState, name: string): DemoLink => ({
  to: `/demo/redeem?state=${state}`,
  name,
});

export const REDEEM_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Joining · typing a code',
    states: [
      redeem('enter', 'Enter a join code'),
      redeem('enter-blank', 'Continue, left blank'),
      redeem('enter-short', 'Too short'),
      redeem('checking', 'Checking'),
      redeem('refused', 'Wrong, expired or stopped'),
      redeem('too-many', 'Ten tries in a minute'),
    ],
  },
  {
    name: 'Joining · the event, then a name',
    states: [
      redeem('browser-event', 'From the QR: the redeem page'),
      redeem('event', 'The event, then a name'),
      redeem('event-blank', 'Send code, left blank'),
      redeem('event-short', 'A number too short'),
      redeem('sending', 'Sending'),
      redeem('join-as', 'Already signed in'),
      redeem('member', 'Already a member'),
    ],
  },
  {
    name: 'Joining · the phone code',
    states: [
      redeem('code', 'Check WhatsApp'),
      redeem('code-texted', 'Texted instead'),
      redeem('code-wrong', 'A wrong code'),
      redeem('code-expired', 'An expired code'),
      redeem('code-exhausted', 'The phone code, tried too often'),
      redeem('code-failed', 'It did not go'),
      redeem('used-up', 'Used up'),
    ],
  },
  {
    name: 'Joining · in, and signed out',
    states: [redeem('browser-in', 'You’re in'), redeem('signed-out', 'Signed out')],
  },
];
