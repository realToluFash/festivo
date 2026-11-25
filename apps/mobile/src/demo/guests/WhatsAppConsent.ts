import { HOW_AGREED, W, say } from './GuestsWords.ts';

/** sc-3950 on a guest's page (whatsapp-consent-spec §2): who sees the WhatsApp row, what it reads, and the one required answer. */
export type HowAgreed = (typeof HOW_AGREED)[number];

export type WhatsAppConsent =
  | { kind: 'none' }
  | { kind: 'host'; by: string; how: HowAgreed; day: string }
  | { kind: 'guest'; day: string }
  | { kind: 'optedOut'; day: string };

export const NO_CONSENT: WhatsAppConsent = { kind: 'none' };

export interface WhatsAppRow {
  title: string;
  /** The guest agreed to WhatsApp under it: only while nothing is in force and the guest has not opted out. */
  agree: boolean;
  /** Opted out (pm, 10 Nov): in the WhatsApp label's place, since only the guest can agree again. */
  note: string | null;
}

/** Only with a mobile number, and only for someone who can edit guests; a view-only role sees neither. */
export function whatsAppRowOf(
  consent: WhatsAppConsent | undefined,
  who: { mobile: boolean; edits: boolean },
  day: (iso: string) => string,
): WhatsAppRow | null {
  if (!who.mobile || !who.edits) return null;
  const now = consent ?? NO_CONSENT;

  switch (now.kind) {
    case 'none':
      return { title: W.notAgreed, agree: true, note: null };
    case 'host':
      return {
        title: say.agreedHost[now.how](now.by, day(now.day)),
        agree: false,
        note: null,
      };
    case 'guest':
      return { title: say.agreedOn(day(now.day)), agree: false, note: null };
    case 'optedOut':
      return { title: say.optedOut(day(now.day)), agree: false, note: say.onlyTheGuest };
  }
}

/** How? is required: Save with none sends nothing and says why. */
export function howAgreedProblem(how: HowAgreed | null): string | null {
  return how == null ? W.howAgreedBlank : null;
}

export function hostAgreed(by: string, how: HowAgreed, day: string): WhatsAppConsent {
  return { kind: 'host', by, how, day };
}
