import { instantOf, localDay } from './events.ts';

/** sc-3780's date to reply by, per event: the wedding's Wed, Nov 4 (as the Guests demo has it), and who hasn't replied as its card counts them. */
export const REPLY_BY_SAMPLE: Readonly<
  Record<string, { date: string | null; noReply: number; held: number }>
> = {
  'evt-wed-4': { date: '2026-11-04', noReply: 21, held: 4 },
};

export function replyByOf(id: string): string | null {
  return REPLY_BY_SAMPLE[id]?.date ?? null;
}

export function noReplyOf(id: string): { guests: number; companions: number } {
  const one = REPLY_BY_SAMPLE[id];

  return { guests: one?.noReply ?? 0, companions: one?.held ?? 0 };
}

export const CLOSES_AT = '23:59';

/** Replies close at the end of the day in the event's zone, 23:59:59 local, whatever the clocks do that day. */
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

/** "Wed, Nov 4", in the asks and the saved line. */
export function shortDay(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(noon(date));
}

/** The board's English for Reply by (sc-3780's Design, 7 Nov), held in the demo until the product's screen puts it in the catalogues. */
export const REPLY_BY_WORDS = {
  /** As the Guests card counts them: "21 guests and 4 of their companions" (pm, 8 Nov). */
  who: ({ guests, companions }: { guests: number; companions: number }) => {
    const figure = new Intl.NumberFormat(LOCALE);
    const said = `${figure.format(guests)} ${guests === 1 ? 'guest' : 'guests'}`;

    return companions === 0 ? said : `${said} and ${figure.format(companions)} of their companions`;
  },
  replyBy: 'Reply by',
  rowCloses: (zone: string) => `Replies close at ${CLOSES_AT}, ${zone} time`,
  rowNone: 'Replies stay open until the event starts',
  hint: (zone: string) =>
    `Replies close at the end of this day, ${CLOSES_AT} ${zone} time. Leave it empty and replies stay open until the event starts.`,
  remove: 'Remove the date',
  preview: (sentence: string) => `On the guests’ page: “${sentence}”`,
  tooLate: 'Choose a date before the event starts.',
  soonerTitle: (date: string, who: string) =>
    `Close replies sooner, on ${date}, for ${who} who haven’t replied?`,
  soonerLine: 'After that day they can’t answer, unless you let them change their reply.',
  sooner: 'Close replies sooner',
  nowTitle: (who: string) => `Close replies now for ${who} who haven’t replied?`,
  nowLine: 'They can’t answer from now on, unless you let them change their reply.',
  now: 'Close replies now',
  keep: (date: string) => `Keep ${date}`,
  saved: (date: string, zone: string) =>
    `Saved. Replies close ${date} at ${CLOSES_AT}, ${zone} time.`,
  savedNone: 'Saved. Replies stay open until the event starts.',
};
