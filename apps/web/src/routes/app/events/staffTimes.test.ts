import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { rangeWords, staffTimes, wallOf } from './staffTimes.ts';

const t = ((key: string, values: Record<string, string>) =>
  key === 'jobs.range'
    ? `${values.start} to ${values.end}`
    : `${values.day}, ${values.time}`) as unknown as TFunction;

const WEDDING = {
  startsAt: '2026-11-05T18:00:00+01:00',
  endsAt: '2026-11-07T15:00:00+01:00',
  timeZone: 'Africa/Lagos',
};

describe('staff times (sc-3908)', () => {
  it('writes clock times within 24 hours, an end before its start being the next day', () => {
    const times = staffTimes({ ...WEDDING, endsAt: '2026-11-06T02:00:00+01:00' }, [], 'en-GB');

    expect(times.long).toBe(false);
    expect(rangeWords('2026-11-05T16:00:00+01:00', '2026-11-06T01:00:00+01:00', times, t)).toBe(
      '16:00 to 01:00',
    );
  });

  it('names each day past 24 hours, leaving out the end’s date on the start’s', () => {
    const times = staffTimes(WEDDING, [], 'en-GB');

    expect(times.long).toBe(true);
    expect(rangeWords('2026-11-06T16:30:00+01:00', '2026-11-06T21:00:00+01:00', times, t)).toBe(
      'Fri 6 Nov, 16:30 to 21:00',
    );
    expect(rangeWords('2026-11-06T16:00:00+01:00', '2026-11-07T01:00:00+01:00', times, t)).toBe(
      'Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00',
    );
  });

  it('names each day at exactly 24 hours', () => {
    const times = staffTimes(
      {
        startsAt: '2026-11-06T10:00:00+01:00',
        endsAt: '2026-11-07T10:00:00+01:00',
        timeZone: 'Africa/Lagos',
      },
      [],
      'en-GB',
    );

    expect(rangeWords('2026-11-06T10:00:00+01:00', '2026-11-07T10:00:00+01:00', times, t)).toBe(
      'Fri 6 Nov, 10:00 to Sat 7 Nov, 10:00',
    );
  });

  it('names each day at 24 hours on the clock across the spring clock change', () => {
    const times = staffTimes(
      {
        startsAt: '2027-03-27T10:00:00Z',
        endsAt: '2027-03-28T10:30:00+01:00',
        timeZone: 'Europe/London',
      },
      [],
      'en-GB',
    );

    expect(rangeWords('2027-03-27T10:00:00Z', '2027-03-28T10:30:00+01:00', times, t)).toBe(
      'Sat 27 Mar, 10:00 to Sun 28 Mar, 10:30',
    );
  });

  it('reads a moment as the form’s date and time in the event’s zone', () => {
    expect(wallOf('2026-11-06T15:30:00Z', 'Africa/Lagos')).toEqual({
      date: '2026-11-06',
      time: '16:30',
    });
  });
});
