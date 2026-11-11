import { EVENT_AREAS, type EventArea, MORE_EVENT_AREAS } from '@soirely/domain';

/** An event's areas and, after Staff, People (sc-29914): the app's own place, as the web's, outside the shared areas. */
export type EventPlace = EventArea | 'people';

export const EVENT_PLACES: readonly EventPlace[] = EVENT_AREAS.flatMap((area): EventPlace[] =>
  area === 'staff' ? [area, 'people'] : [area],
);

export const MORE_PLACES: readonly EventPlace[] = EVENT_PLACES.filter(
  (place) => place === 'people' || (MORE_EVENT_AREAS as readonly EventPlace[]).includes(place),
);

/** The route param an event's screen reads its area from, so choosing one replaces it and adds nothing to Back. */
export const EVENT_AREA = 'area';

/** The route param saying the event was opened from Happening now, so Back keeps the tab that was showing. */
export const FROM_HAPPENING_NOW = 'now';

export function areaOf(param: string | undefined): EventPlace {
  return EVENT_PLACES.find((place) => place === param) ?? 'overview';
}

/** Back from any area returns to the page on Overview, however many were chosen on the way; from Overview it leaves the event. */
export function areaBack(area: EventPlace): 'overview' | 'leave' {
  return area === 'overview' ? 'leave' : 'overview';
}

/** The field Edit details opens with focus on, from a row of Details (sc-22103) or Make live's Add who is hosting (sc-15497). */
const EDIT_AT = ['starts', 'venue', 'hosts', 'name', 'type', 'currency'] as const;

export type EditAt = (typeof EDIT_AT)[number];

export function editAtOf(param: string | undefined): EditAt | undefined {
  return EDIT_AT.find((at) => at === param);
}

export function eventHref(eventId: string, fromHappeningNow = false): `/events/${string}` {
  const page = `/events/${encodeURIComponent(eventId)}` as const;

  return fromHappeningNow ? `${page}?${FROM_HAPPENING_NOW}=1` : page;
}
