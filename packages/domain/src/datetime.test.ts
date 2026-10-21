import { describe, expect, it } from 'vitest';

import {
  formatCountdown,
  formatDay,
  formatTimeOfDay,
  lockLiftsAt,
  secondsUntil,
} from './datetime.ts';

const MOMENT = '2026-10-15T08:40:00+00:00';

describe('a day, in the reader’s language', () => {
  it('carries the weekday, because a bare date is harder to place', () => {
    expect(formatDay(MOMENT, 'en')).toBe('Thursday, Oct 15');
  });

  it('renders in each language rather than in English four times', () => {
    expect(formatDay(MOMENT, 'es')).toMatch(/jueves/);
    expect(formatDay(MOMENT, 'fr')).toMatch(/jeudi/);
    expect(formatDay(MOMENT, 'pt')).toMatch(/quinta/);
  });

  it('answers with nothing for something that is not a date', () => {
    expect(formatDay('not a date', 'en')).toBe('');
  });
});

describe('a time of day', () => {
  it('is on the 24-hour clock even where the language is not', () => {
    const afternoon = new Date(2026, 9, 15, 14, 35);

    expect(formatTimeOfDay(afternoon, 'en')).toBe('14:35');
    expect(formatTimeOfDay(afternoon, 'en-US')).toBe('14:35');
  });

  it('pads the hour, so a column of times lines up', () => {
    expect(formatTimeOfDay(new Date(2026, 9, 15, 8, 5), 'en')).toBe('08:05');
  });

  it('reads an ISO instant as the reader’s own local time', () => {
    const iso = new Date(2026, 9, 15, 17, 5).toISOString();

    expect(formatTimeOfDay(iso, 'en')).toBe('17:05');
  });
});

describe('how long until a moment', () => {
  it('counts whole seconds forward', () => {
    const now = new Date('2026-10-15T14:20:00Z');

    expect(secondsUntil('2026-10-15T14:35:00Z', now)).toBe(900);
  });

  it('never counts backwards', () => {
    const now = new Date('2026-10-15T14:40:00Z');

    expect(secondsUntil('2026-10-15T14:35:00Z', now)).toBe(0);
  });
});

describe('a countdown', () => {
  it('reads as minutes and seconds, with the seconds padded', () => {
    expect(formatCountdown(42)).toBe('0:42');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(125)).toBe('2:05');
  });

  it('stops at zero rather than going negative', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('rounds a fraction down, so it never shows a second that has passed', () => {
    expect(formatCountdown(41.9)).toBe('0:41');
  });
});

describe('when a lock lifts', () => {
  const now = new Date(2026, 9, 15, 14, 33, 20);

  it('is on the minute after the stated seconds, never before them', () => {
    expect(lockLiftsAt(80, now)).toEqual(new Date(2026, 9, 15, 14, 35, 0));
  });

  it('stays on a minute the seconds already land on', () => {
    expect(lockLiftsAt(40, now)).toEqual(new Date(2026, 9, 15, 14, 34, 0));
  });

  it('answers with nothing for a Retry-After that is missing or nonsense', () => {
    expect(lockLiftsAt(Number.NaN, now)).toBeNull();
    expect(lockLiftsAt(0, now)).toBeNull();
  });
});
