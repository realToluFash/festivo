import { describe, expect, it } from 'vitest';

import {
  canClockIn,
  canClockOut,
  draftOf,
  hoursWords,
  minutesOf,
  outLimit,
  timeWords,
  timesProblem,
  workedOf,
} from './clock.ts';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const shift = { start: h(17), end: h(25) };

describe('the clock-in window', () => {
  it('opens 60 minutes before the start and closes at the scheduled end', () => {
    expect(canClockIn(shift, h(15, 59))).toBe(false);
    expect(canClockIn(shift, h(16))).toBe(true);
    expect(canClockIn(shift, h(25))).toBe(true);
    expect(canClockIn(shift, h(25, 1))).toBe(false);
  });
});

describe('the clock-out limit', () => {
  it('is 6 hours after the scheduled end on an ordinary shift', () => {
    expect(outLimit(shift, h(16, 58))).toBe(h(31));
    expect(canClockOut(shift, h(16, 58), h(31))).toBe(true);
    expect(canClockOut(shift, h(16, 58), h(31, 1))).toBe(false);
  });

  it('is 24 hours after the clock-in on a long shift', () => {
    const long = { start: h(6), end: h(25) };
    expect(outLimit(long, h(5, 10))).toBe(h(29, 10));
  });

  it('refuses a clock-out without a clock-in', () => {
    expect(canClockOut(shift, null, h(20))).toBe(false);
  });
});

describe('a time on the card', () => {
  it('reads alone today and with its weekday on another day, never the date', () => {
    expect(timeWords(h(16, 58), h(17, 10))).toBe('16:58');
    expect(timeWords(h(16, 58), h(27, 5))).toBe('Saturday 16:58');
    expect(timeWords(h(31), h(27, 5))).toBe('07:00');
    expect(timeWords(h(31), h(23))).toBe('Sunday 07:00');
  });
});

describe('hours worked', () => {
  it('counts a shift across midnight by its real times', () => {
    expect(workedOf(shift, { clockIn: h(16, 58), clockOut: h(25, 42) })).toEqual({
      minutes: h(8, 44),
      assumed: 0,
      mark: null,
    });
  });

  it('counts a late clock-out at its real time', () => {
    expect(workedOf(shift, { clockIn: h(17), clockOut: h(27, 12) }).minutes).toBe(h(10, 12));
  });

  it('counts a missing clock-out to the scheduled end, marked', () => {
    expect(workedOf(shift, { clockIn: h(16, 55), clockOut: null })).toEqual({
      minutes: h(8, 5),
      assumed: h(8, 5),
      mark: 'notOut',
    });
  });

  it('counts a missing clock-in as nothing, marked', () => {
    expect(workedOf(shift, { clockIn: null, clockOut: null })).toEqual({
      minutes: 0,
      assumed: 0,
      mark: 'noAttendance',
    });
  });

  it('words hours and minutes', () => {
    expect(hoursWords(h(8, 44))).toBe('8 h 44 min');
    expect(hoursWords(h(61))).toBe('61 h');
    expect(hoursWords(5)).toBe('5 min');
  });
});

describe('the correction form', () => {
  it('prefills each date and time from the shift, the clock-out on the next day', () => {
    expect(draftOf(shift, { clockIn: h(16, 55), clockOut: null })).toEqual({
      inDate: '2026-10-17',
      inTime: '16:55',
      outDate: '2026-10-18',
      outTime: '01:00',
    });
  });

  it('leaves the clock-out empty while the person is still on', () => {
    expect(draftOf(shift, { clockIn: h(16, 55), clockOut: null }, true).outTime).toBe('');
  });

  it('reads a date and a time as one instant', () => {
    expect(minutesOf('2026-10-18', '01:15')).toBe(h(25, 15));
    expect(minutesOf('2026-10-18', '25:15')).toBeNull();
  });

  const good = { inDate: '2026-10-17', inTime: '16:55', outDate: '2026-10-18', outTime: '01:15' };

  it('passes a clock-out after the clock-in on the next day', () => {
    expect(timesProblem(good, false)).toBeNull();
  });

  it('requires the clock-in', () => {
    expect(timesProblem({ ...good, inTime: '' }, false)).toEqual({
      field: 'in',
      problem: 'inBlank',
    });
  });

  it('lets the clock-out be empty only while still on', () => {
    expect(timesProblem({ ...good, outTime: '' }, true)).toBeNull();
    expect(timesProblem({ ...good, outTime: '' }, false)).toEqual({
      field: 'out',
      problem: 'outBlank',
    });
  });

  it('refuses an end at or before the start, never reading it as the next day', () => {
    expect(timesProblem({ ...good, outDate: '2026-10-17' }, false)).toEqual({
      field: 'out',
      problem: 'order',
    });
    expect(timesProblem({ ...good, outDate: '2026-10-17', outTime: '16:55' }, false)?.problem).toBe(
      'order',
    );
  });

  it('refuses a shift over 24 hours', () => {
    expect(timesProblem({ ...good, outDate: '2026-10-19' }, false)?.problem).toBe('long');
    expect(timesProblem({ ...good, outDate: '2026-10-18', outTime: '16:55' }, false)).toBeNull();
  });
});
