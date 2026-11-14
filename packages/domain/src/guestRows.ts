import type { Guest } from '@soirely/api-client';
import { type Translate } from './eventWords.ts';
import { type ReplyWord, blank, namedCount, shownReply } from './guestForm.ts';
import { type Person } from './guestView.ts';
import { formatPhone } from './phone.ts';

export const REPLY_KEY: Record<ReplyWord, string> = {
  coming: 'guestList.reply.coming',
  maybe: 'guestList.reply.maybe',
  notComing: 'guestList.reply.notComing',
  noReply: 'guestList.reply.noReply',
  held: 'guestList.reply.held',
  notYetInvited: 'guestList.reply.notYetInvited',
};

export function replyDate(repliedAt: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone }).format(
    new Date(repliedAt),
  );
}

/** A companion left blank is "Guest of <host>", numbered from the second blank one. */
export function companionShown(
  t: Translate,
  host: string,
  names: readonly (string | null)[],
  at: number,
): string {
  const name = names[at];

  if (!blank(name ?? null)) return (name ?? '').trim();
  const nth = names.slice(0, at + 1).filter((one) => blank(one)).length;

  return nth > 1 ? t('guestList.guestOfNth', { host, nth }) : t('guestList.guestOf', { host });
}

/** The email address and the mobile number, for those who are sent them; null when the guest has neither. */
export function contactOf(t: Translate, guest: Guest): string | null {
  const mobile = guest.mobile == null ? null : formatPhone(guest.mobile);

  return guest.email != null && mobile != null
    ? t('guestList.contacts', { email: guest.email, mobile })
    : (guest.email ?? mobile);
}

/** A row's name and the line under it: a guest's reply and when, their places when shown or else how they were invited, then their contact; a companion's own standing. */
export function rowWords(
  t: Translate,
  { guest, companion, at }: Person,
  indent: boolean,
  timeZone: string,
  locale: string,
  placesShown: boolean,
  invitation: string | null = null,
): { name: string; line: string } {
  if (companion == null) {
    const word = t(REPLY_KEY[shownReply(guest)]);
    const reply =
      guest.repliedAt == null
        ? word
        : t('guestList.replied', {
            reply: word,
            date: replyDate(guest.repliedAt, timeZone, locale),
          });
    const places = guest.companions.length;
    const line = !placesShown
      ? (invitation ?? reply)
      : places === 0
        ? reply
        : t('guestList.withPlaces', {
            reply,
            places: t('guestList.companionsNamed', {
              count: places,
              named: namedCount(guest.companions.map((one) => one.fullName)),
            }),
          });
    const contact = contactOf(t, guest);

    return {
      name: guest.fullName,
      line: contact == null ? line : t('guestList.line', { reply: line, contact }),
    };
  }

  const name = companionShown(
    t,
    guest.fullName,
    guest.companions.map((one) => one.fullName),
    at,
  );
  const hostShown = t('guestList.guestOf', { host: guest.fullName });
  const away = !indent && companion.fullName != null;
  const line =
    companion.state === 'held'
      ? away
        ? t('guestList.heldAway', { guestOf: hostShown, held: t('guestList.heldLine') })
        : t('guestList.heldLine')
      : away
        ? hostShown
        : t(REPLY_KEY[companion.state]);

  return { name, line };
}
