import {
  type Recorded,
  type Scheduled,
  type TimeProblem,
  type TimesDraft,
  canClockOut,
  clock,
  draftOf,
  hoursWords,
  minutesOf,
  opensAt,
  scheduledMinutes,
  weekdayOf,
  workedOf,
} from './clock.ts';

export interface Change {
  field: 'in' | 'out';
  was: number | null;
}

export interface HoursRow extends Scheduled, Recorded {
  id: string;
  name: string;
  job: string;
  removed?: boolean;
  corrected?: { changes: Change[]; by: string; at: number };
}

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

export const YOU = 'Amara Nwosu';
export const EVENT = 'Adébáyọ̀ at 60';
export const LIVE_NOW = h(21, 30);
export const CORRECTED_AT = h(26, 10);

const row = (
  id: string,
  name: string,
  job: string,
  start: number,
  end: number,
  clockIn: number | null,
  clockOut: number | null,
): HoursRow => ({ id, name, job, start, end, clockIn, clockOut });

export function sampleRows(): HoursRow[] {
  return [
    row('dayo', 'Dayo Okafor', 'Floor lead', h(14), h(26), h(13, 52), h(26, 20)),
    row('chidi', 'Chidi Okoro', 'Kitchen', h(13), h(24), h(12, 58), h(24, 31)),
    row('grace', 'Grace Okon', 'Waiter', h(17), h(25), h(16, 58), h(25, 42)),
    row('tope', 'Tope Bello', 'Waiter', h(17), h(25), h(16, 55), null),
    row('yusuf', 'Yusuf Bello', 'Waiter', h(17), h(25), null, null),
    row('amina', 'Amina Yusuf', 'Runner', h(18), h(25), h(17, 50), h(25, 5)),
    row('kelechi', 'Kelechi Nnamdi', 'Runner', h(18), h(25), h(18, 10), null),
  ];
}

/** Femi was taken off the roster while clocked in, so his place opened and Ngozi took it; his times stay under his name. */
export function removedRows(): HoursRow[] {
  return sampleRows().flatMap((one) =>
    one.id === 'kelechi'
      ? [
          one,
          {
            ...row('femi', 'Femi Adeyemi', 'Runner', h(18), h(25), h(17, 48), null),
            removed: true,
          },
          row('ngozi', 'Ngozi Eze', 'Runner', h(18), h(25), h(20, 40), h(25, 12)),
        ]
      : [one],
  );
}

/** During service only what has happened by `now` is shown: a clock-out still to come is not there yet. */
export function liveRows(now = LIVE_NOW): HoursRow[] {
  return sampleRows().map((one) => ({
    ...one,
    clockIn: one.clockIn != null && one.clockIn <= now ? one.clockIn : null,
    clockOut: one.clockOut != null && one.clockOut <= now ? one.clockOut : null,
  }));
}

export const HW = {
  title: 'Hours',
  heading: (event: string) => `${event} · Hours`,
  scheduled: 'Scheduled',
  clocked: 'Clocked',
  hours: 'Hours',
  range: (a: number, b: number) => `${clock(a)} to ${clock(b)}`,
  inOut: (a: string, b: string) => `In ${a} · Out ${b}`,
  inOnly: (a: string) => `In ${a} · No clock-out`,
  noIn: 'No clock-in',
  clockedIn: 'Clocked in',
  clockedInAt: (time: string) => `Clocked in · ${time}`,
  notYet: 'Not clocked in yet',
  opensAt: (time: string) => `Clock-in opened at ${time}`,
  notOut: (end: string) => `Not clocked out · Counted to ${end}, the scheduled end`,
  noAttendance: 'No attendance recorded · 0 h counted',
  removed: 'Removed from the roster',
  worked: 'Hours worked',
  of: (worked: string, scheduled: string) => `${worked} of ${scheduled} scheduled`,
  assumed: (time: string) => `of which ${time} assumed (not clocked out)`,
  noneShifts: (n: number) =>
    n === 1 ? '1 shift with no attendance recorded' : `${n} shifts with no attendance recorded`,
  liveSummary: (on: number, all: number) => `${on} of ${all} clocked in`,
  liveAt: (time: string) => `As of ${time}`,
  correct: 'Correct times',
  correctTitle: (name: string) => `Correct ${name}’s times`,
  correctSub: (job: string, a: number, b: number) => `${job} · ${clock(a)} to ${clock(b)}`,
  clockIn: 'Clocked in',
  clockOut: 'Clocked out',
  date: 'Date',
  time: 'Time',
  timeHelp: '24-hour, as 01:15',
  recorded: (time: string) => `Recorded ${time}`,
  notRecordedOut: (end: string) => `Not recorded, counted to ${end}`,
  notRecorded: 'Not recorded',
  save: 'Save times',
  saving: 'Saving…',
  cancel: 'Cancel',
  saved: (name: string) => `${name}’s times saved.`,
  correctedOut: (time: string, from: string, by: string, at: string) =>
    `Out ${time} · corrected from ${from} by ${by}, ${at}`,
  correctedIn: (time: string, from: string, by: string, at: string) =>
    `In ${time} · corrected from ${from} by ${by}, ${at}`,
  noClockIn: 'no clock-in',
  noClockOut: 'no clock-out',
  inBlank: 'Enter the time they started.',
  outBlank: 'Enter the time they finished.',
  order: 'The end must be after the start.',
  long: 'A shift can’t be longer than 24 hours. Check the dates.',
  readOnly: 'You can see the hours. Correcting a time needs permission to manage staff.',
  loading: 'Loading hours worked',
  failed: 'The hours could not load. Check your connection and try again.',
  tryAgain: 'Try again',
  empty: 'Nobody is on a shift yet',
  emptyLine: 'Hours show here once people are assigned to shifts.',
} as const;

export const PROBLEM_WORDS: Record<Exclude<TimeProblem, null>, string> = {
  inBlank: HW.inBlank,
  outBlank: HW.outBlank,
  order: HW.order,
  long: HW.long,
};

/** The trail's time always gives its weekday: it is read days later. */
export const trailTime = (at: number) => `${weekdayOf(at)} ${clock(at)}`;

export type Live = 'in' | 'notYet' | 'out';

export function liveOf(one: HoursRow): Live {
  if (one.clockIn == null) return 'notYet';

  return one.clockOut == null ? 'in' : 'out';
}

export function liveWords(one: HoursRow): string {
  const live = liveOf(one);
  if (live === 'notYet') return HW.notYet;
  if (live === 'in') return HW.clockedInAt(clock(one.clockIn ?? 0));

  return HW.inOut(clock(one.clockIn ?? 0), clock(one.clockOut ?? 0));
}

export const liveNote = (one: HoursRow) => HW.opensAt(clock(opensAt(one)));

export function clockedWords(one: HoursRow): string {
  if (one.clockIn == null) return HW.noIn;

  return one.clockOut == null
    ? HW.inOnly(clock(one.clockIn))
    : HW.inOut(clock(one.clockIn), clock(one.clockOut));
}

/** One line for each time that differs from what was recorded, from what, by whom and when. */
export function trailWords(one: HoursRow): string[] {
  const trail = one.corrected;
  if (trail == null) return [];
  const at = trailTime(trail.at);

  return trail.changes.map(({ field, was }) =>
    field === 'in'
      ? HW.correctedIn(
          clock(one.clockIn ?? 0),
          was == null ? HW.noClockIn : clock(was),
          trail.by,
          at,
        )
      : HW.correctedOut(
          clock(one.clockOut ?? 0),
          was == null ? HW.noClockOut : clock(was),
          trail.by,
          at,
        ),
  );
}

/** Clocked in, not clocked out, and still able to clock out under Recording's limit. */
export const stillOnOf = (one: HoursRow, live: boolean, now = LIVE_NOW) =>
  live && one.removed !== true && one.clockOut == null && canClockOut(one, one.clockIn, now);

export function markWords(one: HoursRow): string | null {
  const { mark } = workedOf(one, one);
  if (mark === 'notOut') return HW.notOut(clock(one.end));

  return mark === 'noAttendance' ? HW.noAttendance : null;
}

export interface Summary {
  worked: number;
  scheduled: number;
  assumed: number;
  none: number;
}

export function summaryOf(rows: readonly HoursRow[]): Summary {
  return rows.reduce<Summary>(
    (sum, one) => {
      const worked = workedOf(one, one);

      return {
        worked: sum.worked + worked.minutes,
        scheduled: sum.scheduled + scheduledMinutes(one),
        assumed: sum.assumed + worked.assumed,
        none: sum.none + (worked.mark === 'noAttendance' ? 1 : 0),
      };
    },
    { worked: 0, scheduled: 0, assumed: 0, none: 0 },
  );
}

export function summaryLines(s: Summary): { head: string; rest: string | null } {
  const rest = [
    s.assumed > 0 ? HW.assumed(hoursWords(s.assumed)) : null,
    s.none > 0 ? HW.noneShifts(s.none) : null,
  ].filter((one) => one != null);

  return {
    head: HW.of(hoursWords(s.worked), hoursWords(s.scheduled)),
    rest: rest.length === 0 ? null : rest.join(' · '),
  };
}

/** What was recorded, before any correction. */
export function recordedOf(one: HoursRow): Recorded {
  const was = (field: Change['field'], now: number | null) => {
    const change = one.corrected?.changes.find((each) => each.field === field);

    return change == null ? now : change.was;
  };

  return { clockIn: was('in', one.clockIn), clockOut: was('out', one.clockOut) };
}

/** The trail names each time that now differs from what was recorded; saving nothing new leaves the row as it was. */
export function corrected(one: HoursRow, draft: TimesDraft, by: string, at: number): HoursRow {
  const clockIn = minutesOf(draft.inDate, draft.inTime);
  const clockOut = draft.outTime.trim() === '' ? null : minutesOf(draft.outDate, draft.outTime);
  if (clockIn === one.clockIn && clockOut === one.clockOut) return one;
  const recorded = recordedOf(one);
  const changes: Change[] = [
    ...(clockIn === recorded.clockIn ? [] : [{ field: 'in' as const, was: recorded.clockIn }]),
    ...(clockOut === recorded.clockOut ? [] : [{ field: 'out' as const, was: recorded.clockOut }]),
  ];
  const { corrected: _was, ...rest } = one;

  return changes.length === 0
    ? { ...rest, clockIn, clockOut }
    : { ...rest, clockIn, clockOut, corrected: { changes, by, at } };
}

export const HOURS_STATES = [
  'list',
  'list_live',
  'correct',
  'correct_in',
  'correct_blank',
  'correct_order',
  'correct_long',
  'corrected',
  'read_only',
  'removed',
  'loading',
  'failed',
  'empty',
] as const;

export type HoursState = (typeof HOURS_STATES)[number];

export const hoursStateOf = (raw: string | undefined): HoursState =>
  (HOURS_STATES as readonly string[]).includes(raw ?? '') ? (raw as HoursState) : 'list';

export interface HoursStart {
  rows: HoursRow[];
  live: boolean;
  manage: boolean;
  open: { id: string; draft: TimesDraft; pressed: boolean } | null;
}

export function hoursStart(state: HoursState): HoursStart {
  const rows = sampleRows();
  const tope = rows.find((one) => one.id === 'tope') as HoursRow;
  const yusuf = rows.find((one) => one.id === 'yusuf') as HoursRow;
  const topeDraft = draftOf(tope, tope);
  const opened: Partial<Record<HoursState, HoursStart['open']>> = {
    correct: { id: 'tope', draft: topeDraft, pressed: false },
    correct_in: { id: 'yusuf', draft: draftOf(yusuf, yusuf), pressed: false },
    correct_blank: { id: 'tope', draft: { ...topeDraft, inTime: '' }, pressed: true },
    correct_order: {
      id: 'tope',
      draft: { ...topeDraft, outDate: topeDraft.inDate, outTime: '01:15' },
      pressed: true,
    },
    correct_long: {
      id: 'tope',
      draft: { ...topeDraft, outDate: '2026-10-19', outTime: '01:15' },
      pressed: true,
    },
  };

  return {
    rows:
      state === 'empty'
        ? []
        : state === 'list_live'
          ? liveRows()
          : state === 'removed'
            ? removedRows()
            : state === 'corrected'
              ? rows.map((one) =>
                  one.id === 'tope'
                    ? corrected(one, { ...topeDraft, outTime: '01:15' }, YOU, CORRECTED_AT)
                    : one,
                )
              : rows,
    live: state === 'list_live',
    manage: state !== 'read_only',
    open: opened[state] ?? null,
  };
}

export const HOURS_BOARD_TITLES: Record<HoursState, [string, string]> = {
  list: ['After the shift', 'Scheduled, clocked and hours on each row, both marks'],
  list_live: ['During service', 'Clocked in, Not clocked in yet'],
  correct: ['Correct times', 'Tope Bello, no clock-out, each recorded time beside its field'],
  correct_in: ['Correct times, a missing clock-in', 'Yusuf Bello, no attendance recorded'],
  correct_blank: ['Correct times, no clock-in', 'Enter the time they started.'],
  correct_order: ['Correct times, the end before the start', 'The end must be after the start.'],
  correct_long: ['Correct times, over 24 hours', 'A shift can’t be longer than 24 hours'],
  corrected: ['Corrected', 'Out 01:15 · corrected from no clock-out'],
  read_only: ['Without staff.manage', 'No Correct times'],
  removed: [
    'Removed from the roster',
    'Femi Adeyemi, not clocked out, beside Ngozi Eze in his place',
  ],
  loading: ['Loading', 'Rows drawn as they will sit'],
  failed: ['Cannot load', 'Try again'],
  empty: ['Nobody on a shift', 'Empty'],
};
