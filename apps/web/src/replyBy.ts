import { type OrganisationEvent } from '@soirely/api-client';
import { formatEventClock, wallDay } from '@soirely/domain';

export type ReplyByCheck = 'tooLate' | 'sooner' | 'now' | 'save';

/** Before anything is sent: a date on or after the start is refused; closing sooner or now asks, unless nobody is left to reply. */
export function replyByCheck({
  next,
  was,
  startsAt,
  now,
  timeZone,
  noReply,
}: {
  next: string | null;
  was: string | null;
  startsAt: string;
  now: Date;
  timeZone: string;
  noReply: number;
}): ReplyByCheck {
  if (next == null) return 'save';
  if (next >= wallDay(startsAt, timeZone)) return 'tooLate';
  if (noReply === 0) return 'save';
  if (next < wallDay(now, timeZone)) return 'now';
  if (was != null && next < was) return 'sooner';

  return 'save';
}

/** The guests' sentence is shown only for a date they can still answer by: today or later, before the start. */
export function showsPreview(next: string | null, check: ReplyByCheck, today: string): boolean {
  return next != null && check !== 'tooLate' && next >= today;
}

/** pm, 8 Nov: a start moved to or before the Reply by day moves Reply by to the day before it; a later start leaves it. */
export function replyByAfterStart(
  replyBy: string | null,
  startsAt: string,
  timeZone: string,
): string | null {
  const startDay = wallDay(startsAt, timeZone);
  if (replyBy == null || replyBy < startDay) return null;

  return new Date(Date.parse(`${startDay}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** pm, 8 Nov: Dates asks the Reply by part's own question, by the same rule, before a moved Reply by closes replies sooner. */
export function datesAsk({
  moved,
  was,
  startsAt,
  now,
  timeZone,
  noReply,
}: {
  moved: string | null;
  was: string | null;
  startsAt: string;
  now: Date;
  timeZone: string;
  noReply: number;
}): 'sooner' | 'now' | null {
  if (moved == null) return null;
  const check = replyByCheck({ next: moved, was, startsAt, now, timeZone, noReply });

  return check === 'sooner' || check === 'now' ? check : null;
}

/** sc-3780's one rule: closed from 23:59:59 on the Reply by day in the event's zone, as the server says on load and the clock says after. */
export function repliesClosed(event: OrganisationEvent, now: Date): boolean {
  if (event.repliesClosedOn != null) return true;
  const closes = event.repliesCloseAt ?? null;

  return closes != null && now.getTime() > Date.parse(closes);
}

/** 23:59, the end of the Reply by day, on the reader's clock. */
export function closesAtClock(locale: string): string {
  return formatEventClock('2000-01-01T23:59:00Z', 'UTC', locale);
}
