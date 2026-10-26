import { describe, expect, it } from 'vitest';

import { venueDraftOf } from './events.ts';
import { type Translate, eventFormErrors, skippedLine } from './eventWords.ts';

const t: Translate = (key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key}:${JSON.stringify(values)}`;

describe('eventFormErrors', () => {
  it('names each limit in the words for the field it is on', () => {
    const errors = eventFormErrors(
      {
        draft: {
          name: 'Gala',
          type: 'gala',
          startDate: '2026-11-14',
          startTime: '16:00',
          endDate: '2026-11-14',
          endTime: '23:00',
        },
        venue: { ...venueDraftOf(null), name: 'x'.repeat(121) },
        timeZone: 'Africa/Lagos',
        currency: '',
      },
      t,
    );

    expect(errors).toEqual({
      venueName: expect.stringMatching(/^eventForm\.venueNameTooLong:\{"most":\d+\}$/),
      currency: 'orgGeneral.currencyBlank',
    });
  });
});

describe('skippedLine', () => {
  it('says nothing for a time that exists', () => {
    expect(skippedLine('2026-11-14', '16:00', 'Africa/Lagos', 'en-GB', t)).toBeNull();
  });

  it('says what a skipped time is saved as, on the same day', () => {
    expect(skippedLine('2026-03-29', '01:30', 'Europe/London', 'en-GB', t)).toMatch(
      /^eventForm\.clocksSkip:.*"zone":"Europe\/London"/,
    );
  });
});
