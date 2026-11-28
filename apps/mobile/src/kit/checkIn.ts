import { eventDayOf, milestoneDistance, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { type CardTag, type Shown, cardTags } from './eventsList.ts';

export function clockOf(rfc3339: string): string {
  return wallOfZoned(rfc3339).slice(11, 16);
}

/** Before the door opens on the day, the card's second chip names the start, as `beforeOpen` draws it: "Today, 18:00". */
export function beforeOpenTags(event: Shown, now: Date, t: TFunction): CardTag[] {
  const tags = cardTags(event, now, t);
  if (milestoneDistance(event.startsAt, event.timeZone, now).kind !== 'today') return tags;

  return [
    ...tags.filter((tag) => tag.mark != null),
    { word: t('checkIn.todayAt', { time: clockOf(event.startsAt) }) },
  ];
}

/** Open check-in shows all day on each of the event's days, a day counted from 05:00 in the event's zone (sc-3895). */
export function onEventDay(
  event: { startsAt: string; endsAt: string },
  nowInZone: string,
): boolean {
  const today = eventDayOf(wallOfZoned(nowInZone));

  return (
    today >= eventDayOf(wallOfZoned(event.startsAt)) &&
    today <= eventDayOf(wallOfZoned(event.endsAt))
  );
}

/** Whoever holds guests.check_in on the event: Owners and Admins, Lead, Can edit and Can check guests in (sc-1454, Amended 6 Nov). */
export function checksIn(event: { permissions: readonly string[] } | null): boolean {
  return event?.permissions.includes('guests.check_in') === true;
}
