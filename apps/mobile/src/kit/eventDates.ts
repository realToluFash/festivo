export type UpToEvent = 'back' | 'open';

/** The route param through which Events says which event it shows, for the screens over it to read. */
export const SHOWN_EVENT = 'shown';

/** All dates' ‹ Event (sc-18776) and a save on Edit details (sc-21336) end on the event's page, not wherever history leads: back only when the screen directly behind shows this event; otherwise the event is opened in their place. */
export function upToEvent(
  routes: readonly { params?: unknown }[],
  index: number,
  eventId: string,
): UpToEvent {
  const behind = index > 0 ? routes[index - 1]?.params : undefined;

  return typeof behind === 'object' &&
    behind != null &&
    SHOWN_EVENT in behind &&
    behind[SHOWN_EVENT] === eventId
    ? 'back'
    : 'open';
}
