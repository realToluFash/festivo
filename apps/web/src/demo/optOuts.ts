import type { Phone } from './guests.ts';
import { GW } from './guestsWords.ts';
import type { WhatsAppConsent } from './whatsAppConsent.ts';

/** sc-3969: the channels a guest unsubscribed from, each with the address it was recorded on. */
export interface OptOuts {
  email: { address: string; on: string } | null;
  texts: { phone: Phone; on: string } | null;
}

export const NO_OPT_OUTS: OptOuts = { email: null, texts: null };

export interface OptOutRow {
  title: string;
  note: string | null;
}

export interface OptOutRows {
  email: OptOutRow | null;
  texts: OptOutRow | null;
}

const NO_ROWS: OptOutRows = { email: null, texts: null };

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function samePhone(a: Phone, b: Phone): boolean {
  return a.country === b.country && a.number.replace(/\s+/gu, '') === b.number.replace(/\s+/gu, '');
}

/** Only for someone who can edit guests, under the address it was recorded on; an opted-out WhatsApp row carries the texts' closing sentence. */
export function optOutRowsOf(
  guest: {
    email: string | null;
    phone: Phone | null;
    whatsApp: WhatsAppConsent;
    optOuts: OptOuts;
  },
  who: { edits: boolean },
  day: (iso: string) => string,
): OptOutRows {
  if (!who.edits) return NO_ROWS;
  const { email, texts } = guest.optOuts;

  return {
    email:
      email != null && guest.email != null && sameAddress(guest.email, email.address)
        ? { title: GW.optedOutEmail(day(email.on)), note: GW.onlyTheGuest }
        : null,
    texts:
      texts != null && guest.phone != null && samePhone(guest.phone, texts.phone)
        ? {
            title: GW.optedOutTexts(day(texts.on)),
            note: guest.whatsApp.kind === 'optedOut' ? null : GW.onlyTheGuest,
          }
        : null,
  };
}
