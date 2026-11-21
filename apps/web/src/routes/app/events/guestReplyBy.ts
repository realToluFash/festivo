import { type Guest, type OrganisationEvent } from '@soirely/api-client';
import { REPLY_KEY, closedOn, formatWallDay, replyDate } from '@soirely/domain';
import { type TFunction } from 'i18next';

/** Reply by as Guests reads it (sc-3780); `closedOn` is the day replies closed, null while they are open. */
export interface Replies {
  replyBy: string | null;
  closedOn: string | null;
}

export function repliesOf(event: OrganisationEvent, now: Date): Replies {
  return { replyBy: event.replyBy ?? null, closedOn: closedOn(event, now) };
}

/** "asked to decide by Nov 4", for Not sure yet once there is a Reply by. */
export function decideBy(
  t: TFunction,
  guest: Pick<Guest, 'reply'>,
  replyBy: string | null,
  locale: string,
): string | null {
  if (guest.reply !== 'maybe' || replyBy == null) return null;

  return t('guestList.askedToDecide', { date: replyDate(`${replyBy}T12:00:00Z`, 'UTC', locale) });
}

/** The list row's "Not sure yet · asked to decide by Nov 4". */
export function decideRow(
  t: TFunction,
  guest: Pick<Guest, 'reply'>,
  replyBy: string | null,
  locale: string,
): string | null {
  if (guest.reply !== 'maybe' || replyBy == null) return null;

  return t('guestList.askedToDecideRow', {
    reply: t(REPLY_KEY[guest.reply]),
    date: replyDate(`${replyBy}T12:00:00Z`, 'UTC', locale),
  });
}

/** The guest's card once replies have closed, or once theirs was reopened; null leaves the card as it was. */
export function closedLine(
  t: TFunction,
  guest: Pick<Guest, 'repliesReopened'>,
  replies: Replies,
  manages: boolean,
  timeZone: string,
  locale: string,
): string | null {
  const reopened = guest.repliesReopened ?? null;

  if (reopened != null)
    return t('guestList.reopened', {
      name: reopened.by,
      date: replyDate(reopened.at, timeZone, locale),
    });
  if (replies.closedOn == null) return null;
  const date = formatWallDay(replies.closedOn, locale);

  return manages
    ? t('guestList.repliesClosed', { date })
    : t('guestList.repliesClosedOn', { date });
}
