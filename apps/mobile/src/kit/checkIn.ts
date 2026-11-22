import type { Arrival, CheckIn, CheckInGuest } from '@soirely/api-client';
import {
  type ReplyWord,
  companionShown,
  eventDayOf,
  milestoneDistance,
  nameKey,
  visibleLength,
  wallOfZoned,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { type CardTag, type Shown, cardTags } from './eventsList.ts';

export interface DoorRow {
  id: string;
  name: string;
  hostId: string;
  companion: boolean;
  reply: ReplyWord;
  arrival: Arrival | null;
}

const words = (name: string) =>
  nameKey(name)
    .split(/[\s-]+/u)
    .filter((one) => one !== '');

/** Every word typed starts some word of the name, in any order, ignoring case and accents; a hyphen separates words. "okon ada" finds "Chief Mrs Adaeze Okonkwo-Williams", "kwo" does not. */
export function doorMatches(name: string, typed: string): boolean {
  const wanted = words(typed);
  if (wanted.length === 0) return true;
  const has = words(name);

  return wanted.every((one) => has.some((word) => word.startsWith(one)));
}

function rowsOf(t: TFunction, guest: CheckInGuest): DoorRow[] {
  const names = guest.companions.map((one) => one.fullName);

  return [
    {
      id: guest.id,
      name: guest.fullName,
      hostId: guest.id,
      companion: false,
      reply: guest.walkIn ? 'walkIn' : guest.reply,
      arrival: guest.arrival,
    },
    ...guest.companions.map((one, at) => ({
      id: one.id,
      name: companionShown(t, guest.fullName, names, at),
      hostId: guest.id,
      companion: true,
      reply: one.state,
      arrival: one.arrival,
    })),
  ];
}

/** Everyone A–Z by full name in the reader's locale, each companion under their host. A search keeps whoever matches by their own name; a companion found shows under their host, and a host found shows with all their companions. */
export function doorRows(t: TFunction, checkIn: CheckIn, typed: string, locale: string): DoorRow[] {
  const order = new Intl.Collator(locale, { sensitivity: 'base' });
  const guests = [...checkIn.guests].sort((a, b) => order.compare(a.fullName, b.fullName));

  return guests.flatMap((guest) => {
    const rows = rowsOf(t, guest);
    const [host, ...companions] = rows;
    if (host == null || doorMatches(guest.fullName, typed)) return rows;
    const found = companions.filter(
      (row, at) => guest.companions[at]?.fullName != null && doorMatches(row.name, typed),
    );

    return found.length === 0 ? [] : [host, ...found];
  });
}

/** "141 of 152 arrived", attended of expected; with nobody expected, "37 arrived" (sc-1454, The count). */
export function countLine(t: TFunction, count: CheckIn['count']): string {
  return count.expected === 0
    ? t('checkIn.countAlone', { count: count.attended })
    : t('checkIn.count', { count: count.attended, expected: count.expected });
}

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

/** A walk-in's name: required, at most 200 characters as a person sees them (the API's count), trimmed; only spaces is blank. */
export function walkInProblem(name: string): 'blank' | 'long' | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'blank';

  return visibleLength(trimmed) > 200 ? 'long' : null;
}

export function sameName(checkIn: CheckIn, name: string): DoorRow | null {
  const wanted = nameKey(name);
  for (const guest of checkIn.guests) {
    if (nameKey(guest.fullName) === wanted)
      return {
        id: guest.id,
        name: guest.fullName,
        hostId: guest.id,
        companion: false,
        reply: guest.walkIn ? 'walkIn' : guest.reply,
        arrival: guest.arrival,
      };
    for (const one of guest.companions)
      if (one.fullName != null && nameKey(one.fullName) === wanted)
        return {
          id: one.id,
          name: one.fullName,
          hostId: guest.id,
          companion: true,
          reply: one.state,
          arrival: one.arrival,
        };
  }

  return null;
}
