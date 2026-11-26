import { YOU } from './staffLink.ts';
import {
  type Plan,
  type Shift,
  DAY,
  clock,
  dateOf,
  jobName,
  minutesOf,
  personName,
  samplePlan,
  weekdayOf,
} from './shifts.ts';
import type { DemoLink } from './settings.ts';
import { STATIONS_EVENT } from './stations.ts';

export const OPENS_BEFORE = 60;
export const OUT_AFTER_END = 6 * 60;
export const LONGEST = 24 * 60;

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

export const LIVE_NOW = h(20, 30);
export const CORRECTED_AT = h(26, 10);

export interface Change {
  field: 'in' | 'out';
  was: number | null;
}

export interface Times {
  clockIn: number | null;
  clockOut: number | null;
  corrected?: { changes: Change[]; by: string; at: number };
}

export type Clocks = Record<string, Times>;

export const placeKey = (shift: string, person: string) => `${shift}:${person}`;

const t = (clockIn: number | null, clockOut: number | null): Times => ({ clockIn, clockOut });

export function sampleClocks(): Clocks {
  return {
    'lead:ifeoma': t(h(15, 52), null),
    'w1:amina': t(h(16, 55), h(24, 20)),
    'w1:grace': t(h(16, 58), h(24, 42)),
    'w1:kunle': t(h(17, 4), h(24, 5)),
    'w2:emeka': t(null, null),
    'run:ronke': t(h(16, 50), h(24, 12)),
    'cook:bisi': t(h(14, 48), h(23, 30)),
    'cook:tayo': t(h(14, 55), h(23, 5)),
    'cook:ada': t(h(15, 10), h(23, 20)),
    'bar1:sade': t(h(15, 58), h(25, 35)),
    'door1:tolu': t(h(16, 25), h(21, 2)),
    'door2:tolu': t(h(22, 56), h(26, 10)),
  };
}

export const opensAt = (shift: Pick<Shift, 'start'>) => shift.start - OPENS_BEFORE;

export const outLimit = (shift: Pick<Shift, 'end'>, clockIn: number) =>
  Math.min(shift.end + OUT_AFTER_END, clockIn + LONGEST);

export type Mark = 'notOut' | 'noAttendance' | null;

export interface Worked {
  minutes: number;
  assumed: number;
  mark: Mark;
}

/** A missing clock-out counts the scheduled end, a missing clock-in nothing, each with its mark. */
export function workedOf(shift: Pick<Shift, 'end'>, times: Times): Worked {
  if (times.clockIn == null) return { minutes: 0, assumed: 0, mark: 'noAttendance' };
  if (times.clockOut == null) {
    const minutes = Math.max(0, shift.end - times.clockIn);

    return { minutes, assumed: minutes, mark: 'notOut' };
  }

  return { minutes: times.clockOut - times.clockIn, assumed: 0, mark: null };
}

/** The one way a length of time is written in the web demo: "42 min", "0 h", "8 h", "8 h 44 min". */
export function hoursWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0 && rest > 0) return `${rest} min`;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export interface HoursRow {
  key: string;
  shift: Shift;
  person: string;
  name: string;
  job: string;
  times: Times;
  removed: boolean;
}

/** Someone taken off the roster after clocking in: off the shift, so not in the plan, and only their name kept with their times. */
export interface Removed {
  shift: string;
  person: string;
  name: string;
}

/** Every assigned place, a row each, then whoever was removed from that shift after clocking in; a place nobody has taken has no row. */
export function rowsOf(plan: Plan, clocks: Clocks, removed: readonly Removed[] = []): HoursRow[] {
  return [...plan.shifts]
    .sort((a, b) => a.start - b.start || a.job.localeCompare(b.job))
    .flatMap((shift) => [
      ...shift.people.map((person) => ({
        key: placeKey(shift.id, person),
        shift,
        person,
        name: personName(plan, person),
        job: jobName(plan, shift.job),
        times: clocks[placeKey(shift.id, person)] ?? t(null, null),
        removed: false,
      })),
      ...removed
        .filter((one) => one.shift === shift.id)
        .map((one) => ({
          key: placeKey(shift.id, one.person),
          shift,
          person: one.person,
          name: one.name,
          job: jobName(plan, shift.job),
          times: clocks[placeKey(shift.id, one.person)] ?? t(null, null),
          removed: true,
        })),
    ]);
}

/** During service only what has happened by `now` shows. */
export function liveClocks(clocks: Clocks, now = LIVE_NOW): Clocks {
  return Object.fromEntries(
    Object.entries(clocks).map(([key, one]) => [
      key,
      t(
        one.clockIn != null && one.clockIn <= now ? one.clockIn : null,
        one.clockOut != null && one.clockOut <= now ? one.clockOut : null,
      ),
    ]),
  );
}

export const HW = {
  tab: 'Hours worked',
  title: 'Hours worked',
  sub: 'When each person actually clocked in and out, beside their shift.',
  person: 'Person',
  scheduled: 'Scheduled',
  clocked: 'Clocked',
  hours: 'Hours',
  status: 'Status',
  tableLabel: 'Hours worked by person and shift',
  range: (a: number, b: number) => `${clock(a)} to ${clock(b)}`,
  inOut: (a: string, b: string) => `In ${a} · Out ${b}`,
  inOnly: (a: string) => `In ${a} · No clock-out`,
  noIn: 'No clock-in',
  clockedIn: 'Clocked in',
  clockedOut: 'Clocked out',
  notYet: 'Not clocked in yet',
  opensAt: (time: string) => `Clock-in opens at ${time}`,
  openedAt: (time: string) => `Clock-in opened at ${time}`,
  notOut: (end: string) => `Not clocked out · Counted to ${end}, the scheduled end`,
  noAttendance: 'No attendance recorded · 0 h counted',
  removed: 'Removed from the roster',
  worked: 'Hours worked',
  of: (worked: string, scheduled: string) => `${worked} of ${scheduled} scheduled`,
  assumed: (time: string) => `of which ${time} assumed (not clocked out)`,
  noneShifts: (n: number) =>
    n === 1 ? '1 shift with no attendance recorded' : `${n} shifts with no attendance recorded`,
  liveHead: (on: number, all: number) => `${on} of ${all} clocked in`,
  liveAt: (time: string) => `As of ${time}`,
  correct: 'Correct times',
  correctOf: (name: string) => `Correct times, ${name}`,
  correctTitle: (name: string) => `Correct ${name}’s times`,
  correctSub: (job: string, range: string) => `${job} · ${range}`,
  clockIn: 'Clocked in',
  clockOut: 'Clocked out',
  recorded: (time: string) => `Recorded ${time}`,
  notRecordedOut: (end: string) => `Not recorded, counted to ${end}`,
  notRecorded: 'Not recorded',
  keepsOriginal: 'The recorded times are kept beside your correction, with your name and when.',
  save: 'Save times',
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
  long: 'A shift cannot be longer than 24 hours. Check the dates.',
  readOnly: 'You can see the hours. Correcting a time needs permission to manage staff.',
  loading: 'Loading hours worked',
  failed: 'The hours could not load. Check your connection and try again.',
  tryAgain: 'Try again',
  empty: 'Nobody is on a shift yet',
  emptyLine: 'Hours show here once people are assigned to shifts.',
  openJobs: 'Open Jobs and shifts',
} as const;

export const trailTime = (at: number) => `${weekdayOf(dateOf(at))} ${clock(at)}`;

export type Live = 'in' | 'notYet' | 'out' | 'later';

export function liveOf(row: HoursRow, now = LIVE_NOW): Live {
  if (row.times.clockIn != null) return row.times.clockOut == null ? 'in' : 'out';

  return opensAt(row.shift) > now ? 'later' : 'notYet';
}

export function clockedWords(row: HoursRow): string {
  const { times } = row;
  if (times.clockIn == null) return HW.noIn;

  return times.clockOut == null
    ? HW.inOnly(clock(times.clockIn))
    : HW.inOut(clock(times.clockIn), clock(times.clockOut));
}

/** One line for each time that differs from what was recorded, from what, by whom and when. */
export function trailWords(row: HoursRow): string[] {
  const trail = row.times.corrected;
  if (trail == null) return [];
  const at = trailTime(trail.at);

  return trail.changes.map(({ field, was }) =>
    field === 'in'
      ? HW.correctedIn(
          clock(row.times.clockIn ?? 0),
          was == null ? HW.noClockIn : clock(was),
          trail.by,
          at,
        )
      : HW.correctedOut(
          clock(row.times.clockOut ?? 0),
          was == null ? HW.noClockOut : clock(was),
          trail.by,
          at,
        ),
  );
}

export function markWords(row: HoursRow): string | null {
  const { mark } = workedOf(row.shift, row.times);
  if (mark === 'notOut') return HW.notOut(clock(row.shift.end));

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
    (sum, row) => {
      const worked = workedOf(row.shift, row.times);

      return {
        worked: sum.worked + worked.minutes,
        scheduled: sum.scheduled + (row.shift.end - row.shift.start),
        assumed: sum.assumed + worked.assumed,
        none: sum.none + (worked.mark === 'noAttendance' ? 1 : 0),
      };
    },
    { worked: 0, scheduled: 0, assumed: 0, none: 0 },
  );
}

export function summaryRest(s: Pick<Summary, 'assumed' | 'none'>): string | null {
  const rest = [
    s.assumed > 0 ? HW.assumed(hoursWords(s.assumed)) : null,
    s.none > 0 ? HW.noneShifts(s.none) : null,
  ].filter((one) => one != null);

  return rest.length === 0 ? null : rest.join(' · ');
}

export interface TimesDraft {
  inDate: string;
  inTime: string;
  outDate: string;
  outTime: string;
}

export type Problems = { in?: string; out?: string };

/** The 16 Oct checks; each time carries its date, so nothing guesses the day. */
export function timesProblems(draft: TimesDraft, stillOn: boolean): Problems {
  const start = minutesOf(draft.inDate, draft.inTime);
  if (start == null) return { in: HW.inBlank };
  if (draft.outTime.trim() === '') return stillOn ? {} : { out: HW.outBlank };
  const end = minutesOf(draft.outDate, draft.outTime);
  if (end == null) return { out: HW.outBlank };
  if (end <= start) return { out: HW.order };
  if (end - start > LONGEST) return { out: HW.long };

  return {};
}

/** Clocked in, not clocked out, and still able to clock out under Recording's limit. */
export const stillOnOf = (row: HoursRow, live: boolean, now = LIVE_NOW) =>
  live &&
  !row.removed &&
  row.times.clockIn != null &&
  row.times.clockOut == null &&
  now <= outLimit(row.shift, row.times.clockIn);

export function draftOf(row: HoursRow, stillOn = false): TimesDraft {
  const start = row.times.clockIn ?? row.shift.start;
  const end = row.times.clockOut ?? row.shift.end;

  return {
    inDate: dateOf(start),
    inTime: clock(start),
    outDate: dateOf(end),
    outTime: stillOn && row.times.clockOut == null ? '' : clock(end),
  };
}

export function recordedOf(times: Times): Pick<Times, 'clockIn' | 'clockOut'> {
  const was = (field: Change['field'], now: number | null) => {
    const change = times.corrected?.changes.find((one) => one.field === field);

    return change == null ? now : change.was;
  };

  return { clockIn: was('in', times.clockIn), clockOut: was('out', times.clockOut) };
}

/** The trail names each time that now differs from what was recorded; saving nothing new leaves the row as it was. */
export function corrected(times: Times, draft: TimesDraft, by: string, at: number): Times {
  const clockIn = minutesOf(draft.inDate, draft.inTime);
  const clockOut = draft.outTime.trim() === '' ? null : minutesOf(draft.outDate, draft.outTime);
  if (clockIn === times.clockIn && clockOut === times.clockOut) return times;
  const recorded = recordedOf(times);
  const changes: Change[] = [
    ...(clockIn === recorded.clockIn ? [] : [{ field: 'in' as const, was: recorded.clockIn }]),
    ...(clockOut === recorded.clockOut ? [] : [{ field: 'out' as const, was: recorded.clockOut }]),
  ];

  return changes.length === 0
    ? { clockIn, clockOut }
    : { clockIn, clockOut, corrected: { changes, by, at } };
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

export const hoursStateOf = (raw: string | null): HoursState =>
  (HOURS_STATES as readonly string[]).includes(raw ?? '') ? (raw as HoursState) : 'list';

export interface HoursStart {
  plan: Plan;
  clocks: Clocks;
  removed: Removed[];
  live: boolean;
  manage: boolean;
  open: { key: string; draft: TimesDraft; pressed: boolean } | null;
}

const LEAD = placeKey('lead', 'ifeoma');
const NO_SHOW = placeKey('w2', 'emeka');

/** Femi was taken off the roster while clocked in on Runner, so his place opened and Chinedu took it. */
const FEMI: Removed = { shift: 'run', person: 'femi', name: 'Femi Adeyemi' };

function withRemoved(plan: Plan, clocks: Clocks): Pick<HoursStart, 'plan' | 'clocks' | 'removed'> {
  return {
    plan: {
      ...plan,
      shifts: plan.shifts.map((one) =>
        one.id === FEMI.shift ? { ...one, people: [...one.people, 'chinedu'] } : one,
      ),
    },
    clocks: {
      ...clocks,
      [placeKey(FEMI.shift, FEMI.person)]: t(h(16, 52), null),
      [placeKey(FEMI.shift, 'chinedu')]: t(h(20, 15), h(24, 8)),
    },
    removed: [FEMI],
  };
}

export function hoursStart(state: HoursState): HoursStart {
  const plan = samplePlan();
  const clocks = sampleClocks();
  const rows = rowsOf(plan, clocks);
  const lead = rows.find((one) => one.key === LEAD) as HoursRow;
  const noShow = rows.find((one) => one.key === NO_SHOW) as HoursRow;
  const leadDraft = draftOf(lead);
  const opened: Partial<Record<HoursState, HoursStart['open']>> = {
    correct: { key: LEAD, draft: leadDraft, pressed: false },
    correct_in: { key: NO_SHOW, draft: draftOf(noShow), pressed: false },
    correct_blank: { key: LEAD, draft: { ...leadDraft, inTime: '' }, pressed: true },
    correct_order: {
      key: LEAD,
      draft: { ...leadDraft, outDate: leadDraft.inDate, outTime: '01:15' },
      pressed: true,
    },
    correct_long: {
      key: LEAD,
      draft: { ...leadDraft, outDate: dateOf(lead.shift.end + DAY), outTime: '01:15' },
      pressed: true,
    },
  };
  const fixed =
    state === 'corrected'
      ? {
          ...clocks,
          [LEAD]: corrected(
            clocks[LEAD] as Times,
            { ...leadDraft, outTime: '01:15' },
            YOU,
            CORRECTED_AT,
          ),
        }
      : clocks;

  return {
    plan: state === 'empty' ? { ...plan, shifts: [] } : plan,
    clocks: state === 'list_live' ? liveClocks(clocks) : fixed,
    removed: [],
    ...(state === 'removed' ? withRemoved(plan, clocks) : {}),
    live: state === 'list_live',
    manage: state !== 'read_only',
    open: opened[state] ?? null,
  };
}

export const hoursAt = (state: string) =>
  `/demo/events/${STATIONS_EVENT}/staff/hours?state=${state}`;

const link = (state: HoursState, name: string): DemoLink => ({ to: hoursAt(state), name });

export const HOURS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Hours worked (StaffHours, sc-234)',
    states: [
      link('list', 'After the shift: scheduled, clocked and hours, both marks'),
      link('list_live', 'During service: Clocked in, Not clocked in yet'),
      link('corrected', 'Corrected: Out 01:15 · corrected from no clock-out'),
      link('read_only', 'Without staff.manage: no Correct times'),
      link('removed', 'Removed from the roster: Femi Adeyemi, not clocked out, beside Chinedu Eze'),
      link('loading', 'Loading'),
      link('failed', 'Cannot load'),
      link('empty', 'Nobody on a shift'),
    ],
  },
  {
    name: 'Correct times',
    states: [
      link('correct', 'Ifeoma Nduka, no clock-out'),
      link('correct_in', 'Emeka Obi, no attendance recorded'),
      link('correct_blank', 'No clock-in'),
      link('correct_order', 'The end before the start'),
      link('correct_long', 'Over 24 hours'),
    ],
  },
];
