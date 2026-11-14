import { wallDay } from './calendar.ts';

const DAY = 86_400_000;

const FULL_WEEK = 7;

/** A wall day in `timeZone` as a count of days since 1970-01-01, so days subtract. */
export function wallDayNumber(moment: string | Date, timeZone: string): number {
  return Date.parse(`${wallDay(moment, timeZone)}T00:00:00Z`) / DAY;
}

/** Days numbered by `wallDayNumber` that get a tile: every one up to a week; past that the first, today while it is `on`, and the last, with a single day between two kept rather than counted (sc-30413). */
export function shownDays(days: {
  first: number;
  last: number;
  today: number;
  on: boolean;
}): number[] {
  const { first, last, today, on } = days;

  if (last - first + 1 <= FULL_WEEK) {
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }

  const ends = on && today > first && today < last ? [first, today, last] : [first, last];

  return ends.flatMap((day, index) => (ends[index + 1] === day + 2 ? [day, day + 1] : [day]));
}
