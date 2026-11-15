import { describe, expect, it } from 'vitest';

import { hourContext, runItemOf, timeSlot } from './runWords.ts';

describe('the article a time takes in a sentence (sc-1404)', () => {
  it('picks the one o’clock form, "a la 1:15", in 24-hour and 12-hour clocks', () => {
    expect(hourContext('1:15')).toEqual({ context: 'hour1' });
    expect(hourContext('01:15')).toEqual({ context: 'hour1' });
    expect(hourContext('1:15 PM')).toEqual({ context: 'hour1' });
  });

  it('keeps the plural form for every other hour, "a las 21:15"', () => {
    expect(hourContext('21:15')).toEqual({});
    expect(hourContext('11:05')).toEqual({});
    expect(hourContext('10:00')).toEqual({});
    expect(hourContext('0:30')).toEqual({});
  });

  it('carries the formatted time beside its context', () => {
    expect(timeSlot('01:15', 'es')).toEqual({ time: '01:15', context: 'hour1' });
    expect(timeSlot('21:15', 'es')).toEqual({ time: '21:15' });
  });
});

describe('an item as the run view reads it (sc-1404)', () => {
  it('reads its planned start as its startsAt, keeping every offset', () => {
    expect(
      runItemOf({
        id: 'a',
        startsAt: '2026-11-15T21:15:00+01:00',
        startedAt: '2026-11-15T21:22:41+01:00',
        endedAt: null,
      }),
    ).toEqual({
      id: 'a',
      startsAt: '2026-11-15T21:15:00+01:00',
      planned: '2026-11-15T21:15:00+01:00',
      startedAt: '2026-11-15T21:22:41+01:00',
      endedAt: null,
    });
  });
});
