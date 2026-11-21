import { type EventPlace, EVENT_PLACES } from '../../kit/eventNav.ts';
import { BAR, type CodeChoice, type CodeRole, EVENT, type Redeemable } from './DoorCodeModel.ts';
import { tooShortFor, W } from './DoorCodeWords.ts';

export const REDEEM_STATES = [
  'welcome',
  'camera',
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
  'code-second-number',
  'second-number',
  'in',
  'event-in',
  'event-in-view',
  'people-in',
  'more-in',
] as const;
export type RedeemState = (typeof REDEEM_STATES)[number];

export type RedeemStep =
  | 'welcome'
  | 'camera'
  | 'enter'
  | 'tooMany'
  | 'event'
  | 'joinAs'
  | 'member'
  | 'code'
  | 'in'
  | 'inside'
  | 'peopleIn';
export type PhoneStatus = 'entering' | 'wrong' | 'expired' | 'exhausted' | 'failed';

/** Where the person joining is, and what each step holds; a link opens any of them. */
export interface Flow {
  step: RedeemStep;
  code: Redeemable;
  typed: string;
  said: string | null;
  /** Held on its busy state for a link to show it, then lands. */
  held: boolean;
  name: string;
  number: string;
  nameSaid: string | null;
  numberSaid: string | null;
  /** The code filled up while they typed: the right phone code meets sc-72's one refusal (sc-4235). */
  full: boolean;
  usedUp: boolean;
  texted: boolean;
  digits: string;
  phone: PhoneStatus;
  who: string;
  role: CodeRole;
  tries: number;
  /** Inside the event with More open: Your account and Sign out (`more-in`). */
  more: boolean;
}

export const JOAO = { name: 'João Pereira', number: '912 345 412' } as const;
/** A verified alternative on another account: the right code signs it into nothing (sc-4235). */
export const RITA = { name: 'Rita Sousa', number: '916 480 233' } as const;

export const isSecondNumber = (number: string) =>
  number.replace(/\D/gu, '') === RITA.number.replace(/\D/gu, '');

export function freshFlow(step: RedeemStep = 'welcome'): Flow {
  return {
    step,
    code: BAR,
    typed: '',
    said: null,
    held: false,
    name: '',
    number: '',
    nameSaid: null,
    numberSaid: null,
    full: false,
    usedUp: false,
    texted: false,
    digits: '',
    phone: 'entering',
    who: JOAO.name,
    role: BAR.role,
    tries: 0,
    more: false,
  };
}

export function redeemStateOf(name: string | undefined): RedeemState {
  return REDEEM_STATES.find((state) => state === name) ?? 'welcome';
}

export function flowAt(state: RedeemState): Flow {
  const plain = freshFlow();
  const joao = { ...plain, name: JOAO.name, number: JOAO.number };

  switch (state) {
    case 'welcome':
      return plain;
    case 'camera':
      return { ...plain, step: 'camera' };
    case 'enter':
      return { ...plain, step: 'enter', typed: BAR.code };
    case 'enter-blank':
      return { ...plain, step: 'enter', said: W.codeBlank };
    case 'enter-short':
      return { ...plain, step: 'enter', typed: 'Q7KM 4X', said: W.codeShort };
    case 'checking':
      return { ...plain, step: 'enter', typed: BAR.code, held: true };
    case 'refused':
      return { ...plain, step: 'enter', typed: 'Q7KM 4XP3', said: W.refused, tries: 1 };
    case 'too-many':
      return { ...plain, step: 'tooMany' };
    case 'event':
      return { ...joao, step: 'event' };
    case 'event-blank':
      return { ...plain, step: 'event', nameSaid: W.nameBlank, numberSaid: W.numberBlank };
    case 'event-short':
      return {
        ...joao,
        step: 'event',
        number: '912 345',
        numberSaid: tooShortFor(EVENT.countryName),
      };
    case 'sending':
      return { ...joao, step: 'event', held: true };
    case 'join-as':
      return { ...plain, step: 'joinAs', who: 'Kemi Okafor' };
    case 'member':
      return { ...plain, step: 'member' };
    case 'code':
      return { ...joao, step: 'code' };
    case 'code-texted':
      return { ...joao, step: 'code', texted: true };
    case 'code-wrong':
      return { ...joao, step: 'code', digits: '713908', phone: 'wrong' };
    case 'code-expired':
      return { ...joao, step: 'code', texted: true, phone: 'expired' };
    case 'code-exhausted':
      return { ...joao, step: 'code', phone: 'exhausted' };
    case 'code-failed':
      return { ...joao, step: 'code', digits: '713908', phone: 'failed' };
    case 'used-up':
      return {
        ...plain,
        step: 'event',
        name: 'Hugo Faria',
        number: '913 222 908',
        who: 'Hugo Faria',
        full: true,
        usedUp: true,
      };
    case 'code-second-number':
      return { ...plain, ...RITA, step: 'code' };
    case 'second-number':
      return { ...plain, ...RITA, step: 'event', numberSaid: W.secondNumber };
    case 'in':
      return { ...joao, step: 'in' };
    case 'event-in':
      return { ...joao, step: 'inside' };
    case 'event-in-view':
      return { ...joao, step: 'inside', role: 'Can view' };
    case 'people-in':
      return { ...joao, step: 'peopleIn' };
    case 'more-in':
      return { ...joao, step: 'inside', more: true };
  }
}

/** The step a phone code ends on: back to the number for a second number, the one refusal for a code that filled meanwhile, else You're in. */
export function afterPhoneCode(flow: Flow): Flow {
  if (isSecondNumber(flow.number))
    return {
      ...flow,
      step: 'event',
      numberSaid: W.secondNumber,
      digits: '',
      phone: 'entering',
      held: false,
    };

  return flow.full
    ? { ...flow, step: 'event', usedUp: true, digits: '', phone: 'entering', held: false }
    : { ...flow, step: 'in', who: flow.name.trim() === '' ? flow.who : flow.name.trim() };
}

export function phoneTitle(texted: boolean): string {
  return texted ? W.checkMessages : W.checkWhatsApp;
}

export function refusalOf(
  status: PhoneStatus,
  texted: boolean,
): { title: string; body: string } | null {
  switch (status) {
    case 'expired':
      return { title: W.expiredTitle, body: texted ? W.expiredBody : W.expiredBodyWhatsApp };
    case 'exhausted':
      return { title: W.exhaustedTitle, body: W.exhaustedBody };
    case 'failed':
      return { title: W.failedTitle, body: W.failedBody };
    default:
      return null;
  }
}

export type InsideArea = 'checkIn' | EventPlace;
const SEEN: readonly InsideArea[] = ['overview', 'guests', 'schedule', 'seating', 'people'];
/** The phone's tabs; every other area the role sees is in More. */
export const PHONE_AREAS: readonly InsideArea[] = ['overview', 'guests'];

/** What a level reaches inside the event (pm, 7 Nov, sc-72; sc-71): Can view and Can check guests in never Budget, Menu, Messages, Staff or Reports; Can edit every area but Budget, in the member sidebar's order. */
export function areasFor(role: CodeChoice): InsideArea[] {
  if (role === 'Can edit') return EVENT_PLACES.filter((place) => place !== 'budget');

  return role === 'Can check guests in' ? ['checkIn', ...SEEN] : [...SEEN];
}

export function moreAreas(role: CodeChoice, phone: boolean): InsideArea[] {
  return phone ? areasFor(role).filter((area) => !PHONE_AREAS.includes(area)) : [];
}

export const AREA_WORDS: Record<InsideArea, string> = {
  checkIn: W.checkIn,
  overview: W.overview,
  guests: W.guests,
  schedule: W.schedule,
  seating: W.seating,
  people: W.people,
  menu: 'Menu',
  messages: 'Messages',
  staff: 'Staff',
  budget: 'Budget',
  reports: 'Reports',
};
