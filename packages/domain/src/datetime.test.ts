import { describe, expect, it } from 'vitest';

import { formatDay, formatTimeOfDay, secondsUntil } from './datetime.ts';

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

/**
 * Built from local parts rather than from a UTC string, deliberately: these
 * render in the reader's own zone, which is the point, and a test written
 * against `Z` passes only on a machine set to UTC.
 */
describe('a time of day', () => {
  /** The product is on the 24-hour clock everywhere, by decision. */
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

  /** A limit that expired while the page was open is not negative time. */
  it('never counts backwards', () => {
    const now = new Date('2026-10-15T14:40:00Z');

    expect(secondsUntil('2026-10-15T14:35:00Z', now)).toBe(0);
  });
});
