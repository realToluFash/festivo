/** Clocking in and out (sc-234): the rules both demo screens read, on minutes from 00:00 on the shift's first day. */
export const DAY = 24 * 60;
export const OPENS_BEFORE = 60;
export const OUT_AFTER_END = 6 * 60;
export const LONGEST = 24 * 60;

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const FIRST_WEEKDAY = 5;

export interface Scheduled {
  start: number;
  end: number;
}

export const opensAt = (shift: Scheduled) => shift.start - OPENS_BEFORE;

export const canClockIn = (shift: Scheduled, now: number) =>
  now >= opensAt(shift) && now <= shift.end;

/** The earlier of 6 hours after the scheduled end and 24 hours after the clock-in. */
export const outLimit = (shift: Scheduled, clockIn: number) =>
  Math.min(shift.end + OUT_AFTER_END, clockIn + LONGEST);

export const canClockOut = (shift: Scheduled, clockIn: number | null, now: number) =>
  clockIn != null && now >= clockIn && now <= outLimit(shift, clockIn);

export function clock(minutes: number): string {
  const inDay = ((minutes % DAY) + DAY) % DAY;

  return `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
}

export const dayIndex = (minutes: number) => Math.floor(minutes / DAY);

export const weekdayOf = (minutes: number) =>
  WEEKDAYS[(((FIRST_WEEKDAY + dayIndex(minutes)) % 7) + 7) % 7] as string;

/** A time not today gives its weekday, never the date (#12988): "16:58" today, "Saturday 16:58" otherwise. */
export function timeWords(at: number, now: number): string {
  return dayIndex(at) === dayIndex(now) ? clock(at) : `${weekdayOf(at)} ${clock(at)}`;
}

export function hoursWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0 && rest > 0) return `${rest} min`;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export type Mark = 'notOut' | 'noAttendance' | null;

export interface Recorded {
  clockIn: number | null;
  clockOut: number | null;
}

export interface Worked {
  minutes: number;
  assumed: number;
  mark: Mark;
}

/** A missing clock-out counts the scheduled end, a missing clock-in nothing, each with its mark. */
export function workedOf(shift: Scheduled, times: Recorded): Worked {
  if (times.clockIn == null) return { minutes: 0, assumed: 0, mark: 'noAttendance' };
  if (times.clockOut == null) {
    const minutes = Math.max(0, shift.end - times.clockIn);

    return { minutes, assumed: minutes, mark: 'notOut' };
  }

  return { minutes: times.clockOut - times.clockIn, assumed: 0, mark: null };
}

export const scheduledMinutes = (shift: Scheduled) => shift.end - shift.start;

export type TimeProblem = 'inBlank' | 'outBlank' | 'order' | 'long' | null;

export interface TimesDraft {
  inDate: string;
  inTime: string;
  outDate: string;
  outTime: string;
}

export const FIRST_DATE = '2026-10-17';

export function minutesOf(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/u.exec(time.trim());
  if (d == null || t == null) return null;
  const hours = Number(t[1]);
  const mins = Number(t[2]);
  if (hours > 23 || mins > 59) return null;
  const day = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]));
  if (Number.isNaN(day)) return null;
  const days = Math.round((day - Date.parse(`${FIRST_DATE}T00:00:00Z`)) / 86_400_000);

  return days * DAY + hours * 60 + mins;
}

export function dateOf(minutes: number): string {
  return new Date(Date.parse(`${FIRST_DATE}T00:00:00Z`) + dayIndex(minutes) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** The 16 Oct checks: a clock-in is required, a clock-out only once the person is no longer on, after the start, within 24 hours. */
export function timesProblem(
  draft: TimesDraft,
  stillOn: boolean,
): { field: 'in' | 'out'; problem: TimeProblem } | null {
  const start = minutesOf(draft.inDate, draft.inTime);
  if (start == null) return { field: 'in', problem: 'inBlank' };
  const outEmpty = draft.outTime.trim() === '';
  if (outEmpty) return stillOn ? null : { field: 'out', problem: 'outBlank' };
  const end = minutesOf(draft.outDate, draft.outTime);
  if (end == null) return { field: 'out', problem: 'outBlank' };
  if (end <= start) return { field: 'out', problem: 'order' };
  if (end - start > LONGEST) return { field: 'out', problem: 'long' };

  return null;
}

export function draftOf(shift: Scheduled, times: Recorded, stillOn = false): TimesDraft {
  const start = times.clockIn ?? shift.start;
  const end = times.clockOut ?? shift.end;

  return {
    inDate: dateOf(start),
    inTime: clock(start),
    outDate: dateOf(end),
    outTime: stillOn && times.clockOut == null ? '' : clock(end),
  };
}
