import type { StaffShift } from '@soirely/api-client';
import { formatEventClock, spansADay } from '@soirely/domain';
import type { TFunction } from 'i18next';

/** How the Staff pages write a shift's times (sc-3908): clock times under 24 hours, and at 24 hours or more each start and end with its day. */
export interface StaffTimes {
  long: boolean;
  timeZone: string;
  locale: string;
}

/** 24 hours or more on the event's clock, from the earlier of the event's start and its first shift's to the later of their ends. */
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

  return { long: spansADay(first, last, event.timeZone), timeZone: event.timeZone, locale };
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

/** "16:00 to 01:00"; at 24 hours or more "Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00", the end's date left out on the start's date. */
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

/** A shift's words that wrap only after its day's comma and before its end, as the Roster beside an open person needs (sc-3912). */
export function shiftBreaks(text: string): string {
  const words = text.split(' ');
  const start = words.findIndex((word) => /^\d{1,2}:\d{2}$/.test(word));
  return words.reduce(
    (line, word, i) =>
      i === 0
        ? word
        : `${line}${words[i - 1]?.endsWith(',') === true || (start >= 0 && i === start + 2) ? ' ' : '\u00a0'}${word}`,
    '',
  );
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
