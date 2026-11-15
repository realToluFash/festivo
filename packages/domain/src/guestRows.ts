import { ApiError, GUEST_ANSWERS, type Guest, type GuestAnswer } from '@soirely/api-client';
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

/** What a 409 `guest_replied` on Mark as not invited names: the reply that keeps them invited and when (sc-3788). */
export function repliedRefusal(error: unknown): { reply: GuestAnswer; at: string } | null {
  if (!(error instanceof ApiError) || !error.is('guest_replied')) return null;
  const reply = GUEST_ANSWERS.find((known) => known === error.problem.reply);
  const at = error.problem.repliedAt;

  return reply == null || at == null ? null : { reply, at };
}

/** The guest's one Invitation line (sc-3788): by hand, by Soirely's message, or when they replied; null while Not yet invited. */
export function invitationLine(
  t: Translate,
  guest: Pick<Guest, 'invitation'>,
  timeZone: string,
  locale: string,
): string | null {
  const invitation = guest.invitation;
  if (invitation == null) return null;
  const date = replyDate(invitation.at, timeZone, locale);

  switch (invitation.how) {
    case 'soirelyMessage':
      return t('guestList.invitedByMessage', { date });
    case 'reply':
      return t('guestList.invitedWhenReplied', { date });
    default: {
      const how = t(`guestList.howMid.${invitation.how}`);

      return invitation.by == null
        ? t('guestList.invitedHow', { how, date })
        : t('guestList.invitedBy', { name: invitation.by, how, date });
    }
  }
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

/** How a guest's row says them: their companions named as the web says them, counted alone as the app's demo draws them, or not at all; with or without their contact. */
export interface RowLine {
  places: 'named' | 'counted' | null;
  contact: boolean;
  /** In place of the reply, as the No reply filter says how each guest was invited. */
  invitation?: string | null;
  /** The app's row says the group after the reply, a companion's being their host's (sc-5519); the web shows it as a tag. */
  group?: boolean;
}

/** A row's name and the line under it: a guest's reply and when, or how they were invited, then their places and their contact as `shown` asks; a companion's own standing. */
export function rowWords(
  t: Translate,
  { guest, companion, at }: Person,
  indent: boolean,
  timeZone: string,
  locale: string,
  shown: RowLine,
): { name: string; line: string } {
  if (companion == null) {
    const word = t(REPLY_KEY[shownReply(guest)]);
    const reply =
      shown.invitation ??
      (guest.repliedAt == null
        ? word
        : t('guestList.replied', {
            reply: word,
            date: replyDate(guest.repliedAt, timeZone, locale),
          }));
    const line = withPlaces(t, withGroup(t, reply, guest, shown), guest, shown.places);
    const contact = shown.contact ? contactOf(t, guest) : null;

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

  return { name, line: withGroup(t, line, guest, shown) };
}

function withGroup(t: Translate, reply: string, guest: Guest, shown: RowLine): string {
  return shown.group === true && guest.group != null
    ? t('guestList.withGroup', { reply, group: guest.group.name })
    : reply;
}

function withPlaces(t: Translate, reply: string, guest: Guest, places: RowLine['places']): string {
  const count = guest.companions.length;
  if (places == null || count === 0) return reply;

  return t('guestList.withPlaces', {
    reply,
    places:
      places === 'counted'
        ? t('guestList.countCompanions', { count })
        : t('guestList.companionsNamed', {
            count,
            named: namedCount(guest.companions.map((one) => one.fullName)),
          }),
  });
}
