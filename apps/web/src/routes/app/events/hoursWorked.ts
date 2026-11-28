import type { HoursRow, HoursSummary, HoursTyped } from '@soirely/api-client';
import { formatEventClock } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { hoursWords } from './staffRatesArea.ts';
import { wallOf } from './staffTimes.ts';

export { hoursWords };

const LONGEST_MINUTES = 24 * 60;

export interface HoursClock {
  timeZone: string;
  locale: string;
}

export function clockIn(at: string, on: HoursClock): string {
  return formatEventClock(at, on.timeZone, on.locale);
}

/** "Sunday 02:10": the weekday, never the date. */
export function dayTime(t: TFunction, at: string | number, on: HoursClock): string {
  const day = new Intl.DateTimeFormat(on.locale, {
    weekday: 'long',
    timeZone: on.timeZone,
  }).format(new Date(at));

  return t('hours.dayTime', { day, time: clockIn(new Date(at).toISOString(), on) });
}

/** A time on the event's clock, with its weekday when that is not today's. */
export function timeWords(t: TFunction, at: string, now: number, on: HoursClock): string {
  return wallOf(at, on.timeZone).date === wallOf(now, on.timeZone).date
    ? clockIn(at, on)
    : dayTime(t, at, on);
}

export function clockedWords(t: TFunction, row: HoursRow, on: HoursClock): string {
  if (row.clockedInAt == null) return t('hours.noIn');

  return row.clockedOutAt == null
    ? t('hours.inOnly', { in: clockIn(row.clockedInAt, on) })
    : t('hours.inOut', { in: clockIn(row.clockedInAt, on), out: clockIn(row.clockedOutAt, on) });
}

/** One line for each time that now differs from what was recorded: from what, by whom and when. */
export function trailWords(t: TFunction, row: HoursRow, on: HoursClock): string[] {
  return row.corrections.map(({ field, was, by, at }) => {
    const now = field === 'in' ? row.clockedInAt : row.clockedOutAt;
    const words = {
      time: now == null ? '' : clockIn(now, on),
      from:
        was == null ? t(field === 'in' ? 'hours.noClockIn' : 'hours.noClockOut') : clockIn(was, on),
      by,
      at: dayTime(t, at, on),
    };

    return field === 'in' ? t('hours.correctedIn', words) : t('hours.correctedOut', words);
  });
}

export function markWords(t: TFunction, row: HoursRow, on: HoursClock): string | null {
  if (row.mark === 'not_clocked_out') return t('hours.notOut', { end: clockIn(row.endsAt, on) });

  return row.mark === 'no_attendance' ? t('hours.noAttendance') : null;
}

export function summaryRest(t: TFunction, sum: HoursSummary): string | null {
  const rest = [
    sum.assumedMinutes > 0
      ? t('hours.assumed', { hours: hoursWords(t, sum.assumedMinutes) })
      : null,
    sum.noAttendance > 0 ? t('hours.noneShifts', { count: sum.noAttendance }) : null,
  ].filter((one) => one != null);

  return rest.length === 0 ? null : rest.join(' · ');
}

export interface TimesDraft {
  inDate: string;
  inTime: string;
  outDate: string;
  outTime: string;
}

/** The times that count, else the scheduled ones; the clock-out left empty while they can still clock out. */
export function draftOf(row: HoursRow, timeZone: string): TimesDraft {
  const start = wallOf(row.clockedInAt ?? row.startsAt, timeZone);
  const end = wallOf(row.clockedOutAt ?? row.endsAt, timeZone);

  return {
    inDate: start.date,
    inTime: start.time,
    outDate: end.date,
    outTime: row.stillOn && row.clockedOutAt == null ? '' : end.time,
  };
}

/** Minutes on the wall clock since the epoch, so two typed times compare; null when either is not a time. */
export function wallMinutes(date: string, time: string): number | null {
  const day = Date.parse(`${date}T00:00:00Z`);
  const match = /^(\d{2}):(\d{2})$/u.exec(time.trim());
  if (Number.isNaN(day) || match == null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return day / 60_000 + hours * 60 + minutes;
}

export type TimesProblem = 'inBlank' | 'outBlank' | 'order' | 'long';

/** Checked in this order: a clock-in, a clock-out unless still on, the end after the start, and 24 hours at most. */
export function timesProblems(
  draft: TimesDraft,
  stillOn: boolean,
): { in?: TimesProblem; out?: TimesProblem } {
  const start = wallMinutes(draft.inDate, draft.inTime);
  if (start == null) return { in: 'inBlank' };
  if (draft.outTime.trim() === '') return stillOn ? {} : { out: 'outBlank' };
  const end = wallMinutes(draft.outDate, draft.outTime);
  if (end == null) return { out: 'outBlank' };
  if (end <= start) return { out: 'order' };
  if (end - start > LONGEST_MINUTES) return { out: 'long' };

  return {};
}

export function typedOf(draft: TimesDraft): HoursTyped {
  return {
    clockedInAt: `${draft.inDate}T${draft.inTime.trim()}`,
    clockedOutAt: draft.outTime.trim() === '' ? null : `${draft.outDate}T${draft.outTime.trim()}`,
  };
}

/** The hint under each field: what was recorded, and for a missing clock-out what it counts to. */
export function besideWords(
  t: TFunction,
  row: HoursRow,
  on: HoursClock,
): { in: string; out: string } {
  return {
    in:
      row.recordedInAt == null
        ? t('hours.notRecorded')
        : t('hours.recorded', { time: clockIn(row.recordedInAt, on) }),
    out:
      row.recordedOutAt != null
        ? t('hours.recorded', { time: clockIn(row.recordedOutAt, on) })
        : row.mark === 'not_clocked_out'
          ? t('hours.notRecordedOut', { end: clockIn(row.endsAt, on) })
          : t('hours.notRecorded'),
  };
}
