import { formatEventClock, formatTimeOfDay, formatWallClock } from '@soirely/domain';

/** A wall-clock time with no zone of its own, as the samples hold one: "18:00", or "2026-11-10T18:05" for a deadline in Lagos. */
const WALL = /^(\d{4}-\d{2}-\d{2}T)?\d{2}:\d{2}(:\d{2})?$/u;

/** Every time the demo writes, on the 24-hour clock as the product writes it (sc-30243), through the product's own formatters. */
export function writtenTime(at: string | Date, locale: string, timeZone?: string): string {
  if (typeof at === 'string' && WALL.test(at)) return formatWallClock(at, locale);
  if (timeZone != null) return formatEventClock(new Date(at).toISOString(), timeZone, locale);

  return formatTimeOfDay(at, locale);
}
