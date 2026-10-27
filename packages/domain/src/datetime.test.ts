import { describe, expect, it } from 'vitest';

import {
  fallsOnLaterDay,
  formatCountdown,
  formatDay,
  formatEventDate,
  formatEventMoment,
  formatEventRange,
  formatTimeOfDay,
  formatWallClock,
  formatWallDay,
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

describe('whether a moment falls on a later day', () => {
  const evening = new Date(2026, 9, 21, 18, 59);

  it('is not, later the same evening', () => {
    expect(fallsOnLaterDay(new Date(2026, 9, 21, 23, 59), evening)).toBe(false);
  });

  it('is, at the same time tomorrow', () => {
    expect(fallsOnLaterDay(new Date(2026, 9, 22, 18, 59), evening)).toBe(true);
  });

  it('is, a minute past local midnight', () => {
    expect(fallsOnLaterDay(new Date(2026, 9, 22, 0, 1), evening)).toBe(true);
    expect(fallsOnLaterDay(new Date(2026, 9, 22, 0, 0), evening)).toBe(true);
  });

  it('answers no for something that is not a date', () => {
    expect(fallsOnLaterDay('not a date', evening)).toBe(false);
  });
});

describe("an event's start and end", () => {
  const spaced = (text: string) => text.replace(/\s/g, ' ');

  it("is written in the event's zone on the 24-hour clock, whatever the reader's zone", () => {
    expect(
      spaced(
        formatEventRange(
          '2026-11-14T16:00:00+01:00',
          '2026-11-15T02:00:00+01:00',
          'Africa/Lagos',
          'en-GB',
        ),
      ),
    ).toBe('Sat, 14 Nov 2026, 16:00 – Sun, 15 Nov 2026, 02:00');
    expect(
      spaced(
        formatEventRange('2026-11-14T15:00:00Z', '2026-11-15T01:00:00Z', 'Africa/Lagos', 'en'),
      ),
    ).toBe('Sat, Nov 14, 2026, 16:00 – Sun, Nov 15, 2026, 02:00');
  });

  it('writes the date once when both ends fall on the same day', () => {
    const range = spaced(
      formatEventRange(
        '2026-11-14T16:00:00+01:00',
        '2026-11-14T23:00:00+01:00',
        'Africa/Lagos',
        'en',
      ),
    );

    expect(range).toBe('Sat, Nov 14, 2026, 16:00 – 23:00');
  });

  it("follows the reader's language", () => {
    const range = formatEventRange(
      '2026-11-14T16:00:00+01:00',
      '2026-11-15T02:00:00+01:00',
      'Africa/Lagos',
      'fr',
    );

    expect(range).toMatch(/^sam\. 14 nov\. 2026/);
    expect(range).toMatch(/dim\. 15 nov\. 2026, 02:00$/);
  });

  it('is written where Intl has no formatRange, as on Hermes', () => {
    const formatRange = Object.getOwnPropertyDescriptor(
      Intl.DateTimeFormat.prototype,
      'formatRange',
    );
    Reflect.deleteProperty(Intl.DateTimeFormat.prototype, 'formatRange');

    try {
      expect(
        spaced(
          formatEventRange(
            '2026-11-14T16:00:00+01:00',
            '2026-11-14T23:00:00+01:00',
            'Africa/Lagos',
            'en',
          ),
        ),
      ).toBe('Sat, Nov 14, 2026, 16:00 – 23:00');
    } finally {
      if (formatRange != null)
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatRange', formatRange);
    }
  });

  it('takes the date from the zone, not from the instant in UTC', () => {
    expect(formatEventDate('2026-11-14T23:30:00-05:00', 'America/New_York', 'en')).toBe(
      'Sat, Nov 14, 2026',
    );
    expect(formatEventDate('not a date', 'Africa/Lagos', 'en')).toBe('');
  });
});

describe('a wall-clock day and time, as the event page writes them', () => {
  it("writes the page's day without its year", () => {
    expect(formatWallDay('2026-11-14', 'en')).toBe('Sat, Nov 14');
    expect(formatEventDate('2026-11-14T16:00:00+01:00', 'Africa/Lagos', 'en')).toBe(
      'Sat, Nov 14, 2026',
    );
    expect(formatWallDay('2026-11-14', 'fr')).toMatch(/^sam\. 14 nov\.$/);
  });

  it("writes the page's clock, from a time or a date and time", () => {
    expect(formatWallClock('02:30', 'en-US')).toBe('02:30');
    expect(formatWallClock('2027-03-28T03:30', 'en')).toBe('03:30');
  });

  it('writes nothing for a day or a time it cannot read', () => {
    expect(formatWallDay('', 'en')).toBe('');
    expect(formatWallDay('2027-03-', 'en')).toBe('');
    expect(formatWallClock('', 'en')).toBe('');
    expect(formatWallClock('2027-03-28T03:30:00+02:00', 'en')).toBe('');
  });
});

describe('a milestone’s moment, in the event’s zone', () => {
  it('carries its own offset across a change of clocks', () => {
    expect(formatEventMoment('2026-10-24T18:00:00+02:00', 'Europe/Madrid', 'en')).toBe(
      'Sat, Oct 24, 18:00',
    );
    expect(formatEventMoment('2026-10-26T02:00:00+01:00', 'Europe/Madrid', 'en')).toBe(
      'Mon, Oct 26, 02:00',
    );
  });

  it('is written in the reader’s language', () => {
    expect(formatEventMoment('2026-10-24T18:00:00+02:00', 'Europe/Madrid', 'fr')).toMatch(/sam/);
  });
});
