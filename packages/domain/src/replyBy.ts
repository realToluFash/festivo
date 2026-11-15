import { addDays } from './calendar.ts';
import { type Translate } from './eventWords.ts';
import { type Counts } from './guestView.ts';

/** What an event says of its Reply by (sc-3780): the day, the instant replies close, and the day a save closed them. */
export interface ReplyDated {
  replyBy?: string | null;
  repliesCloseAt?: string | null;
  repliesClosedOn?: string | null;
}

export type ReplyByAsk = 'sooner' | 'now';

export type ReplyByCheck = 'tooLate' | ReplyByAsk | 'save';

/** The one rule of 8 Nov, as `ReplyDeadline::passedAt`: closed from 23:59:59 on the Reply by day, at once after Close replies now. */
export function repliesClosed(event: ReplyDated, now: Date): boolean {
  if (event.repliesClosedOn != null) return true;
  if (event.repliesCloseAt == null) return false;

  return now.getTime() >= Date.parse(event.repliesCloseAt);
}

/** The day replies closed: the save's when a save closed them, else the Reply by day itself; null while they are open. */
export function closedOn(event: ReplyDated, now: Date): string | null {
  if (!repliesClosed(event, now)) return null;

  return event.repliesClosedOn ?? event.replyBy ?? null;
}

/** Closing replies sooner asks first, and only while somebody has still to reply: a past day closes them now. */
export function replyByAsk(
  saved: string | null,
  next: string | null,
  today: string,
  havent: number,
): ReplyByAsk | null {
  if (next == null || havent === 0) return null;
  if (next < today) return 'now';
  if (saved != null && next < saved) return 'sooner';

  return null;
}

/** Before anything is sent: a day on or after the start's is refused, then `replyByAsk`. Days are the event zone's. */
export function replyByCheck({
  next,
  saved,
  startDay,
  today,
  havent,
}: {
  next: string | null;
  saved: string | null;
  startDay: string;
  today: string;
  havent: number;
}): ReplyByCheck {
  if (next != null && next >= startDay) return 'tooLate';

  return replyByAsk(saved, next, today, havent) ?? 'save';
}

/** pm, 8 Nov: a start moved to or before the Reply by day moves Reply by to the day before it; a later start leaves it. */
export function replyByAfterStart(replyBy: string | null, startDay: string): string | null {
  return replyBy != null && startDay <= replyBy ? addDays(startDay, -1) : null;
}

/** Guests' card's count sentence (l10n, #33419): "25 haven’t replied (21 guests and 4 companions).", the bracket only with a companion among them. */
export function haventLine(
  t: Translate,
  counts: Pick<Counts, 'havent' | 'haventGuests' | 'haventCompanions'>,
): string {
  if (counts.havent === 0) return t('guestList.everyoneReplied');
  const havent = t('guestList.havent', { count: counts.havent });

  return counts.haventCompanions === 0
    ? t('guestList.haventLine', { havent })
    : t('guestList.haventWho', {
        havent,
        guests: t('guestList.countGuests', { count: counts.haventGuests }),
        companions: t('guestList.countCompanions', { count: counts.haventCompanions }),
      });
}
