/** The part of one of `/me`'s `outsideEvents` (sc-71) a list of them reads: its start written in the event's own zone, with its offset, and its end. */
export interface ListedOutsideEvent {
  organisationName: string;
  startsAt: string;
  endsAt: string | null;
}

/** From its start until its end (sc-68438). */
export function isUnderWay(
  event: Pick<ListedOutsideEvent, 'startsAt' | 'endsAt'>,
  now: Date,
): boolean {
  const at = now.getTime();

  return (
    Date.parse(event.startsAt) <= at && (event.endsAt == null || at < Date.parse(event.endsAt))
  );
}

/** Under way first, then the API's own order, which already ties an equal start on the grant made first: never sorted again (sc-68438). */
export function outsideEventsInOrder<T extends Pick<ListedOutsideEvent, 'startsAt' | 'endsAt'>>(
  events: readonly T[],
  now: Date,
): T[] {
  return [
    ...events.filter((event) => isUnderWay(event, now)),
    ...events.filter((event) => !isUnderWay(event, now)),
  ];
}

/** "Sat 21 Nov" and "19:30", as written in the event's own zone, never converted to the reader's. */
export function outsideEventWhen(
  startsAt: string,
  locale: string,
): { date: string; start: string } {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${startsAt.slice(0, 10)}T00:00:00Z`));

  return { date, start: startsAt.slice(11, 16) };
}

/** A row's second line: "{organisation} · {date} · {start}". */
export function outsideEventLine(event: ListedOutsideEvent, locale: string): string {
  const { date, start } = outsideEventWhen(event.startsAt, locale);

  return `${event.organisationName} · ${date} · ${start}`;
}
