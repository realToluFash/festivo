import { hostsLine } from '@soirely/domain';

import { demoWords } from './demoWords.ts';
import type { SampleEvent } from './events.ts';
import { type Guest, notYetInvited, replyByOf, sampleGuests } from './guests.ts';
import { LW } from './makeLiveWords.ts';
import { type Category, whatsAppCreditsIn } from './messages.ts';
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
  'makeLiveOfferEmail',
  'makeLiveOfferOne',
  'makeLiveOfferWaits',
  'makeLiveOfferPart',
  'makeLiveOfferWhatsApp',
  'makeLiveOfferWhatsAppOnly',
  'makeLiveOfferSending',
  'makeLiveOfferSent',
  'makeLiveOfferNotYet',
  'makeLiveOfferNotSent',
  'makeLiveOfferNobody',
  'makeLiveOfferRefused',
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
    case 'makeLiveOfferEmail':
    case 'makeLiveOfferOne':
    case 'makeLiveOfferWaits':
    case 'makeLiveOfferPart':
    case 'makeLiveOfferWhatsApp':
    case 'makeLiveOfferWhatsAppOnly':
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
  /** WhatsApp invitations in place of texts (sc-45251), and their credits at each guest's own country's rate. */
  whatsApp: number;
  whatsAppCredits: number;
}

/** Who has agreed to WhatsApp in the states that send it, and the category Meta approved the template in. */
const WHATSAPP: Partial<Record<MakeLiveState, { category: Category; agreed: readonly string[] }>> =
  {
    makeLiveOfferWhatsApp: { category: 'marketing', agreed: ['tola', 'grace'] },
    makeLiveOfferWhatsAppOnly: { category: 'utility', agreed: ['tola', 'grace', 'ryan'] },
  };

function waitingOn(id: string, state: MakeLiveState | null): Guest[] {
  const waiting = notYetInvited(sampleGuests(id));

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

  const wa = state == null ? undefined : WHATSAPP[state];
  const byWhatsApp = (one: Guest) =>
    wa != null &&
    one.phone != null &&
    wa.agreed.includes(one.id) &&
    !(wa.category === 'marketing' && one.phone.country === 'US');
  const sentWhatsApp = guests.filter(byWhatsApp);

  return {
    count: guests.length,
    reached: guests.filter((one) => one.email != null || one.phone != null).length,
    texts: guests.flatMap((one) =>
      one.phone == null || byWhatsApp(one)
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
    whatsApp: sentWhatsApp.length,
    whatsAppCredits:
      wa == null
        ? 0
        : sentWhatsApp.reduce(
            (sum, one) => sum + whatsAppCreditsIn(one.phone?.country ?? '', wa.category),
            0,
          ),
  };
}

export interface Cost {
  credits: string | null;
  either: string | null;
  waits: string | null;
}

/** The credits line's three forms (sc-45251): texts, texts and WhatsApp messages, or WhatsApp messages. */
function usesKey(texts: number, whatsApp: number) {
  if (whatsApp === 0) return 'textsUse' as const;

  return texts === 0 ? ('whatsAppUse' as const) : ('textsAndWhatsAppUse' as const);
}

/** Messaging B's credits line when the balance covers every text; sc-3963's wait lines in Credits after sending's place when it does not, a text going only when its whole cost is covered. */
export function costOf(offer: Offer): Cost {
  const { texts, balance, whatsAppCredits } = offer;
  const textCost = texts.reduce((sum, credits) => sum + credits, 0);
  const needs = textCost + whatsAppCredits;

  if (needs === 0) return { credits: null, either: null, waits: null };
  if (balance >= needs)
    return {
      credits: `${mw.many(usesKey(textCost, whatsAppCredits), needs)} ${mw.filled(MW.creditsAfter, { count: balance - needs })}`,
      either: null,
      waits: null,
    };
  if (whatsAppCredits > 0)
    return {
      credits: null,
      either: offer.emails > 0 ? WW.eitherWay : null,
      waits: [
        mw.many('whatsAppWaits', offer.whatsApp),
        ...(texts.length > 0 ? [mw.many('smsWaits', texts.length)] : []),
      ].join(' '),
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
