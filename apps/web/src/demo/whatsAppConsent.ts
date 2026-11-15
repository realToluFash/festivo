import { GW } from './guestsWords.ts';

/** sc-3950 on a guest's page (whatsapp-consent-spec §2): who sees the WhatsApp row, what it reads, and the one required answer. */
export const HOW_AGREED = ['In person', 'By phone', 'In writing'] as const;

export type HowAgreed = (typeof HOW_AGREED)[number];

export type WhatsAppConsent =
  | { kind: 'none' }
  | { kind: 'host'; by: string; how: HowAgreed; on: string }
  | { kind: 'guest'; on: string }
  | { kind: 'optedOut'; on: string };

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
  consent: WhatsAppConsent,
  who: { mobile: boolean; edits: boolean },
  day: (iso: string) => string,
): WhatsAppRow | null {
  if (!who.mobile || !who.edits) return null;

  switch (consent.kind) {
    case 'none':
      return { title: GW.notAgreed, agree: true, note: null };
    case 'host':
      return {
        title: GW.agreedHost[consent.how](consent.by, day(consent.on)),
        agree: false,
        note: null,
      };
    case 'guest':
      return { title: GW.agreedOn(day(consent.on)), agree: false, note: null };
    case 'optedOut':
      return { title: GW.optedOut(day(consent.on)), agree: false, note: GW.onlyTheGuest };
  }
}

/** How? is required: Save with none sends nothing and says why. */
export function howAgreedProblem(how: HowAgreed | null): string | null {
  return how == null ? GW.howAgreedBlank : null;
}

export function hostAgreed(by: string, how: HowAgreed, on: string): WhatsAppConsent {
  return { kind: 'host', by, how, on };
}
