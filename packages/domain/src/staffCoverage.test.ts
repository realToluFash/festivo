import { describe, expect, it } from 'vitest';

import { type CoverageShift, coverageWindow, jobCoverage, spansADay } from './staffCoverage.ts';

const at = (iso: string) => Date.parse(iso);

const shift = (job: string, from: string, to: string, needed: number, on: number) =>
  ({ job, startsAt: at(from), endsAt: at(to), needed, on }) satisfies CoverageShift;

const clock = (moment: number, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(moment);

describe('coverageWindow', () => {
  it('runs from the earlier start to the later end, on the half hour of the event’s zone', () => {
    const window = coverageWindow(
      { startsAt: at('2026-11-07T16:00:00+01:00'), endsAt: at('2026-11-08T02:00:00+01:00') },
      [shift('cook', '2026-11-07T15:15:00+01:00', '2026-11-07T23:00:00+01:00', 1, 0)],
      'Africa/Lagos',
    );

    expect(clock(window.start, 'Africa/Lagos')).toBe('15:00');
    expect(clock(window.end, 'Africa/Lagos')).toBe('02:00');
    expect(window.steps).toHaveLength(22);
    expect(window.long).toBe(false);
  });

  it('keeps the steps on the zone’s half hour where the offset is not whole hours', () => {
    const window = coverageWindow(
      { startsAt: at('2026-11-07T18:10:00+05:45'), endsAt: at('2026-11-07T20:40:00+05:45') },
      [],
      'Asia/Kathmandu',
    );

    expect(window.steps.map((one) => clock(one, 'Asia/Kathmandu'))).toEqual([
      '18:00',
      '18:30',
      '19:00',
      '19:30',
      '20:00',
      '20:30',
    ]);
  });

  it('counts real time across a change of clocks, an hour short in spring', () => {
    const window = coverageWindow(
      { startsAt: at('2026-03-28T22:00:00Z'), endsAt: at('2026-03-29T03:00:00+01:00') },
      [],
      'Europe/London',
    );

    expect(window.steps.map((one) => clock(one, 'Europe/London'))).toEqual([
      '22:00',
      '22:30',
      '23:00',
      '23:30',
      '00:00',
      '00:30',
      '02:00',
      '02:30',
    ]);
  });

  it('is long past 24 hours', () => {
    const window = coverageWindow(
      { startsAt: at('2026-11-05T18:00:00+01:00'), endsAt: at('2026-11-07T15:00:00+01:00') },
      [shift('cook', '2026-11-05T16:00:00+01:00', '2026-11-05T23:00:00+01:00', 2, 2)],
      'Africa/Lagos',
    );

    expect(window.long).toBe(true);
    expect(window.steps).toHaveLength(94);
  });

  it('is long at exactly 24 hours', () => {
    const window = coverageWindow(
      { startsAt: at('2026-11-06T10:00:00+01:00'), endsAt: at('2026-11-07T10:00:00+01:00') },
      [],
      'Africa/Lagos',
    );

    expect(window.long).toBe(true);
  });

  it('is not long at a minute under 24 hours', () => {
    const window = coverageWindow(
      { startsAt: at('2026-11-06T10:00:00+01:00'), endsAt: at('2026-11-07T09:59:00+01:00') },
      [],
      'Africa/Lagos',
    );

    expect(window.long).toBe(false);
  });
});

describe('spansADay', () => {
  it('counts the clock, not the hours, across the spring clock change', () => {
    expect(
      spansADay(at('2027-03-27T10:00:00+00:00'), at('2027-03-28T10:30:00+01:00'), 'Europe/London'),
    ).toBe(true);
  });

  it('counts the clock, not the hours, across the autumn clock change', () => {
    expect(
      spansADay(at('2027-10-30T10:00:00+01:00'), at('2027-10-31T09:30:00+00:00'), 'Europe/London'),
    ).toBe(false);
  });
});

describe('jobCoverage', () => {
  const zone = 'Africa/Lagos';

  it('covers a shift across midnight, and leaves out jobs without shifts', () => {
    const shifts = [shift('bar', '2026-11-07T22:00:00+01:00', '2026-11-08T01:00:00+01:00', 2, 1)];
    const window = coverageWindow(
      { startsAt: at('2026-11-07T22:00:00+01:00'), endsAt: at('2026-11-08T01:00:00+01:00') },
      shifts,
      zone,
    );
    const [bar, ...rest] = jobCoverage(['bar', 'door'], shifts, window);

    expect(rest).toEqual([]);
    expect(bar?.cells).toEqual(Array.from({ length: 6 }, () => ({ on: 1, needed: 2 })));
    expect(bar?.gaps).toEqual([
      { start: at('2026-11-07T22:00:00+01:00'), end: at('2026-11-08T01:00:00+01:00'), short: 1 },
    ]);
  });

  it('marks a step by its shortest moment, so a quarter-hour gap still shows', () => {
    const shifts = [
      shift('bar', '2026-11-07T20:00:00+01:00', '2026-11-07T21:15:00+01:00', 1, 1),
      shift('bar', '2026-11-07T21:15:00+01:00', '2026-11-07T23:00:00+01:00', 1, 0),
    ];
    const window = coverageWindow(
      { startsAt: at('2026-11-07T20:00:00+01:00'), endsAt: at('2026-11-07T23:00:00+01:00') },
      shifts,
      zone,
    );
    const [bar] = jobCoverage(['bar'], shifts, window);

    expect(bar?.cells.slice(0, 3)).toEqual([
      { on: 1, needed: 1 },
      { on: 1, needed: 1 },
      { on: 0, needed: 1 },
    ]);
    expect(bar?.gaps).toEqual([
      { start: at('2026-11-07T21:15:00+01:00'), end: at('2026-11-07T23:00:00+01:00'), short: 1 },
    ]);
  });

  it('splits gaps where the shortfall changes, and leaves a step with no shift empty', () => {
    const shifts = [
      shift('waiter', '2026-11-07T17:00:00+01:00', '2026-11-08T00:00:00+01:00', 4, 3),
      shift('waiter', '2026-11-07T19:00:00+01:00', '2026-11-07T23:00:00+01:00', 2, 1),
    ];
    const window = coverageWindow(
      { startsAt: at('2026-11-07T16:00:00+01:00'), endsAt: at('2026-11-08T02:00:00+01:00') },
      shifts,
      zone,
    );
    const [waiter] = jobCoverage(['waiter'], shifts, window);

    expect(waiter?.cells[0]).toBeNull();
    expect(waiter?.spans.map((one) => [one.on, one.needed])).toEqual([
      [3, 4],
      [4, 6],
      [3, 4],
    ]);
    expect(waiter?.gaps).toEqual([
      { start: at('2026-11-07T17:00:00+01:00'), end: at('2026-11-07T19:00:00+01:00'), short: 1 },
      { start: at('2026-11-07T19:00:00+01:00'), end: at('2026-11-07T23:00:00+01:00'), short: 2 },
      { start: at('2026-11-07T23:00:00+01:00'), end: at('2026-11-08T00:00:00+01:00'), short: 1 },
    ]);
  });

  it('writes a gap in real time across a change of clocks', () => {
    const shifts = [shift('door', '2026-10-25T00:00:00+01:00', '2026-10-25T03:00:00Z', 1, 0)];
    const window = coverageWindow(
      { startsAt: shifts[0]!.startsAt, endsAt: shifts[0]!.endsAt },
      shifts,
      'Europe/London',
    );
    const [door] = jobCoverage(['door'], shifts, window);

    expect(window.steps).toHaveLength(8);
    expect(door?.gaps).toEqual([
      { start: at('2026-10-24T23:00:00Z'), end: at('2026-10-25T03:00:00Z'), short: 1 },
    ]);
  });

  it('reads a covered job with no gaps over an event longer than 24 hours', () => {
    const shifts = [
      shift('cook', '2026-11-05T16:00:00+01:00', '2026-11-05T23:00:00+01:00', 2, 2),
      shift('cook', '2026-11-07T09:00:00+01:00', '2026-11-07T15:00:00+01:00', 1, 1),
    ];
    const window = coverageWindow(
      { startsAt: at('2026-11-05T18:00:00+01:00'), endsAt: at('2026-11-07T15:00:00+01:00') },
      shifts,
      zone,
    );
    const [cook] = jobCoverage(['cook'], shifts, window);

    expect(window.long).toBe(true);
    expect(cook?.gaps).toEqual([]);
    expect(cook?.cells.filter((one) => one != null)).toHaveLength(26);
  });
});
