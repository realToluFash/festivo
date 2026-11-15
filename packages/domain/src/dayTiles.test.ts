import { describe, expect, it } from 'vitest';

import { shownDays, wallDayNumber } from './dayTiles.ts';

const first = wallDayNumber('2026-11-14T09:00:00+01:00', 'Europe/Madrid');
const days = (count: number, today = first - 10, on = false) =>
  shownDays({ first, last: first + count - 1, today, on }).map((day) => day - first + 1);

describe('wallDayNumber', () => {
  it('counts days in the event’s own zone', () => {
    expect(wallDayNumber('2026-11-14T23:30:00Z', 'Europe/Madrid')).toBe(first + 1);
    expect(wallDayNumber('2026-11-14T23:30:00Z', 'America/New_York')).toBe(first);
  });
});

describe('shownDays', () => {
  it('keeps every day for up to a week', () => {
    expect(days(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the first and last day of a longer event', () => {
    expect(days(8)).toEqual([1, 8]);
    expect(days(547)).toEqual([1, 547]);
  });

  it('adds today between them only while it is on', () => {
    expect(days(10, first + 4, true)).toEqual([1, 5, 10]);
    expect(days(10, first + 4, false)).toEqual([1, 10]);
  });

  it('keeps a single day between two rather than counting it', () => {
    expect(days(9, first + 2, true)).toEqual([1, 2, 3, 9]);
  });

  it('adds no third tile when today is an end', () => {
    expect(days(8, first + 7, true)).toEqual([1, 8]);
  });
});
