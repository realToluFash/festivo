/** Clocking in and out, and the hours actually worked (sc-234). Every time is an instant in the event's offset (ISO 8601); a correction is typed as the event's wall clock, as a shift's times are. */

export type ClockPhase = 'before' | 'ready' | 'on' | 'off' | 'closed';

export interface ShiftClockCard {
  phase: ClockPhase;
  opensAt: string;
  closesAt: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  /** Until when Clock out is taken: the earlier of the scheduled end + 6 h and the clock-in + 24 h; null before a clock-in. */
  outUntil: string | null;
  workedMinutes: number | null;
}

export type ClockAction = 'in' | 'out';

/** `already` changed nothing; `signedOut` is a browser past access, whose session ended with the clock-out. */
export interface ClockOutcome {
  outcome: 'recorded' | 'already';
  clock: ShiftClockCard;
  signedOut: boolean;
}

export type HoursMark = 'not_clocked_out' | 'no_attendance';

export type HoursLive = 'in' | 'not_yet' | 'out' | 'later';

/** One time that now differs from what was recorded: `was` is null when nothing was. */
export interface HoursCorrection {
  field: 'in' | 'out';
  was: string | null;
  by: string;
  at: string;
}

export interface HoursRow {
  shiftId: string;
  staffId: string;
  name: string;
  job: string;
  startsAt: string;
  endsAt: string;
  scheduledMinutes: number;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  recordedInAt: string | null;
  recordedOutAt: string | null;
  workedMinutes: number;
  assumedMinutes: number;
  /** Null while the shift has not ended, and for a row with both times. */
  mark: HoursMark | null;
  live: HoursLive;
  opensAt: string;
  /** Clocked in, not clocked out, and still able to clock out: a correction may leave the clock-out empty. */
  stillOn: boolean;
  corrections: HoursCorrection[];
}

export interface HoursSummary {
  workedMinutes: number;
  scheduledMinutes: number;
  assumedMinutes: number;
  noAttendance: number;
  clockedIn: number;
  total: number;
}

/** An event's hours worked; `live` is during service, before its last shift's scheduled end. */
export interface StaffHours {
  timeZone: string;
  now: string;
  live: boolean;
  canCorrect: boolean;
  rows: HoursRow[];
  summary: HoursSummary;
}

/** A correction as typed: `YYYY-MM-DDTHH:MM` on the event's clock; `clockedOutAt` null only while still clocked in. */
export interface HoursTyped {
  clockedInAt: string;
  clockedOutAt: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const textOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const PHASES: readonly ClockPhase[] = ['before', 'ready', 'on', 'off', 'closed'];
const LIVES: readonly HoursLive[] = ['in', 'not_yet', 'out', 'later'];

export function asShiftClockCard(raw: unknown): ShiftClockCard | null {
  if (!isRecord(raw)) return null;
  const { phase, opensAt, closesAt, clockedInAt, clockedOutAt, outUntil, workedMinutes } = raw;

  return PHASES.includes(phase as ClockPhase) &&
    typeof opensAt === 'string' &&
    typeof closesAt === 'string' &&
    textOrNull(clockedInAt) &&
    textOrNull(clockedOutAt) &&
    textOrNull(outUntil) &&
    (workedMinutes === null || count(workedMinutes))
    ? {
        phase: phase as ClockPhase,
        opensAt,
        closesAt,
        clockedInAt,
        clockedOutAt,
        outUntil,
        workedMinutes,
      }
    : null;
}

export function asClockOutcome(raw: unknown): ClockOutcome | null {
  if (!isRecord(raw)) return null;
  const clock = asShiftClockCard(raw.clock);
  const { outcome, signedOut } = raw;

  return clock != null &&
    (outcome === 'recorded' || outcome === 'already') &&
    typeof signedOut === 'boolean'
    ? { outcome, clock, signedOut }
    : null;
}

function asCorrection(raw: unknown): HoursCorrection | null {
  if (!isRecord(raw)) return null;
  const { field, was, by, at } = raw;

  return (field === 'in' || field === 'out') &&
    textOrNull(was) &&
    typeof by === 'string' &&
    typeof at === 'string'
    ? { field, was, by, at }
    : null;
}

function asRow(raw: unknown): HoursRow | null {
  if (!isRecord(raw) || !Array.isArray(raw.corrections)) return null;
  const corrections = raw.corrections.map(asCorrection);
  const strings = ['shiftId', 'staffId', 'name', 'job', 'startsAt', 'endsAt', 'opensAt'] as const;
  const times = ['clockedInAt', 'clockedOutAt', 'recordedInAt', 'recordedOutAt'] as const;
  const counts = ['scheduledMinutes', 'workedMinutes', 'assumedMinutes'] as const;

  if (
    !strings.every((key) => typeof raw[key] === 'string') ||
    !times.every((key) => textOrNull(raw[key])) ||
    !counts.every((key) => count(raw[key])) ||
    !(raw.mark === null || raw.mark === 'not_clocked_out' || raw.mark === 'no_attendance') ||
    !LIVES.includes(raw.live as HoursLive) ||
    typeof raw.stillOn !== 'boolean' ||
    !corrections.every((one) => one != null)
  )
    return null;

  return { ...(raw as unknown as HoursRow), corrections: corrections as HoursCorrection[] };
}

export function asStaffHours(raw: unknown): StaffHours | null {
  if (!isRecord(raw) || !Array.isArray(raw.rows) || !isRecord(raw.summary)) return null;
  const rows = raw.rows.map(asRow);
  const { summary } = raw;
  const sums = [
    'workedMinutes',
    'scheduledMinutes',
    'assumedMinutes',
    'noAttendance',
    'clockedIn',
    'total',
  ] as const;

  return typeof raw.timeZone === 'string' &&
    typeof raw.now === 'string' &&
    typeof raw.live === 'boolean' &&
    typeof raw.canCorrect === 'boolean' &&
    rows.every((row) => row != null) &&
    sums.every((key) => count(summary[key]))
    ? {
        timeZone: raw.timeZone,
        now: raw.now,
        live: raw.live,
        canCorrect: raw.canCorrect,
        rows: rows as HoursRow[],
        summary: summary as unknown as HoursSummary,
      }
    : null;
}
