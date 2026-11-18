import { describe, expect, it } from 'vitest';

import {
  JW,
  type ShiftDraft,
  assign,
  assignRefusal,
  clock,
  coverageOf,
  jobProblem,
  midnightLine,
  minutesOf,
  newOverlap,
  removeCase,
  removeJob,
  samplePlan,
  shiftDraftOf,
  shiftProblems,
  summaryOf,
  unassign,
  windowOf,
} from './shifts.ts';

const draft = (o: Partial<ShiftDraft>): ShiftDraft => ({
  ...shiftDraftOf(null),
  job: 'bar',
  startTime: '20:00',
  endTime: '23:00',
  ...o,
});
const shiftOf = (id: string) => samplePlan().shifts.find((one) => one.id === id)!;
const rowOf = (job: string) => coverageOf(samplePlan()).find((one) => one.job.id === job)!;

describe('coverage (sc-3908)', () => {
  it('runs from Cook’s set-up shift at 15:00 to the event’s end at 02:00, in 30-minute steps', () => {
    const window = windowOf(samplePlan());
    expect([clock(window.start), clock(window.end)]).toEqual(['15:00', '02:00']);
    expect(rowOf('cook').cells).toHaveLength(22);
  });

  it('writes each gap with its exact span, split where the shortfall changes', () => {
    expect(
      rowOf('waiter').gaps.map((gap) => [gap.short, clock(gap.start), clock(gap.end)]),
    ).toEqual([
      [1, '17:00', '19:00'],
      [2, '19:00', '23:00'],
      [1, '23:00', '00:00'],
    ]);
  });

  it('marks a step at its shortest moment, so a quarter-hour gap is not hidden', () => {
    const bar = rowOf('bar');
    const nine = (21 * 60 - 15 * 60) / 30;
    expect(bar.cells[nine]).toEqual({ on: 1, needed: 2 });
    expect(bar.gaps.map((gap) => [clock(gap.start), clock(gap.end)])).toEqual([['21:15', '23:00']]);
  });

  it('leaves a step with no shift blank, and reads a covered job as Covered', () => {
    const door = rowOf('door');
    expect(door.cells[0]).toBeNull();
    expect(door.gaps).toEqual([]);
  });

  it('leaves out jobs with no shifts and counts short against covered', () => {
    const coverage = coverageOf(samplePlan());
    expect(coverage.some((one) => one.job.id === 'security')).toBe(false);
    expect(summaryOf(coverage)).toBe('4 jobs are short at some point, 3 covered.');
  });

  it('gives the table one row per span where the numbers hold steady', () => {
    expect(rowOf('waiter').spans.map((one) => [clock(one.start), one.on, one.needed])).toEqual([
      ['17:00', 3, 4],
      ['19:00', 4, 6],
      ['23:00', 3, 4],
    ]);
  });
});

describe('a job’s name', () => {
  const plan = samplePlan();

  it('is required, at most 60 characters, and unique ignoring case and accents', () => {
    expect(jobProblem(plan, { name: '  ', level: 'view' }, null)).toBe(JW.nameBlank);
    expect(jobProblem(plan, { name: 'x'.repeat(61), level: 'view' }, null)).toBe(JW.nameLong);
    expect(jobProblem(plan, { name: 'x'.repeat(60), level: 'view' }, null)).toBeNull();
    expect(jobProblem(plan, { name: 'wáiter', level: 'view' }, null)).toBe(
      'This event already has a job called Waiter.',
    );
    expect(jobProblem(plan, { name: 'waiter', level: 'view' }, 'waiter')).toBeNull();
  });
});

describe('a shift’s form', () => {
  it('asks for a job, both times and 1 to 50 people', () => {
    expect(shiftProblems(draft({ job: '', startTime: '', endTime: '', needed: '0' }), 0)).toEqual({
      job: JW.jobBlank,
      start: JW.startBlank,
      end: JW.endBlank,
      needed: JW.neededRange,
    });
    expect(shiftProblems(draft({ needed: '51' }), 0).needed).toBe(JW.neededRange);
    expect(shiftProblems(draft({ needed: '50' }), 0)).toEqual({});
  });

  it('applies sc-234’s two corrections', () => {
    expect(shiftProblems(draft({ endTime: '19:00' }), 0).end).toBe(JW.endBefore);
    expect(shiftProblems(draft({ endDate: '2026-11-08', endTime: '20:01' }), 0).end).toBe(
      JW.tooLong,
    );
    expect(shiftProblems(draft({ endDate: '2026-11-08', endTime: '20:00' }), 0)).toEqual({});
  });

  it('refuses fewer people than are on the shift', () => {
    expect(shiftProblems(draft({ needed: '2' }), 3).needed).toBe(
      '3 people are on this shift. Unassign some first, or keep 3 or more.',
    );
  });

  it('reads a shift across midnight as Ends on Sunday', () => {
    expect(midnightLine(draft({ endDate: '2026-11-08', endTime: '01:00' }))).toBe(
      'Ends on Sunday at 01:00',
    );
    expect(midnightLine(draft({}))).toBeNull();
  });

  it('counts minutes from 00:00 on the first day', () => {
    expect(minutesOf('2026-11-08', '01:00')).toBe(25 * 60);
    expect(minutesOf('2026-11-07', '')).toBeNull();
  });
});

describe('assigning (Decided, 18 Nov 2026: one job a person)', () => {
  const plan = samplePlan();
  const bar2 = shiftOf('bar2');

  it('refuses someone whose job is another one', () => {
    expect(assignRefusal(plan, bar2, 'tolu')).toBe('Tolu Bello works as Door on this event.');
  });

  it('refuses someone on an overlapping shift, naming it', () => {
    expect(assignRefusal(plan, bar2, 'sade')).toBe('Sade Lawal is on Bar from 16:00 to 01:00.');
  });

  it('gives someone with no job yet the shift’s job', () => {
    expect(assignRefusal(plan, bar2, 'chinedu')).toBeNull();
    const after = assign(plan, 'bar2', 'chinedu');
    expect(after.people.find((one) => one.id === 'chinedu')?.job).toBe('bar');
  });

  it('leaves the place open on unassigning, and the person keeps their job', () => {
    const after = unassign(plan, 'w1', 'kunle');
    expect(after.shifts.find((one) => one.id === 'w1')).toMatchObject({
      needed: 4,
      people: ['amina', 'grace'],
    });
    expect(after.people.find((one) => one.id === 'kunle')?.job).toBe('waiter');
  });

  it('refuses new times that would overlap another of the shift’s people’s shifts', () => {
    expect(newOverlap(plan, shiftOf('door2'), 20 * 60, 26 * 60)).toBe(
      'Tolu Bello is on Door from 16:30 to 21:00.',
    );
    expect(newOverlap(plan, shiftOf('door2'), 22 * 60, 26 * 60)).toBeNull();
  });
});

describe('removing a job', () => {
  const plan = samplePlan();

  it('has three cases', () => {
    expect(removeCase(plan, 'security')).toBe('straight');
    expect(removeCase(plan, 'mc')).toBe('ask');
    expect(removeCase(plan, 'waiter')).toBe('refused');
  });

  it('takes its shifts and leaves whoever held it with no job', () => {
    const held = assign(plan, 'mc', 'chinedu');
    const after = removeJob(unassign(held, 'mc', 'chinedu'), 'mc');
    expect(after.shifts.some((one) => one.job === 'mc')).toBe(false);
    expect(after.people.find((one) => one.id === 'chinedu')?.job).toBeNull();
  });
});
