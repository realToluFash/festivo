import { demoWords } from './demoWords.ts';
import { type Guest, sampleGuests } from './guests.ts';
import { LW } from './makeLiveWords.ts';
import { type Category, whatsAppCreditsIn } from './messages.ts';
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
    case 'makeLiveOfferWhatsApp':
    case 'makeLiveOfferWhatsAppOnly':
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
  /** WhatsApp invitations in place of texts (sc-45251), and their credits at each guest's own country's rate. */
  whatsApp: number;
  whatsAppCredits: number;
}

/** Who has agreed to WhatsApp in the states that send it, and the category Meta approved the template in. */
const WHATSAPP: Partial<Record<MakeLiveState, { category: Category; agreed: readonly string[] }>> =
  {
    makeLiveOfferWhatsApp: { category: 'marketing', agreed: ['funke', 'wumi-lawal'] },
    makeLiveOfferWhatsAppOnly: {
      category: 'utility',
      agreed: ['funke', 'toyin-fashola', 'wumi-lawal'],
    },
  };

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

  const wa = state == null ? undefined : WHATSAPP[state];
  const phones = guests.filter((one) => one.phone != null);
  const byWhatsApp = phones.filter(
    (one) =>
      wa != null &&
      wa.agreed.includes(one.id) &&
      !(wa.category === 'marketing' && one.phone?.country === 'US'),
  );

  return {
    count: guests.length,
    reached: guests.filter((one) => one.email != null || one.phone != null).length,
    texts: phones.length - byWhatsApp.length,
    emails: guests.filter((one) => one.email != null).length,
    balance: (state == null ? undefined : BALANCE[state]) ?? 250,
    whatsApp: byWhatsApp.length,
    whatsAppCredits:
      wa == null
        ? 0
        : byWhatsApp.reduce(
            (sum, one) => sum + whatsAppCreditsIn(one.phone?.country ?? '', wa.category),
            0,
          ),
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

/** The credits line's three forms (sc-45251): texts, texts and WhatsApp messages, or WhatsApp messages. */
function usesKey(texts: number, whatsApp: number) {
  if (whatsApp === 0) return 'textsUse' as const;

  return texts === 0 ? ('whatsAppUse' as const) : ('textsAndWhatsAppUse' as const);
}

/** Messaging B's credits line when the texts are covered; sc-3963's wait part when they are not, after what goes now. */
export function costOf(offer: Offer): Cost {
  const { texts, balance, whatsAppCredits } = offer;
  const credits = texts + whatsAppCredits;

  if (credits === 0) return { credits: null, either: null, waits: null };
  if (balance >= credits)
    return {
      credits: `${mw.many(usesKey(texts, whatsAppCredits), credits)} ${mw.filled(MW.creditsAfter, { count: balance - credits })}`,
      either: null,
      waits: null,
    };
  if (whatsAppCredits > 0)
    return {
      credits: null,
      either: offer.emails > 0 ? WW.eitherWay : null,
      waits: [
        mw.many('whatsAppWaits', offer.whatsApp),
        ...(texts > 0 ? [mw.many('smsWaits', texts)] : []),
      ].join(' '),
    };

  return {
    credits: balance > 0 ? mw.many('textsUse', balance) : null,
    either: offer.emails > 0 ? WW.eitherWay : null,
    waits: mw.many('smsWaits', texts - balance),
  };
}
