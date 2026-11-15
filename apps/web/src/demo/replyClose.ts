import { instantOf } from './events.ts';

export const CLOSES_AT = '23:59';

/** sc-3780's one rule for "are replies closed": the end of the Reply by day, 23:59:59 in the event's zone, whatever the clocks do. */
export function closingInstant(date: string, timeZone: string): string | null {
  const minute = instantOf(date, CLOSES_AT, timeZone);

  return minute == null
    ? null
    : new Date(Date.parse(minute) + 59_000).toISOString().replace('.000Z', 'Z');
}

export function repliesOpen(now: Date, date: string | null, timeZone: string): boolean {
  const closes = date == null ? null : closingInstant(date, timeZone);

  return closes == null || now.getTime() <= Date.parse(closes);
}
