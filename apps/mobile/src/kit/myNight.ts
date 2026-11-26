import type { MyNight, MyNightGuest } from '@soirely/api-client';
import { formatWallClock, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

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

/** The station a move took them to, kept until the next move; none once a move leaves no station. */
export function updatedAfter(
  was: MyNight | null,
  kept: string | null,
  night: MyNight,
): string | null {
  if (night.station == null) return null;

  return was != null && headingOf(was) !== headingOf(night) ? night.station : kept;
}

/** When clocking in opens, while that is still ahead; null once the window is open or with no shift. */
export function clockOpensAt(night: MyNight, now: Date): string | null {
  if (night.shift == null) return null;
  const opens = Date.parse(night.shift.startsAt) - CLOCK_OPENS_BEFORE_MS;

  return now.getTime() >= opens ? null : new Date(opens).toISOString();
}

/** "Vegetarian, Peanuts": a guest's diets, then their allergies, as the guest record names them; null with neither. */
export function dietaryOf(t: TFunction, guest: MyNightGuest): string | null {
  const other = (what: string | null, none: string) =>
    what == null ? t(none) : t('myNight.otherNeed', { what });
  const words = [
    ...guest.diets.map((code) =>
      code === 'other'
        ? other(guest.otherDiet, 'guestNeeds.dietName.other')
        : t(`guestNeeds.dietName.${code}`),
    ),
    ...guest.allergens.map((code) =>
      code === 'other'
        ? other(guest.otherAllergy, 'guestNeeds.allergen.other')
        : t(`guestNeeds.allergen.${code}`),
    ),
  ];

  return words.length === 0 ? null : words.join(', ');
}

/** Your night's row on the event's Overview: where they are, then the shift's times; null with no shift, when the row is not shown. */
export function rowLineOf(t: TFunction, night: MyNight, locale: string): string | null {
  if (night.shift == null) return null;

  return `${headingOf(night)} · ${t('myNight.times', {
    start: clockAt(night.shift.startsAt, locale),
    end: clockAt(night.shift.endsAt, locale),
  })}`;
}

/** Where My night's Check-in leads, for a job whose level opens check-in at the door (sc-28230); null shows no button. */
export function checkInOf(
  night: MyNight,
): { pathname: '/events/[id]/check-in'; params: { id: string } } | null {
  return night.checksIn
    ? { pathname: '/events/[id]/check-in', params: { id: night.event.id } }
    : null;
}
