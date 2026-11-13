import { demoWords } from './demoWords.ts';
import { type Guest, sampleGuests } from './guests.ts';
import { LW } from './makeLiveWords.ts';
import { MW } from './messagesWords.ts';
import { WW } from './messagesWaitsWords.ts';
import { type MakeLiveState, MAKE_LIVE_STATES } from './makeLiveStates.ts';

export { LW, MAKE_LIVE_STATES, type MakeLiveState };

export const lw = demoWords(LW);
const mw = demoWords(MW);

export const NO_OFFER_EVENT = 'evt-cena-4';
export const HOSTS_FOR: Readonly<Record<string, string>> = {
  'evt-draft-4': 'Bisi Akindele',
  [NO_OFFER_EVENT]: 'Fundación Lucía',
};
export const INVITED_AT = '/demo/events/evt-wed-4/messages?state=invited';

export function isMakeLive(state: string | null): state is MakeLiveState {
  return MAKE_LIVE_STATES.some((one) => one.key === state);
}

export type Phase =
  | { at: 'ask'; failed: boolean }
  | { at: 'making' }
  | { at: 'offer'; failed: boolean }
  | { at: 'sending' }
  | { at: 'cannot'; why: 'nobody' | 'forbidden' };

/** Where the alert opens for each state; null opens no alert. */
export function phaseOf(state: MakeLiveState | null): Phase | null {
  switch (state) {
    case 'makeLive':
    case 'makeLiveNoOffer':
      return { at: 'ask', failed: false };
    case 'makeLiveNotMade':
      return { at: 'ask', failed: true };
    case 'makeLiveMaking':
      return { at: 'making' };
    case 'makeLiveOfferEmail':
    case 'makeLiveOffer':
    case 'makeLiveOfferPart':
    case 'makeLiveOfferWaits':
    case 'makeLiveOfferOne':
      return { at: 'offer', failed: false };
    case 'makeLiveOfferNotSent':
      return { at: 'offer', failed: true };
    case 'makeLiveOfferSending':
      return { at: 'sending' };
    case 'makeLiveOfferNobody':
    case 'makeLiveOfferRefused':
      return { at: 'cannot', why: 'nobody' };
    case 'makeLiveOfferForbidden':
      return { at: 'cannot', why: 'forbidden' };
    default:
      return null;
  }
}

/** The event is Live behind the alert from the offer on. */
export function liveIn(state: MakeLiveState): boolean {
  const phase = phaseOf(state);

  return phase == null ? state !== 'makeLiveNoOffer' : phase.at !== 'ask' && phase.at !== 'making';
}

export interface Offer {
  /** Every guest Not yet invited, reachable or not; never a companion. */
  count: number;
  reached: number;
  texts: number;
  emails: number;
  balance: number;
}

const BALANCE: Partial<Record<MakeLiveState, number>> = {
  makeLiveOfferPart: 1,
  makeLiveOfferWaits: 0,
};

function guestsFor(id: string, state: MakeLiveState | null): Guest[] {
  const waiting = sampleGuests(id).filter((one) => one.reply === 'notYet');

  switch (state) {
    case 'makeLiveOfferEmail':
      return waiting.map((one) => ({ ...one, phone: null }));
    case 'makeLiveOfferOne':
      return waiting.filter((one) => one.email != null && one.phone == null).slice(0, 1);
    case 'makeLiveOfferNobody':
    case 'makeLiveOfferRefused':
      return waiting.map((one) => ({ ...one, email: null, phone: null }));
    default:
      return waiting;
  }
}

/** What the offer counts on an event's list as the state draws it: null when nobody is Not yet invited, so no offer is made. */
export function offerOf(id: string, state: MakeLiveState | null): Offer | null {
  const guests = guestsFor(id, state);

  if (guests.length === 0) return null;

  return {
    count: guests.length,
    reached: guests.filter((one) => one.email != null || one.phone != null).length,
    texts: guests.filter((one) => one.phone != null).length,
    emails: guests.filter((one) => one.email != null).length,
    balance: (state == null ? undefined : BALANCE[state]) ?? 250,
  };
}

export function reachedIds(id: string, state: MakeLiveState | null): string[] {
  return guestsFor(id, state)
    .filter((one) => one.email != null || one.phone != null)
    .map((one) => one.id);
}

export interface Cost {
  credits: string | null;
  either: string | null;
  waits: string | null;
}

/** Messaging B's credits line when the texts are covered; sc-3963's wait part when they are not, after what goes now. */
export function costOf(offer: Offer): Cost {
  const { texts, balance } = offer;

  if (texts === 0) return { credits: null, either: null, waits: null };
  if (balance >= texts)
    return {
      credits: `${mw.many('textsUse', texts)} ${mw.filled(MW.creditsAfter, { count: balance - texts })}`,
      either: null,
      waits: null,
    };

  return {
    credits: balance > 0 ? mw.many('textsUse', balance) : null,
    either: offer.emails > 0 ? WW.eitherWay : null,
    waits: mw.many('smsWaits', texts - balance),
  };
}
