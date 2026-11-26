import type { MyNight, MyNightGuest } from '@soirely/api-client';
import { formatWallClock, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { allergenName, dietName } from '../app/events/kitchenSheet.ts';

/** The clock card opens an hour before the shift (sc-234's Recording). */
const CLOCK_OPENS_BEFORE_MS = 60 * 60_000;

/** 24-hour, on the event's clock whatever the reader's zone. */
export function clockAt(at: string, locale: string): string {
  return formatWallClock(wallOfZoned(at), locale);
}

/** "Saturday", for the wall-clock day a time falls on in the event's zone. */
export function weekdayOf(at: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${wallOfZoned(at).slice(0, 10)}T00:00Z`),
  );
}

export function crossesMidnight(shift: { startsAt: string; endsAt: string }): boolean {
  return wallOfZoned(shift.startsAt).slice(0, 10) !== wallOfZoned(shift.endsAt).slice(0, 10);
}

/** What the dark card heads with: the station, or the job with none. */
export function headingOf(night: MyNight): string {
  return night.station ?? night.job ?? '';
}

/** When clocking in opens, while that is still ahead; null once the window is open or with no shift. */
export function clockOpensAt(night: MyNight, now: Date): string | null {
  if (night.shift == null) return null;
  const opens = Date.parse(night.shift.startsAt) - CLOCK_OPENS_BEFORE_MS;

  return now.getTime() >= opens ? null : new Date(opens).toISOString();
}

/** "Vegetarian, Peanuts": a guest's diets, then their allergies, as the guest record names them; null with neither. */
export function dietaryOf(t: TFunction, guest: MyNightGuest): string | null {
  const words = [
    ...guest.diets.map((code) => dietName(t, code, guest.otherDiet)),
    ...guest.allergens.map((code) => allergenName(t, code, guest.otherAllergy)),
  ];

  return words.length === 0 ? null : words.join(', ');
}
