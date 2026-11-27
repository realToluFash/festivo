import type { MyNight, MyNightGuest } from '@soirely/api-client';
import { formatWallClock, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

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

/** The route param through which check-in knows it was opened from Your night, and leads back there (sc-28230). */
export const CHECK_IN_FROM = 'from';

/** The params that carry Your night across check-in and its scanner, none when check-in was opened elsewhere. */
function fromOf(from: string | undefined): { [CHECK_IN_FROM]?: 'night' } {
  return from === 'night' ? { [CHECK_IN_FROM]: 'night' } : {};
}

/** Check-in for an event, keeping where it was opened from (sc-28230). */
export function checkInHrefOf(
  id: string,
  from: string | undefined,
  extra: { focus?: string; tap?: string } = {},
) {
  return {
    pathname: '/events/[id]/check-in' as const,
    params: { id, ...extra, ...fromOf(from) },
  };
}

/** Check-in's scanner, which hands where check-in was opened from back on both of its ways back (sc-28230). */
export function scanHrefOf(id: string, from: string | undefined) {
  return { pathname: '/events/[id]/scan' as const, params: { id, ...fromOf(from) } };
}

/** Check-in's way back: Your night when opened from it, else the event's Guests, which has no href of its own (sc-28230). */
export function checkInBackOf(
  id: string,
  from: string | undefined,
):
  | { label: 'myNight.title'; href: { pathname: '/events/[id]/my-night'; params: { id: string } } }
  | { label: 'checkIn.back'; href: null } {
  return from === 'night'
    ? { label: 'myNight.title', href: { pathname: '/events/[id]/my-night', params: { id } } }
    : { label: 'checkIn.back', href: null };
}

/** Who's here above Your shift (sc-3918), last of the buttons: primary when neither Check-in nor Open {station} comes before it; null shows no button. */
export function whosHereOf(night: MyNight, station: string | null) {
  return night.whosHere ? { primary: checkInOf(night) == null && station == null } : null;
}

/** Where My night's Check-in leads, for a job whose level opens check-in at the door (sc-28230); null shows no button. */
export function checkInOf(night: MyNight) {
  return night.checksIn ? checkInHrefOf(night.event.id, 'night') : null;
}
