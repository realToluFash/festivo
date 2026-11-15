import { say } from './GuestsWords.ts';
import type { WhatsAppConsent } from './WhatsAppConsent.ts';

/** sc-3969: the channels a guest unsubscribed from, each with the address it was recorded on. */
export interface OptOuts {
  email: { address: string; day: string } | null;
  texts: { phone: string; day: string } | null;
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

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const samePhone = (a: string, b: string) => a.replace(/\s+/gu, '') === b.replace(/\s+/gu, '');

/** Only for someone who can edit guests, under the address it was recorded on; an opted-out WhatsApp row carries the texts' closing sentence. */
export function optOutRowsOf(
  g: {
    email: string | null;
    phone: string | null;
    whatsApp?: WhatsAppConsent;
    optOuts?: OptOuts;
  },
  who: { edits: boolean },
  day: (iso: string) => string,
): OptOutRows {
  if (!who.edits) return NO_ROWS;
  const { email, texts } = g.optOuts ?? NO_OPT_OUTS;

  return {
    email:
      email != null && g.email != null && sameAddress(g.email, email.address)
        ? { title: say.optedOutEmail(day(email.day)), note: say.onlyTheGuest }
        : null,
    texts:
      texts != null && g.phone != null && samePhone(g.phone, texts.phone)
        ? {
            title: say.optedOutTexts(day(texts.day)),
            note: g.whatsApp?.kind === 'optedOut' ? null : say.onlyTheGuest,
          }
        : null,
  };
}

/** The guest's unsubscribe from email or texts on the given days, recorded on the address they have now. */
export function withOptOuts<
  G extends { email: string | null; phone: string | null; optOuts?: OptOuts },
>(g: G, days: { email?: string; texts?: string }): G {
  const was = g.optOuts ?? NO_OPT_OUTS;

  return {
    ...g,
    optOuts: {
      email:
        days.email != null && g.email != null ? { address: g.email, day: days.email } : was.email,
      texts:
        days.texts != null && g.phone != null ? { phone: g.phone, day: days.texts } : was.texts,
    },
  };
}
