import { BAR, type CodeRole, EVENT, type Redeemable } from './DoorCodeModel.ts';
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
  'in',
  'event-in',
  'event-in-view',
  'people-in',
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
}

export const JOAO = { name: 'João Pereira', number: '912 345 412' } as const;

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
    case 'in':
      return { ...joao, step: 'in' };
    case 'event-in':
      return { ...joao, step: 'inside' };
    case 'event-in-view':
      return { ...joao, step: 'inside', role: 'Can view' };
    case 'people-in':
      return { ...joao, step: 'peopleIn' };
  }
}

/** The step a phone code ends on: the one refusal for a code that filled meanwhile, else You're in. */
export function afterPhoneCode(flow: Flow): Flow {
  return flow.full
    ? { ...flow, step: 'event', usedUp: true, digits: '', phone: 'entering', held: false }
    : { ...flow, step: 'in', who: flow.name.trim() === '' ? flow.who : flow.name.trim() };
}

export function phoneTitle(texted: boolean): string {
  return texted ? W.checkMessages : W.checkWhatsApp;
}

export function refusalOf(status: PhoneStatus): { title: string; body: string } | null {
  switch (status) {
    case 'expired':
      return { title: W.expiredTitle, body: W.expiredBody };
    case 'exhausted':
      return { title: W.exhaustedTitle, body: W.exhaustedBody };
    case 'failed':
      return { title: W.failedTitle, body: W.failedBody };
    default:
      return null;
  }
}
