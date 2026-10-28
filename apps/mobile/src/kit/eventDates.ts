export type UpFromDates = 'back' | 'open';

/** All dates for an event, carrying the key of the screen whose Coming up opened it. */
export function eventDatesHref(eventId: string, openedFrom: string): string {
  return `/events/${encodeURIComponent(eventId)}/dates?from=${encodeURIComponent(openedFrom)}`;
}

/** ‹ Event is the way up, not history (sc-18776): back only to the screen that opened All dates, when it is directly behind; otherwise the event is opened in All dates' place. */
export function upFromDates(
  routes: readonly { key: string }[],
  index: number,
  openedFrom: string | undefined,
): UpFromDates {
  return openedFrom != null && index > 0 && routes[index - 1]?.key === openedFrom ? 'back' : 'open';
}
