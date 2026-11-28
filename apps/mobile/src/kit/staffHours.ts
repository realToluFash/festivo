import type { HoursRow, HoursSummary, HoursTyped, StaffHours } from '@soirely/api-client';
import { wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { clockAt } from './myNight.ts';
import { hoursWords } from './shiftClock.ts';

const LONGEST_MINUTES = 24 * 60;

export interface TimesDraft {
  inDate: string;
  inTime: string;
  outDate: string;
  outTime: string;
}

export type TimeProblem = 'inBlank' | 'outBlank' | 'order' | 'long';

const dateOf = (at: string) => wallOfZoned(at).slice(0, 10);
const timeOf = (at: string) => wallOfZoned(at).slice(11, 16);

/** The counted times, else the scheduled ones; the clock-out left empty while they are still on. */
export function draftOf(row: HoursRow): TimesDraft {
  const start = row.clockedInAt ?? row.startsAt;
  const end = row.clockedOutAt ?? row.endsAt;

  return {
    inDate: dateOf(start),
    inTime: timeOf(start),
    outDate: dateOf(end),
    outTime: row.stillOn && row.clockedOutAt == null ? '' : timeOf(end),
  };
}

/** "YYYY-MM-DDTHH:MM" from a date and a typed time, "1:15" as "01:15"; null when either is not one. */
export function wallOf(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/u.exec(time.trim());
  if (d == null || t == null) return null;
  const hours = Number(t[1]);
  const minutes = Number(t[2]);
  if (hours > 23 || minutes > 59) return null;
  const day = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])));
  if (day.toISOString().slice(0, 10) !== d[0]) return null;

  return `${d[0]}T${String(hours).padStart(2, '0')}:${t[2]}`;
}

const minutesOf = (wall: string) => Date.parse(`${wall}:00Z`) / 60_000;

/** The four checks, in order: a clock-in is required, a clock-out only once the person is no longer on, after the start, within 24 hours. */
export function timesProblem(
  draft: TimesDraft,
  stillOn: boolean,
): { field: 'in' | 'out'; problem: TimeProblem } | null {
  const start = wallOf(draft.inDate, draft.inTime);
  if (start == null) return { field: 'in', problem: 'inBlank' };
  if (draft.outTime.trim() === '') return stillOn ? null : { field: 'out', problem: 'outBlank' };
  const end = wallOf(draft.outDate, draft.outTime);
  if (end == null) return { field: 'out', problem: 'outBlank' };
  const length = minutesOf(end) - minutesOf(start);
  if (length <= 0) return { field: 'out', problem: 'order' };
  if (length > LONGEST_MINUTES) return { field: 'out', problem: 'long' };

  return null;
}

export function typedOf(draft: TimesDraft): HoursTyped {
  return {
    clockedInAt: wallOf(draft.inDate, draft.inTime) ?? '',
    clockedOutAt: draft.outTime.trim() === '' ? null : wallOf(draft.outDate, draft.outTime),
  };
}

/** The hint beside each field: what was recorded, before any correction. */
export function recordedHints(
  t: TFunction,
  row: HoursRow,
  locale: string,
): { in: string; out: string } {
  return {
    in:
      row.recordedInAt == null
        ? t('staffHours.notRecorded')
        : t('staffHours.recorded', { time: clockAt(row.recordedInAt, locale) }),
    out:
      row.recordedOutAt != null
        ? t('staffHours.recorded', { time: clockAt(row.recordedOutAt, locale) })
        : row.mark === 'not_clocked_out'
          ? t('staffHours.notRecordedOut', { end: clockAt(row.endsAt, locale) })
          : t('staffHours.notRecorded'),
  };
}

export const rangeWords = (t: TFunction, row: HoursRow, locale: string) =>
  t('staffHours.range', { start: clockAt(row.startsAt, locale), end: clockAt(row.endsAt, locale) });

export function scheduledWords(t: TFunction, row: HoursRow, locale: string): string {
  return t('staffHours.scheduledFact', {
    range: rangeWords(t, row, locale),
    hours: hoursWords(t, row.scheduledMinutes),
  });
}

/** The Clocked fact: after service what counts, during it only what has happened. */
export function clockedWords(t: TFunction, row: HoursRow, live: boolean, locale: string): string {
  const at = (time: string) => clockAt(time, locale);
  if (row.clockedInAt == null) return live ? t('staffHours.notYet') : t('staffHours.noIn');
  if (row.clockedOutAt == null)
    return live
      ? t('staffHours.clockedInAt', { time: at(row.clockedInAt) })
      : t('staffHours.inOnly', { time: at(row.clockedInAt) });

  return t('staffHours.inOut', { in: at(row.clockedInAt), out: at(row.clockedOutAt) });
}

export function markWords(t: TFunction, row: HoursRow, locale: string): string | null {
  if (row.mark === 'not_clocked_out')
    return t('staffHours.notOut', { end: clockAt(row.endsAt, locale) });

  return row.mark === 'no_attendance' ? t('staffHours.noAttendance') : null;
}

/** The trail's time always gives its weekday: it is read days later. */
export function trailTime(t: TFunction, at: string, locale: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${dateOf(at)}T00:00Z`),
  );

  return t('shiftClock.dayTime', { day: weekday, time: clockAt(at, locale) });
}

/** One line for each time that now differs from what was recorded, from what, by whom and when. */
export function trailWords(t: TFunction, row: HoursRow, locale: string): string[] {
  return row.corrections.map(({ field, was, by, at }) => {
    const now = field === 'in' ? row.clockedInAt : row.clockedOutAt;
    const values = {
      time: now == null ? '' : clockAt(now, locale),
      by,
      at: trailTime(t, at, locale),
    };

    return field === 'in'
      ? t('staffHours.correctedIn', {
          ...values,
          from: was == null ? t('staffHours.noClockIn') : clockAt(was, locale),
        })
      : t('staffHours.correctedOut', {
          ...values,
          from: was == null ? t('staffHours.noClockOut') : clockAt(was, locale),
        });
  });
}

export function summaryLines(t: TFunction, s: HoursSummary): { head: string; rest: string | null } {
  const rest = [
    s.assumedMinutes > 0
      ? t('staffHours.assumed', { time: hoursWords(t, s.assumedMinutes) })
      : null,
    s.noAttendance > 0 ? t('staffHours.noneShifts', { count: s.noAttendance }) : null,
  ].filter((one) => one != null);

  return {
    head: t('staffHours.of', {
      worked: hoursWords(t, s.workedMinutes),
      scheduled: hoursWords(t, s.scheduledMinutes),
    }),
    rest: rest.length === 0 ? null : rest.join(' · '),
  };
}

export const rowKey = (row: Pick<HoursRow, 'shiftId' | 'staffId'>) =>
  `${row.shiftId}:${row.staffId}`;

export const rowOf = (hours: StaffHours, key: string): HoursRow | undefined =>
  hours.rows.find((row) => rowKey(row) === key);
