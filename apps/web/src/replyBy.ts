import {
  type ReplyByCheck,
  replyByAfterStart as afterStart,
  replyByCheck as checkDays,
  formatEventClock,
  wallDay,
} from '@soirely/domain';

export type { ReplyByCheck };

/** `replyByCheck` of packages/domain, from the start's and the clock's moments; the demo calls it so. */
export function replyByCheckAt({
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
  return checkDays({
    next,
    saved: was,
    startDay: wallDay(startsAt, timeZone),
    today: wallDay(now, timeZone),
    havent: noReply,
  });
}

/** The guests' sentence is shown only for a date they can still answer by: today or later, before the start. */
export function showsPreview(next: string | null, check: ReplyByCheck, today: string): boolean {
  return next != null && check !== 'tooLate' && next >= today;
}

/** `replyByAfterStart` of packages/domain, from the start's moment; the demo calls it so. */
export function replyByAfterStart(
  replyBy: string | null,
  startsAt: string,
  timeZone: string,
): string | null {
  return afterStart(replyBy, wallDay(startsAt, timeZone));
}

/** Dates asks the Reply by part's own question before a moved Reply by closes replies sooner; the demo calls it so. */
export function datesAsk({
  moved,
  ...rest
}: {
  moved: string | null;
  was: string | null;
  startsAt: string;
  now: Date;
  timeZone: string;
  noReply: number;
}): 'sooner' | 'now' | null {
  if (moved == null) return null;
  const check = replyByCheckAt({ next: moved, ...rest });

  return check === 'sooner' || check === 'now' ? check : null;
}

/** 23:59, the end of the Reply by day, on the reader's clock. */
export function closesAtClock(locale: string): string {
  return formatEventClock('2000-01-01T23:59:00Z', 'UTC', locale);
}
