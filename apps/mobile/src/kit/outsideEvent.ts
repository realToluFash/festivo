import type { OutsideEvent } from '@soirely/api-client';

import { EVENT_PLACES, type EventPlace } from './eventNav.ts';

const READING_PLACES: readonly EventPlace[] = [
  'overview',
  'guests',
  'schedule',
  'seating',
  'people',
];

/** On a phone, held from outside, the tabs before More; the level's other areas are in More (sc-71). */
export const OUTSIDE_TABS: readonly EventPlace[] = ['overview', 'guests'];

/** What a level held from outside an organisation opens (sc-71): the reading levels the event's own screens, Can edit every area but Budget. */
export function outsidePlaces(role: OutsideEvent['role']): readonly EventPlace[] {
  return role === 'can_edit' ? EVENT_PLACES.filter((place) => place !== 'budget') : READING_PLACES;
}

export function outsideMore(role: OutsideEvent['role']): readonly EventPlace[] {
  return outsidePlaces(role).filter((place) => !OUTSIDE_TABS.includes(place));
}

interface Held {
  account: { outsideEvents: readonly OutsideEvent[] } | null;
  organisation: unknown;
  pausedIn?: unknown;
}

/** In no organisation, the event it holds from outside at this id; null for any other, and for anyone in an organisation. */
export function outsideOn(
  { account, organisation, pausedIn }: Held,
  eventId: string,
): OutsideEvent | null {
  if (organisation != null || pausedIn != null) return null;

  return account?.outsideEvents.find((one) => one.id === eventId) ?? null;
}

/** Where an account in no organisation lands: the event the API lists first, under way, then soonest, then the grant made first. */
export function outsideLanding({ account, organisation, pausedIn }: Held): OutsideEvent | null {
  if (organisation != null || pausedIn != null) return null;

  return account?.outsideEvents[0] ?? null;
}
