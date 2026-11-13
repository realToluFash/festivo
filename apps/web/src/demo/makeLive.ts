import { hostsLine } from '@soirely/domain';

import { demoWords } from './demoWords.ts';
import type { SampleEvent } from './events.ts';
import { type Guest, replyByOf, sampleGuests } from './guests.ts';
import { LW } from './makeLiveWords.ts';
import { MW } from './messagesWords.ts';
import { inviteSmsOf, oneGuestOf } from './inviteSms.ts';
import { WW } from './messagesWaitsWords.ts';
import { textCredits } from './smsCredits.ts';
import { type MakeLiveState, MAKE_LIVE_EVENTS, MAKE_LIVE_STATES } from './makeLiveStates.ts';

export { LW, MAKE_LIVE_EVENTS, MAKE_LIVE_STATES, type MakeLiveState };

export const lw = demoWords(LW);
const mw = demoWords(MW);

const NAMED: Readonly<Record<string, string>> = {
  'evt-draft-4': 'Bisi Akindele',
  'evt-cena-4': 'Fundación Lucía',
};
const AS_IT_IS: readonly MakeLiveState[] = [
  'makeLiveHost',
  'makeLiveHostBlank',
  'makeLiveEndPassed',
];
const LIVE_BEHIND: readonly MakeLiveState[] = [
  'makeLiveChanged',
  'makeLiveOffer',
  'makeLiveOfferOne',
  'makeLiveOfferWaits',
  'makeLiveOfferPart',
  'makeLiveOfferSending',
  'makeLiveOfferSent',
  'makeLiveOfferNotYet',
  'makeLiveOfferNotSent',
  'makeLiveOfferNobody',
  'makeLiveOfferForbidden',
  'madeLive',
];

export const INVITED_AT = '/demo/events/evt-wed-4/messages?state=invited';

export function isMakeLive(state: string | null): state is MakeLiveState {
  return MAKE_LIVE_STATES.some((one) => one.key === state);
}

/** The event as the state opens it: its host named unless the state asks for one, and Live from the offer on. */
export function seededEvent(event: SampleEvent, state: MakeLiveState): SampleEvent {
  const named = NAMED[event.id];

  return {
    ...event,
    hosts: AS_IT_IS.includes(state) || named == null ? event.hosts : [named],
    status: LIVE_BEHIND.includes(state) ? 'live' : event.status,
  };
}

/** The reader may make the offer: makeLiveCannotSend's member holds events.manage and not messages.manage. */
export function maySend(state: MakeLiveState | null): boolean {
  return state !== 'makeLiveCannotSend';
}

export type Phase =
  | { at: 'ask'; failed: boolean; blank: boolean }
  | { at: 'making' }
  | { at: 'offer'; failed: boolean }
  | { at: 'sending' }
  | { at: 'cannot'; why: 'nobody' | 'forbidden' }
  | { at: 'told'; why: 'endPassed' | 'changed' };

export const ASK = { at: 'ask', failed: false, blank: false } as const satisfies Phase;

export function phaseOf(state: MakeLiveState | null): Phase | null {
  switch (state) {
    case 'makeLive':
    case 'makeLiveHost':
    case 'makeLiveCannotSend':
    case 'makeLiveNoOffer':
      return ASK;
    case 'makeLiveHostBlank':
      return { ...ASK, blank: true };
    case 'makeLiveNotMade':
      return { ...ASK, failed: true };
    case 'makeLiveMaking':
      return { at: 'making' };
    case 'makeLiveOffer':
    case 'makeLiveOfferOne':
    case 'makeLiveOfferWaits':
    case 'makeLiveOfferPart':
      return { at: 'offer', failed: false };
    case 'makeLiveOfferNotSent':
      return { at: 'offer', failed: true };
    case 'makeLiveOfferSending':
      return { at: 'sending' };
    case 'makeLiveOfferNobody':
      return { at: 'cannot', why: 'nobody' };
    case 'makeLiveOfferForbidden':
      return { at: 'cannot', why: 'forbidden' };
    case 'makeLiveEndPassed':
      return { at: 'told', why: 'endPassed' };
    case 'makeLiveChanged':
      return { at: 'told', why: 'changed' };
    default:
      return null;
  }
}

/** Host 1 as typed: a line break typed or pasted becomes a space; null when nothing is left. */
export function hostTyped(typed: string): string | null {
  const host = typed.replaceAll(/[\r\n]+/gu, ' ').trim();

  return host === '' ? null : host;
}

export interface Offer {
  /** Every guest Not yet invited, reachable or not; never a companion. */
  count: number;
  /** The guests a channel reaches: the toast's count. */
  reached: number;
  /** What each text costs: its parts × the credits a part for its number's country, in the list's order. */
  texts: readonly number[];
  emails: number;
  balance: number;
}

function waitingOn(id: string, state: MakeLiveState | null): Guest[] {
  const waiting = sampleGuests(id).filter((one) => one.reply === 'notYet');

  switch (state) {
    case 'makeLiveOfferOne':
      return waiting.filter((one) => one.email != null && one.phone == null).slice(0, 1);
    case 'makeLiveOfferNobody':
      return waiting.map((one) => ({ ...one, email: null, phone: null }));
    default:
      return waiting;
  }
}

const BALANCES: Partial<Record<MakeLiveState, number>> = {
  makeLiveOfferWaits: 0,
  makeLiveOfferPart: 100,
};
const BALANCE = 250;

const SMS_DATE = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone });

/** What the offer counts on the event's list as the state seeds it; null when nobody is Not yet invited, so no offer is made. */
export function offerOf(event: SampleEvent, state: MakeLiveState | null): Offer | null {
  const guests = waitingOn(event.id, state);

  if (guests.length === 0) return null;

  const about = {
    hosts: hostsLine(event.hosts, 'en-US'),
    event: event.name,
    date: SMS_DATE(event.timeZone).format(new Date(event.startsAt)),
    replyBy: replyByOf(event.id),
  };

  return {
    count: guests.length,
    reached: guests.filter((one) => one.email != null || one.phone != null).length,
    texts: guests.flatMap((one) =>
      one.phone == null
        ? []
        : [
            textCredits({
              parts: inviteSmsOf(oneGuestOf(one), about).parts,
              country: one.phone.country,
            }),
          ],
    ),
    emails: guests.filter((one) => one.email != null).length,
    balance: (state == null ? undefined : BALANCES[state]) ?? BALANCE,
  };
}

export interface Cost {
  credits: string | null;
  either: string | null;
  waits: string | null;
}

/** Messaging B's credits line when the balance covers every text; sc-3963's wait lines in Credits after sending's place when it does not, a text going only when its whole cost is covered. */
export function costOf(offer: Offer): Cost {
  const { texts, balance } = offer;
  const needs = texts.reduce((sum, credits) => sum + credits, 0);

  if (needs === 0) return { credits: null, either: null, waits: null };
  if (balance >= needs)
    return {
      credits: `${mw.many('textsUse', needs)} ${mw.filled(MW.creditsAfter, { count: balance - needs })}`,
      either: null,
      waits: null,
    };

  let left = balance;
  const covered = texts.filter((credits) => {
    if (credits > left) return false;
    left -= credits;
    return true;
  });
  const spent = covered.reduce((sum, credits) => sum + credits, 0);

  return {
    credits: spent > 0 ? mw.many('textsUse', spent) : null,
    either: offer.emails > 0 ? WW.eitherWay : null,
    waits: mw.many('smsWaits', texts.length - covered.length),
  };
}
