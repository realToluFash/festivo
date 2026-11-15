import { describe, expect, it } from 'vitest';

import { eventDayOf, eventDaysBetween, wallOfZoned, wallPlusMinutes } from './runOfShow.ts';

describe('which event day a schedule item is on (sc-3893)', () => {
  it('puts a start between midnight and 05:00 on the day before', () => {
    expect(eventDayOf('2026-11-07T00:30')).toBe('2026-11-06');
    expect(eventDayOf('2026-11-07T04:59')).toBe('2026-11-06');
  });

  it('turns over at 05:00', () => {
    expect(eventDayOf('2026-11-07T05:00')).toBe('2026-11-07');
    expect(eventDayOf('2026-11-06T23:59')).toBe('2026-11-06');
  });

  it('reads the wall clock from the zone offset the API writes, even across a change of clocks', () => {
    expect(wallOfZoned('2026-10-25T01:30:00+01:00')).toBe('2026-10-25T01:30');
    expect(wallOfZoned('2026-10-25T01:30:00+00:00')).toBe('2026-10-25T01:30');
  });

  it('moves a wall-clock time past midnight and lists every day between two', () => {
    expect(wallPlusMinutes('2026-11-06T23:30', 45)).toBe('2026-11-07T00:15');
    expect(eventDaysBetween('2026-11-05', '2026-11-07')).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
  });
});
