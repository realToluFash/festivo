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
import { LINKED, type Provider } from './providerOnly.ts';
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
  enterTitle: 'Enter a door code',
  joinCode: 'Door code',
  continue: 'Continue',
  codeBlank: 'Enter the door code.',
  codeShort: 'A door code is 8 letters and numbers.',
  refused: 'That code does not work. Check it with whoever gave it to you.',
  tooMany: 'Too many tries',
  tryAt: (time: string) => `Try again at ${clockOf(time)}`,
  yourName: 'Your name',
  mobile: 'Mobile number',
  countryCode: 'Country code',
  sendCode: 'Send code',
  nameBlank: 'Enter your full name.',
  join: 'Join',
  joining: 'Joining…',
  joinAs: (name: string) => `Join as ${name}`,
  signOut: 'Sign out',
  memberTitle: `You are already a member of ${DOOR_ORG}`,
  memberLine: 'Members open an event from its People page. Ask its lead or an admin to add you.',
  openEvents: 'Open Events',
  checkWhatsApp: 'Check WhatsApp',
  sentWhatsApp: (number: string) => `We sent a code to your WhatsApp on ${number}.`,
  checkMessages: 'Check your messages',
  texted: (number: string) => `We texted a code to ${number}.`,
  codeFromWhatsApp: 'Code from WhatsApp',
  codeFromText: 'Code from the text',
  codeBlankWhatsApp: 'Enter the 6-digit code from WhatsApp.',
  codeBlankText: 'Enter the 6-digit code from the text.',
  codeShortPhone: 'The code is 6 digits.',
  verify: 'Verify',
  verifying: 'Verifying…',
  textInstead: 'Text it to me instead',
  sendNew: 'Send a new code',
  wrongWhatsApp:
    'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
  wrongText: 'That code does not match. Check the newest text from Soirely and try again.',
  expiredTitle: 'That code has expired',
  expiredBody: 'Codes only work for a while. Send a new one and use the code in the newest text.',
  expiredBodyWhatsApp:
    'Codes only work for a while. Send a new one and use the code in the newest WhatsApp message.',
  exhaustedTitle: 'Too many wrong tries',
  exhaustedBody: 'That code no longer works. Send a new one to carry on.',
  failedTitle: 'That did not work',
  failedBody: 'Something went wrong on the way. Try again in a moment.',
  inTitle: `You’re in for ${DOOR_EVENT} · ${BAR.label ?? ''}`,
  endsLine: 'Your access ends when the event does.',
  openEvent: 'Open the event',
  checkIn: 'Check-in',
  signedInAs: (name: string) => `Signed in as ${name}`,
  signedOutAt: `You’ll be signed out at ${clockOf(EVENT_ENDS)}.`,
  signedOut: 'Signed out.',
  secondNumber:
    'This is an alternative number on a Soirely account, so it cannot sign you in. Enter that account’s primary number, or make this one primary.',
  eventLater: 'The event in the browser has its own design.',
  eventsLater: 'Events has its own design.',
} as const;

export const EVENT_LINE = [dayOf(EVENT_ENDS), DOOR_ORG, BAR.role, BAR.label].join(' · ');

export function sendNewIn(seconds: number): string {
  return `Send a new code in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The door code's check before anything is sent: any case, spaces and hyphens ignored (sc-72). */
export function joinCodeLine(typed: string): string | null {
  const code = normalCode(typed);
  if (code === '') return R.codeBlank;

  return code.length === CODE_LENGTH ? null : R.codeShort;
}

export function nameLine(name: string): string | null {
  return name.trim() === '' ? R.nameBlank : null;
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

export function phoneCodeLine(digits: string): 'blank' | 'short' | null {
  if (digits === '') return 'blank';

  return digits.length < PHONE_CODE_LENGTH ? 'short' : null;
}

/** A dead code (expired, or too many wrong tries) has no field: only Send a new code. */
export const deadCode = (problem: CodeProblem | null) =>
  problem === 'expired' || problem === 'exhausted';

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
  | {
      kind: 'event';
      name: string;
      number: string;
      checked: boolean;
      busy: Busy;
      usedUp: boolean;
      /** After the right phone code, the number is a verified alternative on an account (sc-4235). */
      secondNumber?: boolean;
    }
  | { kind: 'named'; checked: boolean; busy: Busy; usedUp: boolean }
  | { kind: 'joinAs'; busy: Busy }
  | { kind: 'member' }
  | {
      kind: 'code';
      via: Via;
      digits: string;
      problem: CodeProblem | null;
      line: 'blank' | 'short' | null;
      resend: number;
      busy: Busy;
      wrongs: number;
    }
  | { kind: 'in'; name: string; checks: boolean; held: boolean }
  /** After the right phone code, the number's account is a member of an organisation that signs in with Google or Apple only (sc-94849). */
  | { kind: 'providerOnly'; providers: readonly Provider[]; busy: Busy };

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
  'browser-name',
  'name',
  'name-blank',
  'joining',
  'name-used-up',
  'event',
  'event-blank',
  'event-short',
  'sending',
  'join-as',
  'join-as-long',
  'join-as-longest',
  'member',
  'code',
  'code-texted',
  'code-wrong',
  'code-expired',
  'code-expired-whatsapp',
  'code-exhausted',
  'code-failed',
  'used-up',
  'code-second-number',
  'second-number',
  'code-provider-only',
  'code-provider-only-apple',
  'code-provider-only-both',
  'provider-only',
  'provider-only-apple',
  'provider-only-both',
  'browser-in',
  'browser-in-view',
  'browser-in-account',
  'from-check-in',
  'signed-out',
] as const;

export type RedeemState = (typeof REDEEM_STATES)[number];

export const JOAO = { name: 'João Pereira', number: '912 345 412' };
export const HUGO = { name: 'Hugo Faria', number: '913 222 908' };
export const KEMI = 'Kemi Okafor';
/** Sixty characters, kept whole: the pill grows a line at a time (sc-72, #89576). */
export const LONG_NAME = 'Maria Fernanda Albuquerque de Vasconcelos Pereira dos Santos';
/** The account's 180-character limit: three lines, then an ellipsis. */
export const LONGEST_NAME =
  'Maria Fernanda Albuquerque de Vasconcelos Pereira dos Santos Carvalho Bettencourt Magalhães e Sá Rodrigues Figueiredo de Mascarenhas Sampaio Teixeira Lopes Brandão Cunha Ribeiro Sá';
/** A verified alternative on another account: the right code signs it into nothing (sc-4235). */
export const RITA = { name: 'Rita Sousa', number: '916 480 233' };

export const isSecondNumber = (typed: string) =>
  typed.replace(/\D/gu, '') === RITA.number.replace(/\D/gu, '');

/** A member of Ìrè Events, Google linked: what she types is hers until the right code, then forgotten (sc-94849). */
export const BISI = { typed: 'Bisi', account: 'Bisi Adeyemi', number: '915 604 117' };

export const isProviderOnly = (typed: string) =>
  typed.replace(/\D/gu, '') === BISI.number.replace(/\D/gu, '');

/** The providers a provider-only state draws, or Google alone for her number typed on the event. */
export function linkedFor(state: RedeemState): readonly Provider[] {
  if (state.endsWith('-apple')) return LINKED.apple;

  return state.endsWith('-both') ? LINKED.both : LINKED.google;
}

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

const named = (extra: Partial<Extract<Step, { kind: 'named' }>> = {}): Step => ({
  kind: 'named',
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
  line: null,
  resend: DRAWN_RESEND,
  busy: 'no',
  wrongs: 0,
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
    case 'browser-name':
      return { step: named(), ...hugo, name: '' };
    case 'name':
      return { step: named(), ...joao };
    case 'name-blank':
      return { step: named({ checked: true }), ...joao, name: '' };
    case 'joining':
      return { step: named({ busy: 'held' }), ...joao };
    case 'name-used-up':
      return { step: named({ usedUp: true }), ...hugo };
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
    case 'join-as-long':
      return { step: { kind: 'joinAs', busy: 'no' }, name: LONG_NAME, number: '' };
    case 'join-as-longest':
      return { step: { kind: 'joinAs', busy: 'no' }, name: LONGEST_NAME, number: '' };
    case 'member':
      return { step: { kind: 'member' }, ...joao };
    case 'code':
      return { step: code({ digits: '71' }), ...joao };
    case 'code-texted':
      return { step: code({ via: 'text', digits: '71' }), ...joao };
    case 'code-wrong':
      return { step: code({ digits: '713908', problem: 'wrong', wrongs: 1 }), ...joao };
    case 'code-expired-whatsapp':
      return { step: code({ problem: 'expired', resend: 0 }), ...joao };
    case 'code-expired':
      return { step: code({ via: 'text', problem: 'expired', resend: 0 }), ...joao };
    case 'code-exhausted':
      return { step: code({ problem: 'exhausted', resend: 0 }), ...joao };
    case 'code-failed':
      return { step: code({ digits: '713908', problem: 'failed' }), ...joao };
    case 'used-up':
      return { step: event({ ...HUGO, usedUp: true }), ...hugo };
    case 'code-second-number':
      return { step: code({ digits: '71' }), ...RITA };
    case 'second-number':
      return { step: event({ ...RITA, checked: true, secondNumber: true }), ...RITA };
    case 'code-provider-only':
    case 'code-provider-only-apple':
    case 'code-provider-only-both':
      return { step: code({ digits: '71' }), name: BISI.typed, number: BISI.number };
    case 'provider-only':
    case 'provider-only-apple':
    case 'provider-only-both':
      return {
        step: { kind: 'providerOnly', providers: linkedFor(state), busy: 'no' },
        name: '',
        number: '',
      };
    case 'browser-in':
    case 'from-check-in':
      return { step: { kind: 'in', name: HUGO.name, checks: true, held: true }, ...hugo };
    case 'browser-in-view':
      return { step: { kind: 'in', name: HUGO.name, checks: false, held: true }, ...hugo };
    case 'browser-in-account':
      return {
        step: { kind: 'in', name: KEMI, checks: true, held: false },
        name: KEMI,
        number: '',
      };
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
      redeem('enter', 'Enter a door code'),
      redeem('enter-blank', 'Continue, left blank'),
      redeem('enter-short', 'Too short'),
      redeem('checking', 'Checking'),
      redeem('refused', 'Wrong, expired or stopped'),
      redeem('too-many', 'Ten tries in a minute'),
    ],
  },
  {
    name: 'Joining · the event, then a name only (sc-72, until sc-4235)',
    states: [
      redeem('browser-name', 'From the QR: the redeem page'),
      redeem('name', 'The event, then a name'),
      redeem('name-blank', 'Join, left blank'),
      redeem('joining', 'Joining'),
      redeem('name-used-up', 'Used up'),
      redeem('join-as', 'Already signed in'),
      redeem('join-as-long', 'Signed in, a sixty-character name'),
      redeem('join-as-longest', 'Signed in, a 180-character name'),
      redeem('member', 'Already a member'),
    ],
  },
  {
    name: 'Joining · a name and a mobile number (once sc-4235 is built)',
    states: [
      redeem('browser-event', 'From the QR: the redeem page'),
      redeem('event', 'The event, then a name and a number'),
      redeem('event-blank', 'Send code, left blank'),
      redeem('event-short', 'A number too short'),
      redeem('sending', 'Sending'),
    ],
  },
  {
    name: 'Joining · the phone code (once sc-4235 is built)',
    states: [
      redeem('code', 'Check WhatsApp'),
      redeem('code-texted', 'Texted instead'),
      redeem('code-wrong', 'A wrong code'),
      redeem('code-expired', 'An expired code'),
      redeem('code-expired-whatsapp', 'An expired code, on WhatsApp'),
      redeem('code-exhausted', 'The phone code, tried too often'),
      redeem('code-failed', 'It did not go'),
      redeem('used-up', 'Used up'),
      redeem('code-second-number', 'An alternative number on an account: the code (sc-4235)'),
      redeem(
        'second-number',
        'An alternative number, after the right code: back to the name (sc-4235)',
      ),
    ],
  },
  {
    name: 'Joining · a member of an organisation that signs in with Google or Apple only (sc-94849)',
    states: [
      redeem('code-provider-only', 'Google linked: the code, before the right one'),
      redeem('provider-only', 'Google linked, after the right code: Continue with Google'),
      redeem('code-provider-only-apple', 'Apple linked: the code, before the right one'),
      redeem('provider-only-apple', 'Apple linked, after the right code: Continue with Apple'),
      redeem('code-provider-only-both', 'Both linked: the code, before the right one'),
      redeem('provider-only-both', 'Both linked, after the right code: Google, then Apple'),
    ],
  },
  {
    name: 'Joining · in, and signed out',
    states: [
      redeem('browser-in', 'You’re in, Check-in first (sc-28230)'),
      redeem('browser-in-view', 'You’re in at Can view: no Check-in (sc-28230)'),
      redeem('browser-in-account', 'You’re in with your own account: no sign-out time'),
      redeem('from-check-in', 'You’re in, back from check-in: nothing redeemed again (sc-28230)'),
      redeem('signed-out', 'Signed out'),
    ],
  },
];
