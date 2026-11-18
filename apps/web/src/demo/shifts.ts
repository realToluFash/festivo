import { sample as rosterSample } from './roster.ts';
import type { DemoLink } from './settings.ts';
import { STATIONS_EVENT } from './stations.ts';

/** Jobs and shifts on the event's Staff page (sc-3908, JobsShifts-Desktop.dc.html on page e34): minutes from 00:00 on the event's first day. */
export const DAY = 24 * 60;
export const STEP = 30;
export const NEEDED_MAX = 50;
export const JOB_NAME_MAX = 60;
export const FIRST_DAY = '2026-11-07';
export const EVENT_HOURS = { start: 16 * 60, end: 26 * 60 } as const;
export const WEDDING_HOURS = { start: -30 * 60, end: 15 * 60 } as const;

export type Level = 'view' | 'checkIn' | 'floor' | 'pass' | 'run';

export const LEVELS: readonly { level: Level; words: string; hint: string }[] = [
  {
    level: 'view',
    words: 'Can view',
    hint: 'Sees the event and their own shifts. Changes nothing.',
  },
  { level: 'checkIn', words: 'Can check guests in', hint: 'Checks guests in at the door.' },
  {
    level: 'floor',
    words: 'Can work the floor',
    hint: 'Serves their tables and marks what went out.',
  },
  { level: 'pass', words: 'Can work the pass', hint: 'Sees and sends the orders at the pass.' },
  {
    level: 'run',
    words: 'Can run the floor',
    hint: 'Runs the floor on the night. Comes only through a personal link.',
  },
];

export interface Job {
  id: string;
  name: string;
  level: Level;
}

export interface Shift {
  id: string;
  job: string;
  start: number;
  end: number;
  needed: number;
  people: string[];
}

export interface Person {
  id: string;
  name: string;
  job: string | null;
}

export interface Plan {
  event: { start: number; end: number };
  jobs: Job[];
  shifts: Shift[];
  people: Person[];
}

export const JW = {
  tab: 'Jobs and shifts',
  coverage: 'Coverage',
  jobs: 'Jobs',
  addJob: 'Add a job',
  addShift: 'Add a shift',
  edit: 'Edit',
  editTimes: 'Edit times',
  assign: 'Assign',
  remove: 'Remove',
  strip: 'Strip',
  table: 'Table',
  view: 'Show coverage as',
  covered: 'Covered',
  noShifts: 'No shifts',
  noShiftsYet: 'No shifts yet. Add a shift and coverage shows here, job by job.',
  openPlace: 'Open place',
  full: 'Every place on this shift is filled. Unassign someone to make room.',
  name: 'Name',
  level: 'What their accounts can do on this event',
  job: 'Job',
  starts: 'Starts',
  ends: 'Ends',
  date: 'Date',
  time: 'Time',
  needed: 'People needed',
  neededHelp: 'From 1 to 50.',
  neededHelpEdit: 'From 1 to 50, and no fewer than the people on this shift.',
  nameHelp: 'At most 60 characters.',
  chooseJob: 'Choose a job',
  save: 'Save changes',
  add: 'Add',
  cancel: 'Cancel',
  close: 'Close',
  keep: 'Keep it',
  lock: 'You can see the jobs and shifts. Changing them needs permission to manage staff.',
  stripLabel: 'Coverage strip. Each job’s gaps are written under its row.',
  tableLabel: 'Coverage by job and time',
  thJob: 'Job',
  thTime: 'Time',
  thOn: 'On',
  thNeeded: 'Needed',
  thStatus: 'Status',
  nameBlank: 'Enter a name for the job.',
  nameLong: 'Keep the name to 60 characters or fewer.',
  nameTaken: (name: string) => `This event already has a job called ${name}.`,
  jobBlank: 'Choose a job.',
  startBlank: 'Enter the date and time the shift starts.',
  endBlank: 'Enter the date and time the shift ends.',
  endBefore: 'The end must be after the start.',
  tooLong: 'A shift can’t be longer than 24 hours. Check the dates.',
  neededRange: 'Enter a number from 1 to 50.',
  neededBelow: (n: number) =>
    `${n} people are on this shift. Unassign some first, or keep ${n} or more.`,
  midnight: (weekday: string, time: string) => `Ends on ${weekday} at ${time}`,
  onShift: (n: number) => (n === 1 ? 'On this shift · 1 person' : `On this shift · ${n} people`),
  filled: (on: number, needed: number) =>
    `${on} of ${needed} ${needed === 1 ? 'place' : 'places'} filled`,
  shiftCount: (n: number) => (n === 1 ? '1 shift' : `${n} shifts`),
  short: (n: number) => `Short ${n}`,
  summary: (short: number, covered: number) =>
    `${short === 1 ? '1 job is' : `${short} jobs are`} short at some point, ${covered} covered.`,
  overlap: (name: string, job: string, when: string) => `${name} is on ${job} from ${when}.`,
  worksAs: (name: string, job: string) => `${name} works as ${job} on this event.`,
  noJobYet: 'No job yet',
  takesJob: (job: string) => `No job yet. Takes ${job}.`,
  otherShifts: 'Not on another shift',
  assignTo: (job: string, when: string) => `Assign to ${job}, ${when}`,
  assigned: (name: string, job: string, when: string) => `${name} is on ${job} from ${when}.`,
  jobTaken: (name: string, job: string) => `${name}’s job is now ${job}.`,
  unassign: (name: string) => `Unassign ${name}`,
  unassigned: (name: string) => `${name} unassigned. The place is open.`,
  removeAsk: (job: string, shifts: number) =>
    `Remove ${job} and its ${shifts === 1 ? 'shift' : `${shifts} shifts`}?`,
  removeAskSub: 'Its shifts go with it. Nobody is on them.',
  removeRefused: 'Unassign its people first.',
  removeRefusedSub: (n: number) =>
    n === 1 ? '1 person is on its shifts.' : `${n} people are on its shifts.`,
  removed: (job: string) => `${job} removed.`,
  jobAdded: (job: string) => `${job} added.`,
  shiftAdded: (job: string, when: string) => `Shift added: ${job}, ${when}.`,
  saved: 'Saved.',
  editJob: (job: string) => `Edit ${job}`,
  editShift: (job: string, when: string) => `${job}, ${when}`,
  eventHours: (when: string) =>
    `The event runs from ${when}. A shift may start before it or end after it.`,
  notOnHere: 'Everyone on the roster is on this shift.',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** 24-hour clock in every locale (Decided, 15 Nov 2026). */
export function clock(minutes: number): string {
  const inDay = ((minutes % DAY) + DAY) % DAY;

  return `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`;
}

const DAY_MS = 86_400_000;
const FIRST_MS = Date.UTC(2026, 10, 7);

export function dateOf(minutes: number): string {
  return new Date(FIRST_MS + Math.floor(minutes / DAY) * DAY_MS).toISOString().slice(0, 10);
}

export function dayOf(minutes: number): string {
  return new Date(`${dateOf(minutes)}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function weekdayOf(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

export function minutesOf(date: string, time: string): number | null {
  const day = Date.parse(`${date}T00:00:00Z`);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (Number.isNaN(day) || match == null) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;

  return Math.round((day - FIRST_MS) / 60_000) + hours * 60 + mins;
}

export const overlaps = (a: Pick<Shift, 'start' | 'end'>, b: Pick<Shift, 'start' | 'end'>) =>
  a.start < b.end && b.start < a.end;

export const byStart = (a: Shift, b: Shift) => a.start - b.start || a.end - b.end;

export function jobName(plan: Plan, id: string | null): string {
  return plan.jobs.find((one) => one.id === id)?.name ?? JW.noJobYet;
}

export function levelWords(level: Level): string {
  return LEVELS.find((one) => one.level === level)?.words ?? '';
}

export function shiftsOf(plan: Plan, personId: string): Shift[] {
  return plan.shifts.filter((one) => one.people.includes(personId)).sort(byStart);
}

export function personName(plan: Plan, id: string): string {
  return plan.people.find((one) => one.id === id)?.name ?? '';
}

export interface Cell {
  on: number;
  needed: number;
}

export interface Span {
  start: number;
  end: number;
  on: number;
  needed: number;
}

export interface Coverage {
  job: Job;
  cells: (Cell | null)[];
  spans: Span[];
  gaps: { start: number; end: number; short: number }[];
}

function at(shifts: readonly Shift[], moment: number): Cell {
  const live = shifts.filter((one) => one.start <= moment && moment < one.end);

  return {
    on: live.reduce((sum, one) => sum + one.people.length, 0),
    needed: live.reduce((sum, one) => sum + one.needed, 0),
  };
}

export function spanOf(plan: Plan): { start: number; end: number } {
  return {
    start: Math.min(plan.event.start, ...plan.shifts.map((one) => one.start)),
    end: Math.max(plan.event.end, ...plan.shifts.map((one) => one.end)),
  };
}

export function windowOf(plan: Plan): { start: number; end: number } {
  const { start, end } = spanOf(plan);

  return { start: Math.floor(start / STEP) * STEP, end: Math.ceil(end / STEP) * STEP };
}

export function isLong(plan: Plan): boolean {
  const { start, end } = spanOf(plan);

  return end - start > DAY;
}

/** "16:00 to 01:00"; over 24 hours "Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00", the end's date left out on the start's date. */
export function rangeOf(plan: Plan, start: number, end: number): string {
  if (!isLong(plan)) return `${clock(start)} to ${clock(end)}`;
  const ends = dateOf(end) === dateOf(start) ? clock(end) : `${dayOf(end)}, ${clock(end)}`;

  return `${dayOf(start)}, ${clock(start)} to ${ends}`;
}

export interface Tick {
  at: number;
  words: string;
  day: boolean;
}

/** The strip's axis, a tick per step: each hour's clock time, and over 24 hours each midnight's day in place of 00:00, across that step and the next so it has room in every locale. */
export function ticksOf(plan: Plan): Tick[] {
  const window = windowOf(plan);
  const long = isLong(plan);
  const ticks: Tick[] = [];
  for (let at = window.start; at < window.end; at += STEP) {
    const day = long && clock(at) === '00:00';
    if (ticks.at(-1)?.day === true && ticks.at(-1)?.at === at - STEP) continue;
    ticks.push({ at, words: day ? dayOf(at) : at % 60 === 0 ? clock(at) : '', day });
  }

  return ticks;
}

/** Each job with shifts, step by step at the moment it is shortest, with its steady spans and its gaps written out. */
export function coverageOf(plan: Plan): Coverage[] {
  const window = windowOf(plan);

  return plan.jobs.flatMap((job) => {
    const shifts = plan.shifts.filter((one) => one.job === job.id);
    if (shifts.length === 0) return [];
    const marks = [...new Set(shifts.flatMap((one) => [one.start, one.end]))].sort((a, b) => a - b);

    const cells: (Cell | null)[] = [];
    for (let step = window.start; step < window.end; step += STEP) {
      const moments = [step, ...marks.filter((one) => one > step && one < step + STEP)];
      const worst = moments
        .map((moment) => at(shifts, moment))
        .filter((one) => one.needed > 0)
        .reduce<Cell | null>(
          (was, one) => (was == null || one.needed - one.on > was.needed - was.on ? one : was),
          null,
        );
      cells.push(worst);
    }

    const spans: Span[] = [];
    marks.slice(0, -1).forEach((start, index) => {
      const end = marks[index + 1] as number;
      const here = at(shifts, start);
      if (here.needed === 0) return;
      const last = spans.at(-1);
      if (last != null && last.end === start && last.on === here.on && last.needed === here.needed)
        last.end = end;
      else spans.push({ start, end, ...here });
    });

    const gaps: Coverage['gaps'] = [];
    for (const span of spans) {
      const short = span.needed - span.on;
      if (short <= 0) continue;
      const last = gaps.at(-1);
      if (last != null && last.end === span.start && last.short === short) last.end = span.end;
      else gaps.push({ start: span.start, end: span.end, short });
    }

    return [{ job, cells, spans, gaps }];
  });
}

export function summaryOf(coverage: readonly Coverage[]): string {
  const short = coverage.filter((one) => one.gaps.length > 0).length;

  return JW.summary(short, coverage.length - short);
}

const folded = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('en');

export interface JobDraft {
  name: string;
  level: Level;
}

export function jobProblem(plan: Plan, draft: JobDraft, editing: string | null): string | null {
  const name = draft.name.trim();
  if (name === '') return JW.nameBlank;
  if ([...name].length > JOB_NAME_MAX) return JW.nameLong;
  const same = plan.jobs.find((one) => one.id !== editing && folded(one.name) === folded(name));

  return same == null ? null : JW.nameTaken(same.name);
}

export interface ShiftDraft {
  job: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  needed: string;
}

export type ShiftProblems = { job?: string; start?: string; end?: string; needed?: string };

export const SHIFT_FIELDS = ['job', 'start', 'end', 'needed'] as const;

/** sc-234's corrections, then 1 to 50, then no fewer than the people already on it. */
export function shiftProblems(draft: ShiftDraft, onIt: number): ShiftProblems {
  const problems: ShiftProblems = {};
  if (draft.job === '') problems.job = JW.jobBlank;
  const start = minutesOf(draft.startDate, draft.startTime);
  const end = minutesOf(draft.endDate, draft.endTime);
  if (start == null) problems.start = JW.startBlank;
  if (end == null) problems.end = JW.endBlank;
  else if (start != null && end <= start) problems.end = JW.endBefore;
  else if (start != null && end - start > DAY) problems.end = JW.tooLong;
  const needed = /^\d+$/.test(draft.needed.trim()) ? Number(draft.needed) : NaN;
  if (!(needed >= 1 && needed <= NEEDED_MAX)) problems.needed = JW.neededRange;
  else if (needed < onIt) problems.needed = JW.neededBelow(onIt);

  return problems;
}

export function firstProblem(problems: ShiftProblems): (typeof SHIFT_FIELDS)[number] | null {
  return SHIFT_FIELDS.find((one) => problems[one] != null) ?? null;
}

export function midnightLine(draft: ShiftDraft): string | null {
  const start = minutesOf(draft.startDate, draft.startTime);
  const end = minutesOf(draft.endDate, draft.endTime);
  if (start == null || end == null || end <= start || end - start > DAY) return null;
  if (draft.endDate === draft.startDate) return null;

  return JW.midnight(weekdayOf(draft.endDate), draft.endTime);
}

export function shiftDraftOf(shift: Shift | null, job = '', day = FIRST_DAY): ShiftDraft {
  if (shift == null)
    return {
      job,
      startDate: day,
      startTime: '',
      endDate: day,
      endTime: '',
      needed: '1',
    };

  return {
    job: shift.job,
    startDate: dateOf(shift.start),
    startTime: clock(shift.start),
    endDate: dateOf(shift.end),
    endTime: clock(shift.end),
    needed: String(shift.needed),
  };
}

export function newOverlap(plan: Plan, shift: Shift, start: number, end: number): string | null {
  for (const id of shift.people) {
    const other = shiftsOf(plan, id).find(
      (one) => one.id !== shift.id && overlaps(one, { start, end }),
    );
    if (other != null)
      return JW.overlap(
        personName(plan, id),
        jobName(plan, other.job),
        rangeOf(plan, other.start, other.end),
      );
  }

  return null;
}

export function assignRefusal(plan: Plan, shift: Shift, personId: string): string | null {
  const person = plan.people.find((one) => one.id === personId);
  if (person == null) return null;
  if (person.job != null && person.job !== shift.job)
    return JW.worksAs(person.name, jobName(plan, person.job));
  const other = shiftsOf(plan, personId).find((one) => one.id !== shift.id && overlaps(one, shift));

  return other == null
    ? null
    : JW.overlap(person.name, jobName(plan, other.job), rangeOf(plan, other.start, other.end));
}

export function assign(plan: Plan, shiftId: string, personId: string): Plan {
  const shift = plan.shifts.find((one) => one.id === shiftId) as Shift;

  return {
    ...plan,
    shifts: plan.shifts.map((one) =>
      one.id === shiftId ? { ...one, people: [...one.people, personId] } : one,
    ),
    people: plan.people.map((one) =>
      one.id === personId && one.job == null ? { ...one, job: shift.job } : one,
    ),
  };
}

/** The place stays open: the shift keeps its job, times and People needed, and the person keeps their job. */
export function unassign(plan: Plan, shiftId: string, personId: string): Plan {
  return {
    ...plan,
    shifts: plan.shifts.map((one) =>
      one.id === shiftId ? { ...one, people: one.people.filter((id) => id !== personId) } : one,
    ),
  };
}

export type RemoveCase = 'straight' | 'ask' | 'refused';

export function removeCase(plan: Plan, jobId: string): RemoveCase {
  const shifts = plan.shifts.filter((one) => one.job === jobId);
  if (shifts.length === 0) return 'straight';

  return shifts.some((one) => one.people.length > 0) ? 'refused' : 'ask';
}

export function peopleOnJob(plan: Plan, jobId: string): number {
  return new Set(plan.shifts.filter((one) => one.job === jobId).flatMap((one) => one.people)).size;
}

/** Its shifts go with it, and anyone on the roster who held it is left with no job. */
export function removeJob(plan: Plan, jobId: string): Plan {
  return {
    event: plan.event,
    jobs: plan.jobs.filter((one) => one.id !== jobId),
    shifts: plan.shifts.filter((one) => one.job !== jobId),
    people: plan.people.map((one) => (one.job === jobId ? { ...one, job: null } : one)),
  };
}

const JOBS: readonly Job[] = [
  { id: 'lead', name: 'Floor lead', level: 'run' },
  { id: 'waiter', name: 'Waiter', level: 'floor' },
  { id: 'runner', name: 'Runner', level: 'floor' },
  { id: 'cook', name: 'Cook', level: 'pass' },
  { id: 'bar', name: 'Bar', level: 'view' },
  { id: 'door', name: 'Door', level: 'checkIn' },
  { id: 'mc', name: 'MC', level: 'view' },
  { id: 'security', name: 'Security', level: 'view' },
];

const SUGGESTED: readonly Job[] = [
  { id: 'lead', name: 'Floor lead', level: 'run' },
  { id: 'waiter', name: 'Waiter', level: 'floor' },
  { id: 'runner', name: 'Runner', level: 'floor' },
  { id: 'bar', name: 'Bar', level: 'view' },
  { id: 'door', name: 'Door', level: 'checkIn' },
  { id: 'kitchen', name: 'Kitchen', level: 'pass' },
  { id: 'security', name: 'Security', level: 'view' },
  { id: 'sound', name: 'Sound', level: 'view' },
  { id: 'mc', name: 'MC', level: 'view' },
];

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const shift = (
  id: string,
  job: string,
  start: number,
  end: number,
  needed: number,
  people: string[],
): Shift => ({ id, job, start, end, needed, people });

export function samplePlan(): Plan {
  return {
    event: { ...EVENT_HOURS },
    jobs: JOBS.map((one) => ({ ...one })),
    shifts: [
      shift('lead', 'lead', h(16), h(25), 1, ['ifeoma']),
      shift('w1', 'waiter', h(17), h(24), 4, ['amina', 'grace', 'kunle']),
      shift('w2', 'waiter', h(19), h(23), 2, ['emeka']),
      shift('run', 'runner', h(17), h(24), 2, ['ronke']),
      shift('cook', 'cook', h(15), h(23), 3, ['bisi', 'tayo', 'ada']),
      shift('bar1', 'bar', h(16), h(25), 1, ['sade']),
      shift('bar2', 'bar', h(21, 15), h(23), 1, []),
      shift('door1', 'door', h(16, 30), h(21), 1, ['tolu']),
      shift('door2', 'door', h(23), h(26), 1, ['tolu']),
      shift('mc', 'mc', h(19), h(20), 1, []),
    ],
    people: rosterSample().map((one) => ({
      id: one.id,
      name: one.name,
      job: JOBS.find((job) => job.name === one.job)?.id ?? null,
    })),
  };
}

const on = (date: number, hours: number, minutes = 0) => (date - 7) * DAY + h(hours, minutes);

export function weddingPlan(): Plan {
  return {
    ...samplePlan(),
    event: { ...WEDDING_HOURS },
    shifts: [
      shift('lead1', 'lead', on(5, 18), on(5, 23), 1, ['ifeoma']),
      shift('lead2', 'lead', on(6, 16), on(7, 1), 1, ['ifeoma']),
      shift('lead3', 'lead', on(7, 10), on(7, 15), 1, ['ifeoma']),
      shift('cook1', 'cook', on(5, 16), on(5, 22), 2, ['bisi', 'tayo']),
      shift('cook2', 'cook', on(6, 14), on(6, 23), 3, ['bisi', 'tayo', 'ada']),
      shift('cook3', 'cook', on(7, 8), on(7, 13), 2, ['ada']),
      shift('w1', 'waiter', on(5, 18), on(5, 23), 2, ['amina', 'grace']),
      shift('w2', 'waiter', on(6, 17), on(7, 0), 4, ['amina', 'grace', 'kunle']),
      shift('w3', 'waiter', on(7, 10), on(7, 15), 2, ['emeka', 'kunle']),
      shift('run', 'runner', on(6, 17), on(7, 0), 2, ['ronke']),
      shift('bar1', 'bar', on(6, 16), on(7, 1), 1, ['sade']),
      shift('bar2', 'bar', on(6, 21, 15), on(6, 23), 1, []),
      shift('door1', 'door', on(5, 17, 30), on(5, 21), 1, ['tolu']),
      shift('door2', 'door', on(6, 16, 30), on(6, 21), 1, ['tolu']),
      shift('door3', 'door', on(6, 23), on(7, 2), 1, ['tolu']),
      shift('mc', 'mc', on(6, 19), on(6, 20), 1, []),
    ],
  };
}

export type JobsPanel =
  | { kind: 'addJob' }
  | { kind: 'editJob'; job: string }
  | { kind: 'removeJob'; job: string }
  | { kind: 'addShift' }
  | { kind: 'editShift'; shift: string }
  | { kind: 'assign'; shift: string }
  | null;

export interface JobsStart {
  name: string;
  note: string;
  plan: Plan;
  view: 'strip' | 'table';
  manage: boolean;
  panel: JobsPanel;
  jobDraft: JobDraft;
  shiftDraft: ShiftDraft;
  pressed: boolean;
  refused: { person: string; words: string } | null;
  overlap: string | null;
  server: number | null;
  meanwhile: { shift: string; person: string } | null;
}

function start(o: Partial<JobsStart> & Pick<JobsStart, 'name' | 'note'>): JobsStart {
  return {
    plan: samplePlan(),
    view: 'strip',
    manage: true,
    panel: null,
    jobDraft: { name: '', level: 'view' },
    shiftDraft: shiftDraftOf(null),
    pressed: false,
    refused: null,
    overlap: null,
    server: null,
    meanwhile: null,
    ...o,
  };
}

const sampled = (id: string) => samplePlan().shifts.find((one) => one.id === id) as Shift;
const shiftTyped = (o: Partial<ShiftDraft>): ShiftDraft => ({ ...shiftDraftOf(null), ...o });

const STATES = {
  populated: () =>
    start({
      name: 'Populated',
      note: 'Coverage above Jobs: a short job, a covered one, Cook’s set-up shift from 15:00, and Floor lead’s full shift.',
    }),
  table: () =>
    start({
      name: 'Coverage as a table',
      note: 'One row per span where the numbers hold steady.',
      view: 'table',
    }),
  newEvent: () =>
    start({
      name: 'A new event, the suggested jobs',
      note: 'No shifts yet: no strip, and each job says No shifts.',
      plan: {
        event: { ...EVENT_HOURS },
        jobs: SUGGESTED.map((one) => ({ ...one })),
        shifts: [],
        people: samplePlan().people.map((one) => ({ ...one, job: null })),
      },
    }),
  readOnly: () =>
    start({
      name: 'Without staff.manage',
      note: 'No Add, Edit, Remove, Assign or unassign.',
      manage: false,
    }),
  addJob: () =>
    start({
      name: 'Add a job',
      note: 'Name and the five access levels, each with its hint.',
      panel: { kind: 'addJob' },
    }),
  addJobBlank: () =>
    start({
      name: 'Add a job, the name left blank',
      note: 'Add pressed with nothing typed.',
      panel: { kind: 'addJob' },
      pressed: true,
    }),
  addJobLong: () =>
    start({
      name: 'Add a job, over 60 characters',
      note: 'Checked before sending.',
      panel: { kind: 'addJob' },
      jobDraft: {
        name: 'Cloakroom and coats, and the umbrellas at the door when it rains',
        level: 'view',
      },
      pressed: true,
    }),
  addJobTaken: () =>
    start({
      name: 'Add a job, a name the event has',
      note: '“wáiter” against Waiter, ignoring case and accents.',
      panel: { kind: 'addJob' },
      jobDraft: { name: 'wáiter', level: 'floor' },
      pressed: true,
    }),
  editJob: () =>
    start({
      name: 'Edit a job, Waiter',
      note: 'Rename and change the access level.',
      panel: { kind: 'editJob', job: 'waiter' },
      jobDraft: { name: 'Waiter', level: 'floor' },
    }),
  removeStraight: () =>
    start({
      name: 'Remove, a job with no shifts',
      note: 'Press Remove on Security: it goes straight away.',
    }),
  removeAsk: () =>
    start({
      name: 'Remove, a job with shifts and nobody on them',
      note: 'MC: asks first.',
      panel: { kind: 'removeJob', job: 'mc' },
    }),
  removeRefused: () =>
    start({
      name: 'Remove, a job with people on its shifts',
      note: 'Waiter: refused, with how many people.',
      panel: { kind: 'removeJob', job: 'waiter' },
    }),
  addShift: () =>
    start({
      name: 'Add a shift',
      note: 'Prefilled with the event’s start date; People needed 1.',
      panel: { kind: 'addShift' },
    }),
  addShiftBlank: () =>
    start({
      name: 'Add a shift, nothing chosen',
      note: 'Add pressed on the empty form.',
      panel: { kind: 'addShift' },
      shiftDraft: shiftTyped({ needed: '' }),
      pressed: true,
    }),
  addShiftBefore: () =>
    start({
      name: 'Add a shift, the end before the start',
      note: 'sc-234’s correction.',
      panel: { kind: 'addShift' },
      shiftDraft: shiftTyped({ job: 'runner', startTime: '19:00', endTime: '17:00', needed: '1' }),
      pressed: true,
    }),
  addShiftLong: () =>
    start({
      name: 'Add a shift, over 24 hours',
      note: 'sc-234’s ceiling.',
      panel: { kind: 'addShift' },
      shiftDraft: shiftTyped({
        job: 'security',
        startTime: '16:00',
        endDate: '2026-11-08',
        endTime: '18:00',
        needed: '2',
      }),
      pressed: true,
    }),
  addShiftMidnight: () =>
    start({
      name: 'Add a shift, across midnight',
      note: 'The Ends line reads Ends on Sunday at 01:00.',
      panel: { kind: 'addShift' },
      shiftDraft: shiftTyped({
        job: 'security',
        startTime: '20:00',
        endDate: '2026-11-08',
        endTime: '01:00',
        needed: '2',
      }),
    }),
  addShiftNeeded: () =>
    start({
      name: 'Add a shift, People needed out of range',
      note: '0 people.',
      panel: { kind: 'addShift' },
      shiftDraft: shiftTyped({
        job: 'security',
        startTime: '20:00',
        endTime: '23:00',
        needed: '0',
      }),
      pressed: true,
    }),
  editTimes: () =>
    start({
      name: 'Edit times, Waiter 17:00 to 00:00',
      note: 'The shift’s people at the top, each with its ×.',
      panel: { kind: 'editShift', shift: 'w1' },
      shiftDraft: shiftDraftOf(sampled('w1')),
    }),
  editTimesOverlap: () =>
    start({
      name: 'Edit times, a new overlap',
      note: 'Door 23:00 moved to 20:00: Tolu Bello is on Door until 21:00. The old times stay.',
      panel: { kind: 'editShift', shift: 'door2' },
      shiftDraft: { ...shiftDraftOf(sampled('door2')), startDate: FIRST_DAY, startTime: '20:00' },
      overlap: JW.overlap('Tolu Bello', 'Door', rangeOf(samplePlan(), h(16, 30), h(21))),
    }),
  editNeedBelow: () =>
    start({
      name: 'Edit times, People needed below the people on it',
      note: '3 people on Waiter 17:00 to 00:00, lowered to 2. Checked before sending.',
      panel: { kind: 'editShift', shift: 'w1' },
      shiftDraft: { ...shiftDraftOf(sampled('w1')), needed: '2' },
      pressed: true,
    }),
  editNeedRace: () =>
    start({
      name: 'Edit times, before a 422',
      note: 'Waiter 19:00 to 23:00 lowered to 1. Press Save changes: Chinedu Eze was assigned meanwhile.',
      panel: { kind: 'editShift', shift: 'w2' },
      shiftDraft: { ...shiftDraftOf(sampled('w2')), needed: '1' },
      meanwhile: { shift: 'w2', person: 'chinedu' },
    }),
  editNeedServer: () =>
    start({
      name: 'Edit times, after a 422',
      note: 'The API’s {n}, and the shift’s people as they now are.',
      panel: { kind: 'editShift', shift: 'w2' },
      plan: assign(samplePlan(), 'w2', 'chinedu'),
      shiftDraft: { ...shiftDraftOf(sampled('w2')), needed: '1' },
      server: 2,
    }),
  assign: () =>
    start({
      name: 'Assign, Bar 21:15 to 23:00',
      note: 'The roster with each person’s other shifts. Pick Chinedu Eze: no job yet, takes Bar.',
      panel: { kind: 'assign', shift: 'bar2' },
    }),
  assignOverlap: () =>
    start({
      name: 'Assign, an overlapping shift',
      note: 'Sade Lawal is on Bar from 16:00 to 01:00.',
      panel: { kind: 'assign', shift: 'bar2' },
      refused: {
        person: 'sade',
        words: JW.overlap('Sade Lawal', 'Bar', rangeOf(samplePlan(), h(16), h(25))),
      },
    }),
  assignOtherJob: () =>
    start({
      name: 'Assign, someone whose job is another one',
      note: 'Tolu Bello works as Door on this event.',
      panel: { kind: 'assign', shift: 'bar2' },
      refused: { person: 'tolu', words: JW.worksAs('Tolu Bello', 'Door') },
    }),
  longEvent: () =>
    start({
      name: 'An event over 24 hours, the wedding Thu 5 Nov to Sat 7 Nov',
      note: 'One strip over the whole span: each midnight reads its day, and every start and end names its day.',
      plan: weddingPlan(),
      shiftDraft: shiftDraftOf(null, '', dateOf(WEDDING_HOURS.start)),
    }),
  longEventTable: () =>
    start({
      name: 'An event over 24 hours, coverage as a table',
      note: 'Each Time names its day; the end’s date only when it falls on another.',
      plan: weddingPlan(),
      view: 'table',
      shiftDraft: shiftDraftOf(null, '', dateOf(WEDDING_HOURS.start)),
    }),
  longEventOverlap: () =>
    start({
      name: 'An event over 24 hours, an overlapping shift',
      note: 'Sade Lawal is on Bar from Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00.',
      plan: weddingPlan(),
      panel: { kind: 'assign', shift: 'bar2' },
      refused: {
        person: 'sade',
        words: JW.overlap('Sade Lawal', 'Bar', rangeOf(weddingPlan(), on(6, 16), on(7, 1))),
      },
      shiftDraft: shiftDraftOf(null, '', dateOf(WEDDING_HOURS.start)),
    }),
} satisfies Record<string, () => JobsStart>;

export type JobsStateName = keyof typeof STATES;

export const JOBS_STATES = Object.keys(STATES) as JobsStateName[];

export function jobsStart(raw: string | null): JobsStart {
  const name: JobsStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as JobsStateName) : 'populated';

  return STATES[name]();
}

export function jobsAt(state?: JobsStateName): string {
  return `/demo/events/${STATIONS_EVENT}/staff/jobs${state == null ? '' : `?state=${state}`}`;
}

function link(state: JobsStateName): DemoLink {
  return { to: jobsAt(state), name: STATES[state]().name };
}

export const JOBS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Coverage, and the jobs with their shifts',
    states: (['populated', 'table', 'newEvent', 'readOnly'] as const).map(link),
  },
  {
    name: 'Adding, editing and removing a job',
    states: (
      [
        'addJob',
        'addJobBlank',
        'addJobLong',
        'addJobTaken',
        'editJob',
        'removeStraight',
        'removeAsk',
        'removeRefused',
      ] as const
    ).map(link),
  },
  {
    name: 'Adding a shift and editing its times',
    states: (
      [
        'addShift',
        'addShiftBlank',
        'addShiftBefore',
        'addShiftLong',
        'addShiftMidnight',
        'addShiftNeeded',
        'editTimes',
        'editTimesOverlap',
        'editNeedBelow',
        'editNeedRace',
        'editNeedServer',
      ] as const
    ).map(link),
  },
  {
    name: 'Assigning, and a full shift',
    states: (['assign', 'assignOverlap', 'assignOtherJob'] as const).map(link),
  },
  {
    name: 'An event over 24 hours',
    states: (['longEvent', 'longEventTable', 'longEventOverlap'] as const).map(link),
  },
];
