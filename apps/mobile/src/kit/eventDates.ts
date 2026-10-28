export type UpFromDates = 'back' | 'open';

/** The route param through which Events says which event it shows, for All dates to read. */
export const SHOWN_EVENT = 'shown';

/** ‹ Event is the way up, not history (sc-18776): back only when the screen directly behind shows this event; otherwise the event is opened in All dates' place. */
export function upFromDates(
  routes: readonly { params?: unknown }[],
  index: number,
  eventId: string,
): UpFromDates {
  const behind = index > 0 ? routes[index - 1]?.params : undefined;

  return typeof behind === 'object' &&
    behind != null &&
    SHOWN_EVENT in behind &&
    behind[SHOWN_EVENT] === eventId
    ? 'back'
    : 'open';
}
