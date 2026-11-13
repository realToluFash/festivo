import { makeLiveHostError } from '@soirely/domain';

import { DRAFT_COUNTS, DRAFT_GUESTS } from '../guests/GuestsSample.ts';
import { formatCount } from '../messages/MessagesSample.ts';
import { LIVE, W, liveCounted, sayLive, t } from './EventsWords.ts';
import type { SampleEvent } from './EventsSample.ts';

export const MAKE_LIVE_STATES = [
  'makeLive',
  'makeLiveMaking',
  'makeLiveNotMade',
  'makeLiveHost',
  'makeLiveHostBlank',
  'makeLiveChanged',
  'makeLiveCannotSend',
  'makeLiveOffer',
  'makeLiveOfferEmail',
  'makeLiveOfferOne',
  'makeLiveOfferWaits',
  'makeLiveOfferPart',
  'makeLiveOfferSending',
  'makeLiveOfferSent',
  'makeLiveOfferNotYet',
  'makeLiveOfferNotSent',
  'makeLiveOfferNobody',
  'makeLiveOfferRefused',
  'makeLiveOfferForbidden',
  'makeLiveEndPassed',
  'makeLiveNoOffer',
  'madeLive',
] as const;
export type MakeLiveState = (typeof MAKE_LIVE_STATES)[number];

export function makeLiveStateOf(state: string | null): MakeLiveState | null {
  return MAKE_LIVE_STATES.find((one) => one === state) ?? null;
}

export const MAKE_LIVE_EVENT = 'evt-draft-4';
const PASSED_EVENT = 'evt-shower-2';
const EMPTY_EVENT = 'evt-cena-4';

export interface LiveSeed {
  event: string;
  hosts: readonly string[] | null;
  live: boolean;
}

const HOSTED: LiveSeed = { event: MAKE_LIVE_EVENT, hosts: ['Bisi Akindele'], live: false };
const HOSTED_LIVE: LiveSeed = { ...HOSTED, live: true };
const NO_OFFER: LiveSeed = { event: EMPTY_EVENT, hosts: ['Fundación Lucía'], live: false };

const SEEDS: Record<MakeLiveState, LiveSeed> = {
  makeLive: HOSTED,
  makeLiveMaking: HOSTED,
  makeLiveNotMade: HOSTED,
  makeLiveHost: { event: MAKE_LIVE_EVENT, hosts: [], live: false },
  makeLiveHostBlank: { event: MAKE_LIVE_EVENT, hosts: [], live: false },
  makeLiveChanged: HOSTED_LIVE,
  makeLiveCannotSend: HOSTED,
  makeLiveOffer: HOSTED_LIVE,
  makeLiveOfferEmail: HOSTED_LIVE,
  makeLiveOfferOne: HOSTED_LIVE,
  makeLiveOfferWaits: HOSTED_LIVE,
  makeLiveOfferPart: HOSTED_LIVE,
  makeLiveOfferSending: HOSTED_LIVE,
  makeLiveOfferSent: HOSTED_LIVE,
  makeLiveOfferNotYet: HOSTED_LIVE,
  makeLiveOfferNotSent: HOSTED_LIVE,
  makeLiveOfferNobody: HOSTED_LIVE,
  makeLiveOfferRefused: HOSTED_LIVE,
  makeLiveOfferForbidden: HOSTED_LIVE,
  makeLiveEndPassed: { event: PASSED_EVENT, hosts: null, live: false },
  makeLiveNoOffer: NO_OFFER,
  madeLive: { ...NO_OFFER, live: true },
};

export function liveSeedOf(state: MakeLiveState): LiveSeed {
  return SEEDS[state];
}

export function seededEvent(event: SampleEvent, state: MakeLiveState): SampleEvent {
  const seed = SEEDS[state];
  const hosted =
    seed.hosts != null && seed.event === event.id ? { ...event, hosts: seed.hosts } : event;

  return seed.live ? { ...hosted, status: 'live' } : hosted;
}

export interface Reach {
  guests: number;
  unreachable: number;
  texts: readonly number[];
  balance: number;
  maySend: boolean;
}

const GSM_7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_7_TWICE = '^{}\\[~]|€';
/** sc-1526's link as built: the address and a 256-bit token (#45622). */
export const LINK_CHARS = 'https://soirely.com/i/'.length + Math.ceil(256 / 6);

/** GSM-7 to 160 characters, then 153 a part; any other character makes it UCS-2, 70 then 67. */
export function smsParts(text: string): number {
  const chars = [...text];
  const gsm = chars.every((one) => GSM_7.includes(one) || GSM_7_TWICE.includes(one));

  if (!gsm) return chars.length <= 70 ? 1 : Math.ceil(chars.length / 67);

  const length = chars.reduce((sum, one) => sum + (GSM_7_TWICE.includes(one) ? 2 : 1), 0);

  return length <= 160 ? 1 : Math.ceil(length / 153);
}

/** A sample of sc-3928's unit-cost table: the credits one part costs, by the number's country. */
export const PART_CREDITS = {
  US: 2,
  GB: 9,
  FR: 13,
  ES: 14,
  PT: 8,
  BR: 10,
  MX: 29,
  NG: 62,
} as const;
export type PartCountry = keyof typeof PART_CREDITS;

const DIALLING: readonly (readonly [string, PartCountry])[] = [
  ['+234', 'NG'],
  ['+351', 'PT'],
  ['+44', 'GB'],
  ['+33', 'FR'],
  ['+34', 'ES'],
  ['+55', 'BR'],
  ['+52', 'MX'],
  ['+1', 'US'],
];

export function countryOf(phone: string): PartCountry | null {
  return DIALLING.find(([code]) => phone.startsWith(code))?.[1] ?? null;
}

export interface PricedText {
  phone: string;
  parts: number;
}

export function textCost({ phone, parts }: PricedText): number {
  const country = countryOf(phone);
  if (country == null) throw new Error(`No rate for ${phone}`);

  return parts * PART_CREDITS[country];
}

export function priceOf(texts: readonly PricedText[]): number {
  return texts.reduce((sum, one) => sum + textCost(one), 0);
}

type Invited = Pick<SampleEvent, 'name' | 'hosts' | 'startsAt' | 'timeZone'>;

/** The first text to a number, without a Reply by date, ends on the STOP line. */
export function inviteTextOf(event: Invited, greeting: string): { text: string; parts: number } {
  const hosts = new Intl.ListFormat('en', { type: 'conjunction', style: 'long' }).format(
    event.hosts,
  );
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: event.timeZone,
  }).format(new Date(event.startsAt));
  const text = sayLive.inviteText(hosts, greeting, event.name, date).replaceAll('’', "'");

  return { text, parts: smsParts(`${text}${'x'.repeat(LINK_CHARS)}\n${LIVE.smsStop}`) };
}

export const OFFER_MOBILES: readonly { name: string; phone: string }[] = DRAFT_GUESTS.flatMap(
  ({ name, phone }) => (phone == null ? [] : [{ name, phone }]),
);
export const OFFER_BALANCE = 250;

/** The engagement's offer: Guests' Not yet invited less the companions, those no channel reaches, and the three mobiles in the order they are taken. */
export function sampleReach(event: Invited): Reach {
  const companions = DRAFT_GUESTS.reduce((sum, one) => sum + one.companions.length, 0);
  const unreachable = DRAFT_GUESTS.filter((one) => one.email == null && one.phone == null).length;
  const texts = OFFER_MOBILES.map(({ name, phone }) =>
    textCost({ phone, parts: inviteTextOf(event, name).parts }),
  );

  return {
    guests: DRAFT_COUNTS.notyet - companions,
    unreachable,
    texts,
    balance: OFFER_BALANCE,
    maySend: true,
  };
}

const NOBODY_ON_LIST: Reach = {
  guests: 0,
  unreachable: 0,
  texts: [],
  balance: OFFER_BALANCE,
  maySend: true,
};

export function reachOf(state: string | null, event: SampleEvent): Reach {
  if (event.id !== MAKE_LIVE_EVENT) return NOBODY_ON_LIST;
  const reach = sampleReach(event);

  switch (makeLiveStateOf(state)) {
    case 'makeLiveOfferEmail':
      return { ...reach, texts: [] };
    case 'makeLiveOfferOne':
      return { ...reach, guests: 1, unreachable: 0, texts: [] };
    case 'makeLiveOfferWaits':
      return { ...reach, balance: 0 };
    case 'makeLiveOfferPart':
      return { ...reach, balance: 100 };
    case 'makeLiveOfferNobody':
    case 'makeLiveOfferRefused':
      return { ...reach, unreachable: reach.guests, texts: [] };
    case 'makeLiveCannotSend':
      return { ...reach, maySend: false };
    default:
      return reach;
  }
}

export function reachedOf(reach: Reach): number {
  return reach.guests - reach.unreachable;
}

export interface Credits {
  line: string | null;
  waiting: number;
}

/** A text goes only when its whole cost fits in what is left; the rest wait, in sc-3963's lines. */
export function creditsOf(reach: Reach): Credits {
  let left = reach.balance;
  const going = reach.texts.filter((cost) => {
    if (cost > left) return false;
    left -= cost;
    return true;
  });
  const used = going.reduce((sum, cost) => sum + cost, 0);
  const waiting = reach.texts.length - going.length;

  if (waiting === 0)
    return used === 0
      ? { line: null, waiting: 0 }
      : {
          line: `${liveCounted('textsUse', used)} ${sayLive.creditsAfter(formatCount(left))}`,
          waiting: 0,
        };

  return { line: going.length === 0 ? null : liveCounted('textsUse', used), waiting };
}

export interface HostAsk {
  error: string | null;
}

export type Turn =
  | { at: 'question'; making: boolean; failed: boolean; host: HostAsk | null }
  | { at: 'offer'; sending: boolean; failed: boolean }
  | { at: 'stopped'; why: 'nobody' | 'forbidden' }
  | { at: 'told'; why: 'endPassed' | 'changed' }
  | { at: 'closed' };

export interface MakeLive {
  turn: Turn;
  live: boolean;
  toast: 'madeLive' | 'queued' | null;
}

const CLOSED: Turn = { at: 'closed' };
const QUESTION: Turn = { at: 'question', making: false, failed: false, host: null };
const ASKS_HOST: Turn = { ...QUESTION, host: { error: null } };
const OFFER: Turn = { at: 'offer', sending: false, failed: false };
const DRAFT = (turn: Turn): MakeLive => ({ turn, live: false, toast: null });
const LIVE_NOW = (turn: Turn): MakeLive => ({ turn, live: true, toast: null });

const STARTS: Record<MakeLiveState, MakeLive> = {
  makeLive: DRAFT(QUESTION),
  makeLiveMaking: DRAFT({ ...QUESTION, making: true }),
  makeLiveNotMade: DRAFT({ ...QUESTION, failed: true }),
  makeLiveHost: DRAFT(ASKS_HOST),
  makeLiveHostBlank: DRAFT({ ...QUESTION, host: { error: makeLiveHostError('', t) } }),
  makeLiveChanged: LIVE_NOW({ at: 'told', why: 'changed' }),
  makeLiveCannotSend: DRAFT(QUESTION),
  makeLiveOffer: LIVE_NOW(OFFER),
  makeLiveOfferEmail: LIVE_NOW(OFFER),
  makeLiveOfferOne: LIVE_NOW(OFFER),
  makeLiveOfferWaits: LIVE_NOW(OFFER),
  makeLiveOfferPart: LIVE_NOW(OFFER),
  makeLiveOfferSending: LIVE_NOW({ ...OFFER, sending: true }),
  makeLiveOfferSent: { turn: CLOSED, live: true, toast: 'queued' },
  makeLiveOfferNotYet: LIVE_NOW(CLOSED),
  makeLiveOfferNotSent: LIVE_NOW({ ...OFFER, failed: true }),
  makeLiveOfferNobody: LIVE_NOW({ at: 'stopped', why: 'nobody' }),
  makeLiveOfferRefused: LIVE_NOW({ at: 'stopped', why: 'nobody' }),
  makeLiveOfferForbidden: LIVE_NOW({ at: 'stopped', why: 'forbidden' }),
  makeLiveEndPassed: DRAFT({ at: 'told', why: 'endPassed' }),
  makeLiveNoOffer: DRAFT(QUESTION),
  madeLive: { turn: CLOSED, live: true, toast: 'madeLive' },
};

export function makeLiveStart(state: string | null): MakeLive {
  const live = makeLiveStateOf(state);

  return live == null ? DRAFT(CLOSED) : STARTS[live];
}

export type LiveAction =
  | { type: 'open'; asksHost: boolean }
  | { type: 'confirm'; hostError: string | null }
  | { type: 'typed' }
  | { type: 'made' }
  | { type: 'keep' }
  | { type: 'send' }
  | { type: 'sent' }
  | { type: 'toastClosed' };

/** The demo's answers always come back yes; a press while one is out does nothing; nothing puts it back to Draft. */
export function reduceMakeLive(s: MakeLive, action: LiveAction, reach: Reach): MakeLive {
  const { turn } = s;

  switch (action.type) {
    case 'open':
      return turn.at === 'closed' && !s.live
        ? { ...s, turn: action.asksHost ? ASKS_HOST : QUESTION, toast: null }
        : s;
    case 'confirm':
      if (turn.at !== 'question' || turn.making) return s;
      if (turn.host != null && action.hostError != null)
        return { ...s, turn: { ...turn, host: { error: action.hostError } } };
      return { ...s, turn: { ...turn, making: true, failed: false } };
    case 'typed':
      return turn.at === 'question' && turn.host?.error != null
        ? { ...s, turn: { ...turn, host: { error: null } } }
        : s;
    case 'made':
      if (turn.at !== 'question' || !turn.making) return s;
      if (reach.guests === 0 || !reach.maySend)
        return { turn: CLOSED, live: true, toast: 'madeLive' };
      if (reachedOf(reach) === 0) return LIVE_NOW({ at: 'stopped', why: 'nobody' });
      return LIVE_NOW(OFFER);
    case 'keep':
      if (turn.at === 'question' && turn.making) return s;
      if (turn.at === 'offer' && turn.sending) return s;
      return { ...s, turn: CLOSED, toast: null };
    case 'send':
      return turn.at === 'offer' && !turn.sending
        ? { ...s, turn: { ...turn, sending: true, failed: false } }
        : s;
    case 'sent':
      return turn.at === 'offer' && turn.sending ? { ...s, turn: CLOSED, toast: 'queued' } : s;
    case 'toastClosed':
      return { ...s, toast: null };
  }
}

export interface LiveAlert {
  turn: Exclude<Turn['at'], 'closed'>;
  title: string;
  line: string;
  alert: boolean;
  failed: string | null;
  reason: string | null;
  later: string | null;
  credits: Credits;
  failedLast: string | null;
  host: HostAsk | null;
  keep: { label: string; off: boolean };
  confirm: { label: string; busy: string | undefined } | null;
}

const NO_CREDITS: Credits = { line: null, waiting: 0 };
const PLAIN = {
  alert: false,
  failed: null,
  reason: null,
  later: null,
  credits: NO_CREDITS,
  failedLast: null,
  host: null,
} as const;

export function liveAlertOf(turn: Turn, reach: Reach, name: string): LiveAlert | null {
  const close = { label: LIVE.close, off: false };

  switch (turn.at) {
    case 'closed':
      return null;
    case 'question':
      return {
        ...PLAIN,
        turn: 'question',
        title: sayLive.confirmTitle(name),
        line: LIVE.confirmLine,
        failed: turn.failed ? LIVE.failed : null,
        host: turn.host,
        keep: { label: LIVE.notYet, off: turn.making },
        confirm: { label: LIVE.makeLive, busy: turn.making ? LIVE.making : undefined },
      };
    case 'offer':
      return {
        ...PLAIN,
        turn: 'offer',
        title: liveCounted('offerTitle', reach.guests),
        line: sayLive.isLive(name),
        later: liveCounted('later', reach.guests),
        credits: creditsOf(reach),
        failedLast: turn.failed ? LIVE.notSent : null,
        keep: { label: LIVE.notYet, off: turn.sending },
        confirm: {
          label: liveCounted('send', reach.guests),
          busy: turn.sending ? LIVE.sending : undefined,
        },
      };
    case 'stopped':
      return {
        ...PLAIN,
        turn: 'stopped',
        title: liveCounted('cannotTitle', reach.guests),
        line: sayLive.isLive(name),
        reason: turn.why === 'forbidden' ? LIVE.forbidden : liveCounted('nobody', reach.guests),
        later: turn.why === 'forbidden' ? null : liveCounted('later', reach.guests),
        keep: close,
        confirm: null,
      };
    case 'told':
      return {
        ...PLAIN,
        turn: 'told',
        title: turn.why === 'endPassed' ? LIVE.notMadeLive : LIVE.changedTitle,
        line: turn.why === 'endPassed' ? W.endPassed : LIVE.nowLive,
        alert: true,
        keep: close,
        confirm: turn.why === 'endPassed' ? { label: W.changeDates, busy: undefined } : null,
      };
  }
}

export function liveToastOf(s: MakeLive, reach: Reach): string | null {
  if (s.toast === 'madeLive') return LIVE.madeLive;

  return s.toast === 'queued' ? liveCounted('queued', reachedOf(reach)) : null;
}

/** The Invitation conversation the toast's Messages opens: Messaging B's, on the wedding. */
export const INVITATION_HREF = '/demo/events/evt-wed-4?area=messages&state=invited';

export const MAKING_MS = 900;
export const SENDING_MS = 900;
