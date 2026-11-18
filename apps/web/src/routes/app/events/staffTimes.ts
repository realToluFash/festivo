import type { StaffShift } from '@soirely/api-client';
import { formatEventClock } from '@soirely/domain';
import type { TFunction } from 'i18next';

const DAY_MS = 24 * 60 * 60_000;

/** How the Staff pages write a shift's times (sc-3908): clock times within 24 hours, and past them each start and end with its day. */
export interface StaffTimes {
  long: boolean;
  timeZone: string;
  locale: string;
}

/** Past 24 hours from the earlier of the event's start and its first shift's to the later of their ends. */
export function staffTimes(
  event: { startsAt: string; endsAt: string; timeZone: string },
  shifts: readonly Pick<StaffShift, 'startsAt' | 'endsAt'>[],
  locale: string,
): StaffTimes {
  const first = Math.min(
    Date.parse(event.startsAt),
    ...shifts.map((one) => Date.parse(one.startsAt)),
  );
  const last = Math.max(Date.parse(event.endsAt), ...shifts.map((one) => Date.parse(one.endsAt)));

  return { long: last - first > DAY_MS, timeZone: event.timeZone, locale };
}

/** The locale's short day, "Sat 7 Nov", in the event's zone. */
export function dayWords(moment: string | number, times: StaffTimes): string {
  return new Intl.DateTimeFormat(times.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: times.timeZone,
  }).format(new Date(moment));
}

export function weekdayWords(moment: string | number, times: StaffTimes): string {
  return new Intl.DateTimeFormat(times.locale, {
    weekday: 'long',
    timeZone: times.timeZone,
  }).format(new Date(moment));
}

export function clockWords(moment: string | number, times: StaffTimes): string {
  return formatEventClock(new Date(moment).toISOString(), times.timeZone, times.locale);
}

/** "16:00 to 01:00"; past 24 hours "Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00", the end's date left out on the start's date. */
export function rangeWords(
  start: string | number,
  end: string | number,
  times: StaffTimes,
  t: TFunction,
): string {
  if (!times.long)
    return t('jobs.range', { start: clockWords(start, times), end: clockWords(end, times) });
  const moment = (at: string | number) =>
    t('jobs.moment', { day: dayWords(at, times), time: clockWords(at, times) });
  const sameDay = wallOf(start, times.timeZone).date === wallOf(end, times.timeZone).date;

  return t('jobs.range', {
    start: moment(start),
    end: sameDay ? clockWords(end, times) : moment(end),
  });
}

/** The date and time a moment reads in a zone, as the form's fields hold them. */
export function wallOf(moment: string | number, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(moment));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}
