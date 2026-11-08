import { formatWallClock, formatWallDay } from '@soirely/domain';

import { COUNTS, WEDDING } from '../guests/GuestsSample.ts';
import { instantOf, wallOf } from './EventsModel.ts';
import { W, say } from './EventsWords.ts';

/** sc-3780: the date replies close on, a day in the event's zone; replies close at its end. */
export type ReplyByAsk = 'sooner' | 'now';

export const CLOSES_AT = '23:59';

export function noReplyOf(eventId: string): { guests: number; companions: number } {
  return eventId === WEDDING
    ? { guests: COUNTS.noreply, companions: COUNTS.heldBehindNoReply }
    : { guests: 0, companions: 0 };
}

/** Guests' card's own count sentence (l10n, #33419): the guests with no answer, and the companions held behind them. */
export function notRepliedLine(eventId: string): string {
  const { guests, companions } = noReplyOf(eventId);

  return say.notRepliedLine(guests, companions);
}

function dayAfter(date: string, days = 1): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);

  return day.toISOString().slice(0, 10);
}

/** pm, 8 Nov: a start moved onto or before Reply by moves it to the day before the new start. */
export function replyByAfterStart(replyBy: string | null, startDate: string): string | null {
  return replyBy != null && startDate <= replyBy ? dayAfter(startDate, -1) : null;
}

export function replyByMoves(replyBy: string, moved: string, locale: string): string {
  return say.replyByMoves(formatWallDay(replyBy, locale), formatWallDay(moved, locale));
}

export function replyByMovedSaved(moved: string, locale: string): string {
  return say.repliesNowClose(formatWallDay(moved, locale));
}

/** The last second of the day in the event's zone, whatever the clocks do that night. */
export function closesAt(date: string, timeZone: string): Date {
  return new Date(Date.parse(instantOf(dayAfter(date), '00:00', timeZone)) - 1000);
}

export function todayIn(now: Date, timeZone: string): string {
  return wallOf(now.toISOString(), timeZone).date;
}

/** On or after the start's own day is refused before anything is sent. */
export function replyByWrong(date: string | null, startsAt: string, timeZone: string): boolean {
  return date != null && date >= wallOf(startsAt, timeZone).date;
}

/** Closing replies sooner asks first: a past date closes them now; an earlier day still to come closes them sooner. */
export function replyByAsk(
  saved: string | null,
  next: string | null,
  today: string,
  noReply: { guests: number; companions: number },
): ReplyByAsk | null {
  if (next == null || noReply.guests + noReply.companions === 0) return null;
  if (next < today) return 'now';
  if (saved != null && next < saved) return 'sooner';

  return null;
}

function longDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** The row on the event's page: the date over its label, or what happens with none. */
export function replyByRow(
  date: string | null,
  timeZone: string,
  locale: string,
): { title: string; line: string } {
  if (date == null) return { title: W.replyByNone, line: W.replyBy };

  return {
    title: new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`)),
    line: `${W.replyBy} · ${say.repliesCloseAt(formatWallClock(CLOSES_AT, locale), timeZone)}`,
  };
}

export function replyByHint(timeZone: string, locale: string): string {
  return say.replyByHint(formatWallClock(CLOSES_AT, locale), timeZone);
}

/** What the guest's page will say, before anything is saved: only for a day still to come, since a past one reads closed. */
export function previewsReplyBy(date: string | null, today: string): boolean {
  return date != null && date >= today;
}

export function replyByPreview(date: string, locale: string): string {
  return say.onGuestsPage(say.pleaseAnswerBy(longDay(date, locale)));
}

export function replyBySaved(date: string | null, timeZone: string, locale: string): string {
  return date == null
    ? W.replyByRemoved
    : say.replyBySaved(formatWallDay(date, locale), formatWallClock(CLOSES_AT, locale), timeZone);
}
