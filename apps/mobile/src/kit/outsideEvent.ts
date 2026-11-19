import type { OutsideEvent } from '@soirely/api-client';
import {
  formatEventClock,
  formatEventDate,
  formatEventMoment,
  outsideEventsInOrder,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { EVENT_PLACES, type EventPlace, eventHref } from './eventNav.ts';

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

/** The event the account holds from outside at this id, in no organisation or as a member of another (sc-68438); null for any other, and while paused. */
export function outsideOn({ account, pausedIn }: Held, eventId: string): OutsideEvent | null {
  if (pausedIn != null) return null;

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

/** The card's first line, "Sat 14 Nov · 15:00 to 23:30", the end's day kept when it is another, in the event's own time zone. */
export function cardWhen(
  t: TFunction,
  event: { startsAt: string; endsAt: string; timeZone: string },
  locale: string,
): string {
  const day = formatEventDate(event.startsAt, event.timeZone, locale, false);
  const sameDay = formatEventDate(event.endsAt, event.timeZone, locale, false) === day;

  return t('outsideEvent.when', {
    day,
    start: formatEventClock(event.startsAt, event.timeZone, locale),
    end: sameDay
      ? formatEventClock(event.endsAt, event.timeZone, locale)
      : formatEventMoment(event.endsAt, event.timeZone, locale),
  });
}

export const CAME_FROM = 'cameFrom';

/** Another event held from outside, opened on its Overview, remembering the one it was chosen in. */
export function outsideHref(eventId: string, from: string): `/events/${string}` {
  return `${eventHref(eventId)}?${CAME_FROM}=${encodeURIComponent(from)}`;
}

/** What More lists inside an event held from outside (sc-68438): a member's organisations, and the events once there are two. */
export function outsideGroups({ account, organisation }: Held): {
  organisations: boolean;
  events: boolean;
} {
  return {
    organisations: organisation != null,
    events: (account?.outsideEvents.length ?? 0) >= 2,
  };
}

/** The switcher's Events from outside: a member's grants on other organisations' events, in their order. */
export function switcherOutside({ account, organisation }: Held, now: Date): OutsideEvent[] {
  return organisation == null ? [] : outsideEventsInOrder(account?.outsideEvents ?? [], now);
}

export type WayBack =
  { kind: 'events' } | { kind: 'event'; event: OutsideEvent } | { kind: 'continue' };

/** From an event gone while its list was open: a member back to Events; in no organisation, the event it came from, else where it would land, else on. */
export function wayBack(
  { account, organisation, pausedIn }: Held,
  missing: string,
  from: string | undefined,
  now: Date,
): WayBack {
  if (organisation != null || pausedIn != null) return { kind: 'events' };

  const live = (account?.outsideEvents ?? []).filter((one) => one.id !== missing);
  const back = live.find((one) => one.id === from) ?? outsideEventsInOrder(live, now)[0];

  return back == null ? { kind: 'continue' } : { kind: 'event', event: back };
}
