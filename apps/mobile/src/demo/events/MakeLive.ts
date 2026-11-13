import { formatCount } from '../messages/MessagesSample.ts';
import { say as sayMessages } from '../messages/MessagesWords.ts';
import { LIVE, liveCounted, sayLive } from './EventsWords.ts';

export const MAKE_LIVE_STATES = [
  'makeLive',
  'makeLiveMaking',
  'makeLiveNotMade',
  'makeLiveOfferEmail',
  'makeLiveOffer',
  'makeLiveOfferPart',
  'makeLiveOfferWaits',
  'makeLiveOfferOne',
  'makeLiveOfferSending',
  'makeLiveOfferNotSent',
  'makeLiveOfferNobody',
  'makeLiveOfferRefused',
  'makeLiveOfferForbidden',
  'makeLiveOfferSent',
  'makeLiveOfferNotYet',
  'madeLive',
  'makeLiveNoOffer',
] as const;
export type MakeLiveState = (typeof MAKE_LIVE_STATES)[number];

export function makeLiveStateOf(state: string | null): MakeLiveState | null {
  return MAKE_LIVE_STATES.find((one) => one === state) ?? null;
}

/** The engagement's host in these states only: the sample event has none. */
export const MAKE_LIVE_HOST = 'Bisi Akindele';
export const MAKE_LIVE_EVENT = 'evt-draft-4';

/** The guests Not yet invited the send would go to, companions never counted, and the organisation's credits. */
export interface Reach {
  guests: number;
  emailOnly: number;
  /** Each has an email address too; a text to each costs 1 credit. */
  withPhone: number;
  unreachable: number;
  companions: number;
  balance: number;
}

const COVERED: Reach = {
  guests: 11,
  emailOnly: 7,
  withPhone: 3,
  unreachable: 1,
  companions: 1,
  balance: 250,
};
const NOBODY_ON_LIST: Reach = {
  guests: 0,
  emailOnly: 0,
  withPhone: 0,
  unreachable: 0,
  companions: 0,
  balance: 250,
};

const REACH: Partial<Record<MakeLiveState, Reach>> = {
  makeLiveOfferEmail: { ...COVERED, emailOnly: 10, withPhone: 0 },
  makeLiveOfferPart: { ...COVERED, balance: 1 },
  makeLiveOfferWaits: { ...COVERED, balance: 0 },
  makeLiveOfferOne: { ...COVERED, guests: 1, emailOnly: 1, withPhone: 0, unreachable: 0 },
  makeLiveOfferNobody: { ...COVERED, emailOnly: 0, withPhone: 0, unreachable: 11 },
};

export function reachOf(state: string | null, event: string): Reach {
  if (event !== MAKE_LIVE_EVENT) return NOBODY_ON_LIST;
  const live = makeLiveStateOf(state);

  return (live == null ? null : REACH[live]) ?? COVERED;
}

export function reachedOf(reach: Reach): number {
  return reach.emailOnly + reach.withPhone;
}

export interface Credits {
  line: string | null;
  /** Texts the balance cannot cover: sc-3963's wait block takes the place of Credits after sending. */
  waiting: number;
}

/** B's credits line when the balance covers every text; otherwise what does go now, then the wait block. */
export function creditsOf(reach: Reach): Credits {
  const texts = reach.withPhone;
  if (texts === 0) return { line: null, waiting: 0 };
  if (reach.balance >= texts)
    return {
      line: sayMessages.credits(texts, formatCount(reach.balance - texts), false),
      waiting: 0,
    };

  return {
    line: reach.balance > 0 ? liveCounted('textsUse', reach.balance) : null,
    waiting: texts - reach.balance,
  };
}

export type Turn =
  | { at: 'question'; making: boolean; failed: boolean }
  | { at: 'offer'; sending: boolean; failed: boolean }
  | { at: 'stopped'; why: 'nobody' | 'refused' | 'forbidden' }
  | { at: 'closed' };

export interface MakeLive {
  turn: Turn;
  live: boolean;
  toast: 'madeLive' | 'queued' | null;
}

const CLOSED: Turn = { at: 'closed' };
const QUESTION: Turn = { at: 'question', making: false, failed: false };
const OFFER: Turn = { at: 'offer', sending: false, failed: false };

const STARTS: Record<MakeLiveState, MakeLive> = {
  makeLive: { turn: QUESTION, live: false, toast: null },
  makeLiveMaking: { turn: { ...QUESTION, making: true }, live: false, toast: null },
  makeLiveNotMade: { turn: { ...QUESTION, failed: true }, live: false, toast: null },
  makeLiveOfferEmail: { turn: OFFER, live: true, toast: null },
  makeLiveOffer: { turn: OFFER, live: true, toast: null },
  makeLiveOfferPart: { turn: OFFER, live: true, toast: null },
  makeLiveOfferWaits: { turn: OFFER, live: true, toast: null },
  makeLiveOfferOne: { turn: OFFER, live: true, toast: null },
  makeLiveOfferSending: { turn: { ...OFFER, sending: true }, live: true, toast: null },
  makeLiveOfferNotSent: { turn: { ...OFFER, failed: true }, live: true, toast: null },
  makeLiveOfferNobody: { turn: { at: 'stopped', why: 'nobody' }, live: true, toast: null },
  makeLiveOfferRefused: { turn: { at: 'stopped', why: 'refused' }, live: true, toast: null },
  makeLiveOfferForbidden: { turn: { at: 'stopped', why: 'forbidden' }, live: true, toast: null },
  makeLiveOfferSent: { turn: CLOSED, live: true, toast: 'queued' },
  makeLiveOfferNotYet: { turn: CLOSED, live: true, toast: null },
  madeLive: { turn: CLOSED, live: true, toast: 'madeLive' },
  makeLiveNoOffer: { turn: QUESTION, live: false, toast: null },
};

export function makeLiveStart(state: string | null): MakeLive {
  const live = makeLiveStateOf(state);

  return live == null ? { turn: CLOSED, live: false, toast: null } : STARTS[live];
}

export type LiveAction = 'open' | 'confirm' | 'made' | 'keep' | 'send' | 'sent';

/** The demo's answers always come back yes; a press while one is out does nothing. */
export function reduceMakeLive(s: MakeLive, action: LiveAction, reach: Reach): MakeLive {
  const { turn } = s;

  switch (action) {
    case 'open':
      return turn.at === 'closed' && !s.live ? { ...s, turn: QUESTION, toast: null } : s;
    case 'confirm':
      return turn.at === 'question' && !turn.making
        ? { ...s, turn: { ...turn, making: true, failed: false } }
        : s;
    case 'made':
      if (turn.at !== 'question' || !turn.making) return s;
      if (reach.guests === 0) return { turn: CLOSED, live: true, toast: 'madeLive' };
      if (reachedOf(reach) === 0)
        return { turn: { at: 'stopped', why: 'nobody' }, live: true, toast: null };
      return { turn: OFFER, live: true, toast: null };
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
  }
}

export interface LiveAlert {
  turn: 'question' | 'offer' | 'stopped';
  title: string;
  line: string;
  failed: string | null;
  credits: Credits;
  later: string | null;
  keep: { label: string; off: boolean };
  confirm: { label: string; busy: string | undefined } | null;
}

const NO_CREDITS: Credits = { line: null, waiting: 0 };

export function liveAlertOf(turn: Turn, reach: Reach, name: string, app = true): LiveAlert | null {
  const later = app ? liveCounted('later', reach.guests) : null;

  switch (turn.at) {
    case 'closed':
      return null;
    case 'question':
      return {
        turn: 'question',
        title: sayLive.confirmTitle(name),
        line: LIVE.confirmLine,
        failed: turn.failed ? LIVE.failed : null,
        credits: NO_CREDITS,
        later: null,
        keep: { label: LIVE.notYet, off: turn.making },
        confirm: { label: LIVE.makeLive, busy: turn.making ? LIVE.making : undefined },
      };
    case 'offer':
      return {
        turn: 'offer',
        title: liveCounted('offerTitle', reach.guests),
        line: sayLive.isLive(name),
        failed: turn.failed ? LIVE.notSent : null,
        credits: creditsOf(reach),
        later,
        keep: { label: LIVE.notYet, off: turn.sending },
        confirm: {
          label: liveCounted('send', reach.guests),
          busy: turn.sending ? LIVE.sending : undefined,
        },
      };
    case 'stopped':
      return {
        turn: 'stopped',
        title: liveCounted('cannotTitle', reach.guests),
        line: sayLive.isLive(name),
        failed: turn.why === 'forbidden' ? LIVE.forbidden : liveCounted('nobody', reach.guests),
        credits: NO_CREDITS,
        later: turn.why === 'forbidden' ? null : later,
        keep: { label: LIVE.close, off: false },
        confirm: null,
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
