import { formatWallDay } from '@soirely/domain';

import { localDay } from './events.ts';
import { countsOf, haventLine, sampleGuests } from './guests.ts';
import { CLOSES_AT } from './replyClose.ts';

export {
  type ReplyByCheck,
  datesAsk,
  replyByAfterStart,
  replyByCheckAt,
  showsPreview,
} from '../replyBy.ts';

/** Who hasn't replied, in the Guests card's own sentence on the same sample (sc-99; l10n, #33419). */
export function haventRepliedOf(id: string): string {
  return haventLine(countsOf(sampleGuests(id)));
}

export function haventCountOf(id: string): number {
  return countsOf(sampleGuests(id)).havent;
}

/** After Dates saves: Tell guests is the answer when it opens, with the moved Reply by in it; otherwise the toast (ux, 8 Nov). */
export function datesSaveSays(
  moved: string | null,
  tellOpens: boolean,
): { toast: 'saved' | 'moved' | null; inTell: boolean } {
  if (tellOpens) return { toast: null, inTell: moved != null };

  return { toast: moved == null ? 'saved' : 'moved', inTell: false };
}

/** l10n, #33572: one sentence per Reply by state, wherever the save came from; a day already past closed replies at the save. */
export function replyBySays(
  next: string | null,
  now: Date,
  timeZone: string,
): { toast: string; line: string } {
  if (next == null) return { toast: REPLY_BY_WORDS.savedNone, line: REPLY_BY_WORDS.rowNone };
  if (next < localDay(now.toISOString(), timeZone))
    return { toast: REPLY_BY_WORDS.savedClosed, line: REPLY_BY_WORDS.nowClosed };
  const day = formatWallDay(next, LOCALE);

  return {
    toast: REPLY_BY_WORDS.saved(day, timeZone),
    line: REPLY_BY_WORDS.closesOn(day, timeZone),
  };
}

const LOCALE = 'en-US';

function noon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function rowDay(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(noon(date));
}

/** The board's English for Reply by (sc-3780's Design, 7 Nov), held in the demo until the product's screen puts it in the catalogues. */
export const REPLY_BY_WORDS = {
  replyBy: 'Reply by',
  rowCloses: (zone: string) => `Replies close at ${CLOSES_AT}, ${zone} time.`,
  rowClosed: 'Replies closed.',
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
  savedClosed: 'Saved. Replies are now closed.',
  closesOn: (date: string, zone: string) =>
    `Replies close on ${date} at ${CLOSES_AT}, ${zone} time.`,
  nowClosed: 'Replies are now closed.',
};
