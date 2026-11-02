import type { EventArea } from '@soirely/domain';

import { EVENT_AREA } from './eventNav.ts';

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

/** Takes the way `upToEvent` gives, so All dates and Edit details cannot drift apart. */
export function goUpToEvent(
  navigation: {
    getState: () => { routes: readonly { params?: unknown }[]; index: number } | undefined;
  },
  router: { back: () => void; replace: (href: `/events/${string}`) => void },
  eventId: string,
): void {
  const { routes, index } = navigation.getState() ?? { routes: [], index: 0 };

  if (upToEvent(routes, index, eventId) === 'back') router.back();
  else router.replace(`/events/${encodeURIComponent(eventId)}`);
}

/** A menu area chosen on All dates or Edit details pops back to the event's page with its params kept, since a pop replaces them: losing `shown` sends a later way up to a second copy of the page, and losing Happening now changes the tab Back lands on. */
export function areaParams(
  routes: readonly { params?: unknown }[],
  index: number,
  eventId: string,
  area: EventArea,
): Record<string, string> {
  for (let at = index - 1; at >= 0; at -= 1) {
    const params = routes[at]?.params;

    if (
      typeof params === 'object' &&
      params != null &&
      'id' in params &&
      params.id === eventId &&
      SHOWN_EVENT in params &&
      params[SHOWN_EVENT] === eventId
    ) {
      const kept: Record<string, string> = {};

      for (const [name, value] of Object.entries(params)) {
        if (typeof value === 'string') kept[name] = value;
      }

      return { ...kept, [EVENT_AREA]: area };
    }
  }

  return { id: eventId, [EVENT_AREA]: area };
}

export function goToArea(
  navigation: {
    getState: () => { routes: readonly { params?: unknown }[]; index: number } | undefined;
  },
  router: {
    dismissTo: (href: { pathname: '/events/[id]'; params: Record<string, string> }) => void;
  },
  eventId: string,
  area: EventArea,
): void {
  const { routes, index } = navigation.getState() ?? { routes: [], index: 0 };

  router.dismissTo({ pathname: '/events/[id]', params: areaParams(routes, index, eventId, area) });
}
