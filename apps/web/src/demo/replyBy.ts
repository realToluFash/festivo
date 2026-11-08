import { localDay } from './events.ts';
import { countsOf, haventLine, sampleGuests } from './guests.ts';
import { CLOSES_AT } from './replyClose.ts';

/** Who hasn't replied, in the Guests card's own sentence on the same sample (sc-99; l10n, #33419). */
export function haventRepliedOf(id: string): string {
  return haventLine(countsOf(sampleGuests(id)));
}

/** pm, 8 Nov: Dates asks before a moved Reply by closes replies sooner, while anyone hasn't replied; now when it is already past. */
export function datesAsk(
  moved: string | null,
  id: string,
  now: Date,
  timeZone: string,
): 'sooner' | 'now' | null {
  if (moved == null || countsOf(sampleGuests(id)).havent === 0) return null;

  return moved < localDay(now.toISOString(), timeZone) ? 'now' : 'sooner';
}

/** After Dates saves: Tell guests is the answer when it opens, with the moved Reply by in it; otherwise the toast (ux, 8 Nov). */
export function datesSaveSays(
  moved: string | null,
  tellOpens: boolean,
): { toast: 'saved' | 'moved' | null; inTell: boolean } {
  if (tellOpens) return { toast: null, inTell: moved != null };

  return { toast: moved == null ? 'saved' : 'moved', inTell: false };
}

export type ReplyByCheck = 'tooLate' | 'sooner' | 'now' | 'save';

/** Before anything is sent: a date on or after the start is refused; closing sooner or now is asked first. */
export function replyByCheck({
  next,
  was,
  startsAt,
  now,
  timeZone,
}: {
  next: string | null;
  was: string | null;
  startsAt: string;
  now: Date;
  timeZone: string;
}): ReplyByCheck {
  if (next == null) return 'save';
  if (next >= localDay(startsAt, timeZone)) return 'tooLate';
  if (next < localDay(now.toISOString(), timeZone)) return 'now';
  if (was != null && next < was) return 'sooner';

  return 'save';
}

/** The guests' sentence is shown only for a date they can still answer by: today or later, before the start. */
export function showsPreview(next: string | null, check: ReplyByCheck): boolean {
  return next != null && (check === 'save' || check === 'sooner');
}

const LOCALE = 'en-US';

function noon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** "Wed, Nov 4, 2026", the row's title. */
export function rowDay(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(noon(date));
}

/** pm, 8 Nov: a start moved to or before the Reply by day moves Reply by to the day before it; a later start leaves it. */
export function replyByAfterStart(
  replyBy: string | null,
  startsAt: string,
  timeZone: string,
): string | null {
  const startDay = localDay(startsAt, timeZone);
  if (replyBy == null || replyBy < startDay) return null;

  return new Date(Date.parse(`${startDay}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** The board's English for Reply by (sc-3780's Design, 7 Nov), held in the demo until the product's screen puts it in the catalogues. */
export const REPLY_BY_WORDS = {
  replyBy: 'Reply by',
  rowCloses: (zone: string) => `Replies close at ${CLOSES_AT}, ${zone} time.`,
  rowNone: 'Replies stay open until the event starts.',
  hint: (zone: string) =>
    `Replies close at the end of this day, ${CLOSES_AT} ${zone} time. Leave it empty and replies stay open until the event starts.`,
  remove: 'Remove the date',
  preview: (sentence: string) => `On the guests’ page: “${sentence}”`,
  tooLate: 'Choose a date before the event starts.',
  soonerTitle: (date: string) => `Close replies sooner, on ${date}?`,
  soonerLine: 'After that day they can’t reply, unless you let them change their reply.',
  sooner: 'Close replies sooner',
  nowTitle: 'Close replies now?',
  nowLine: 'From now on they can’t reply, unless you let them change their reply.',
  now: 'Close replies now',
  keep: (date: string) => `Keep ${date}`,
  saved: (date: string, zone: string) =>
    `Saved. Replies close on ${date} at ${CLOSES_AT}, ${zone} time.`,
  savedNone: 'Saved. Replies stay open until the event starts.',
  startMoves: (old: string, next: string) =>
    `Replies close on ${old}, which isn’t before the new start. Saving moves Reply by to ${next}.`,
  nowClose: (next: string) => `Replies now close ${next}.`,
  savedMoved: (next: string) => `Saved. Replies now close ${next}.`,
};
