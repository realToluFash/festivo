import type { OutsideEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';

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

/** At Can view and Can check guests in, Overview is the `no-org` demo's own: the event's card with the level line, then Guests and People. Can edit opens the member's. */
export function readsOverview(role: OutsideEvent['role']): boolean {
  return role !== 'can_edit';
}

/** The card's level line, "Can view · Cloakroom · until Sat 15 Nov, 02:00", in the event's own time zone. */
export function levelLine(
  t: TFunction,
  held: Pick<OutsideEvent, 'role' | 'jobLabel'>,
  event: { endsAt: string; timeZone: string },
  locale: string,
): string {
  const until = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: event.timeZone,
  }).format(new Date(event.endsAt));

  return [
    t(`eventPeople.role.${held.role}`),
    held.jobLabel,
    t('outsideEvent.until', { when: until }),
  ]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}
