import { EVENT_AREAS, type EventArea } from '@soirely/domain';

/** The route param an event's screen reads its area from, so choosing one replaces it and adds nothing to Back. */
export const EVENT_AREA = 'area';

/** The route param saying the event was opened from Happening now, so Back keeps the tab that was showing. */
export const FROM_HAPPENING_NOW = 'now';

export function areaOf(param: string | undefined): EventArea {
  return (EVENT_AREAS as readonly string[]).includes(param ?? '')
    ? (param as EventArea)
    : 'overview';
}

/** Back from any area returns to the page on Overview, however many were chosen on the way; from Overview it leaves the event. */
export function areaBack(area: EventArea): 'overview' | 'leave' {
  return area === 'overview' ? 'leave' : 'overview';
}

/** The field Edit details opens with focus on, from a row of Details (sc-22103) or Make live's Add who is hosting (sc-15497). */
export type EditAt = 'starts' | 'venue' | 'hosts';

export function editAtOf(param: string | undefined): EditAt | undefined {
  return param === 'starts' || param === 'venue' || param === 'hosts' ? param : undefined;
}

export function eventHref(eventId: string, fromHappeningNow = false): `/events/${string}` {
  const page = `/events/${encodeURIComponent(eventId)}` as const;

  return fromHappeningNow ? `${page}?${FROM_HAPPENING_NOW}=1` : page;
}
