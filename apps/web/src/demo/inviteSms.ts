import { demoWords } from './demoWords.ts';
import { type Guest, WEDDING, invitationLine, replyByOf } from './guests.ts';
import { IW } from './messagesInviteWords.ts';
import type { OneGuest } from './messagesTo.ts';

/** The invitation's text message (sc-3971): its words, and its parts with the link as built (sc-1526, sc-3946). */
const iw = demoWords(IW);

const WEEKDAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** sc-1526's link as built: the address and a 256-bit token in base64url. */
/** Where each guest's own link goes in a message's words. */
export const THEIR_LINK = '[their own link]';
export const LINK_CHARS = 'https://soirely.com/i/'.length + Math.ceil(256 / 6);
export const REPLY_BY = WEEKDAY.format(new Date(`${replyByOf(WEDDING) ?? '2026-11-04'}T12:00:00Z`));

export function oneGuestOf(guest: Guest): OneGuest {
  return {
    id: guest.id,
    name: guest.name,
    greetAs: guest.greetAs,
    email: guest.email != null,
    mobile: guest.phone != null,
    invited: invitationLine(guest),
  };
}

export function greetingOf(guest: OneGuest): string {
  return guest.greetAs ?? guest.name;
}

const GSM_7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_7_TWICE = '^{}\\[~]|€';

/** How many parts a text is sent in: GSM-7 to 160 characters, then 153 a part; any other character makes it UCS-2, 70 then 67. */
export function smsParts(text: string): number {
  const chars = [...text];
  const gsm = chars.every((one) => GSM_7.includes(one) || GSM_7_TWICE.includes(one));

  if (!gsm) return chars.length <= 70 ? 1 : Math.ceil(chars.length / 67);

  const length = chars.reduce((sum, one) => sum + (GSM_7_TWICE.includes(one) ? 2 : 1), 0);

  return length <= 160 ? 1 : Math.ceil(length / 153);
}

export interface SmsAbout {
  hosts: string;
  event: string;
  date: string;
  replyBy: string | null;
}

export interface InviteSms {
  text: string;
  /** Its length with the link as built. */
  chars: number;
  parts: number;
}

/** The invitation's text to one guest, in plain punctuation, its first text to a number ending on the STOP line; counted with their link as built. */
export function inviteSmsOf(guest: OneGuest, about: SmsAbout, first = true): InviteSms {
  const { replyBy, ...rest } = about;
  const values = { ...rest, greeting: greetingOf(guest), link: THEIR_LINK };
  const words = (
    replyBy == null ? iw.filled(IW.smsNoDate, values) : iw.filled(IW.sms, { ...values, replyBy })
  ).replaceAll('’', "'");
  const text = first ? `${words}\n${IW.smsStop}` : words;
  const built = text.replace(THEIR_LINK, 'x'.repeat(LINK_CHARS));

  return { text, chars: [...built].length, parts: smsParts(built) };
}
