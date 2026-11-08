import { formatWallClock, formatWallDay } from '@soirely/domain';

import { COUNTS, WEDDING, replyByOf } from '../guests/GuestsSample.ts';
import { instantOf, wallOf } from './EventsModel.ts';
import { W, say } from './EventsWords.ts';

/** sc-3780: the date replies close on, a day in the event's zone; replies close at its end. */
export type ReplyByAsk = 'sooner' | 'now';

export const CLOSES_AT = '23:59';

/** Guests' own sample: only the wedding has a Reply by date, and its No reply count (sc-99). */
export function startReplyBy(eventId: string): string | null {
  return replyByOf(eventId);
}

export function noReplyOf(eventId: string): { guests: number; companions: number } {
  return eventId === WEDDING
    ? { guests: COUNTS.noreply, companions: COUNTS.heldBehindNoReply }
    : { guests: 0, companions: 0 };
}

/** As Guests' card counts it: the guests with no answer, and the companions held behind them. */
export function notRepliedWords(eventId: string): string {
  const { guests, companions } = noReplyOf(eventId);

  return say.notReplied(guests, companions);
}

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);

  return day.toISOString().slice(0, 10);
}

/** The last second of the day in the event's zone, whatever the clocks do that night. */
export function closesAt(date: string, timeZone: string): Date {
  return new Date(Date.parse(instantOf(nextDay(date), '00:00', timeZone)) - 1000);
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

export function shortDay(date: string, locale: string): string {
  return formatWallDay(date, locale);
}
