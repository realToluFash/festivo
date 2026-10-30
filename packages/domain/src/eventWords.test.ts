import { describe, expect, it } from 'vitest';

import { venueDraftOf } from './events.ts';
import {
  type Translate,
  changedWords,
  endMovedLine,
  eventFormErrors,
  skippedLine,
} from './eventWords.ts';

const DRAFT_TIMES = { name: 'Gala', type: 'gala' as const };

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

describe('endMovedLine', () => {
  const before = {
    ...DRAFT_TIMES,
    startDate: '2027-07-17',
    startTime: '20:00',
    endDate: '2027-07-18',
    endTime: '08:00',
  };

  it('says where the end moved to', () => {
    expect(endMovedLine(before, { ...before, endTime: '09:00' }, 'en-GB', t)).toBe(
      'eventForm.endMoved:{"day":"Sun 18 Jul","time":"09:00"}',
    );
  });

  it('says nothing when the end stayed or is not set', () => {
    expect(endMovedLine(before, before, 'en-GB', t)).toBeNull();
    expect(
      endMovedLine(before, { ...before, endDate: '2027-07-20', endTime: '' }, 'en-GB', t),
    ).toBeNull();
  });
});

describe('changedWords', () => {
  const event = {
    startsAt: '2030-11-14T16:00:00+01:00',
    concludedAt: null,
  };

  it.each([
    ['draft', 'draft', ['eventLive.changedElsewhere', 'eventLive.nowState_draft']],
    ['live', 'live', ['eventLive.changedElsewhere', 'eventLive.nowState_live']],
    ['live', 'happening_now', ['eventLive.changedElsewhere', 'eventLive.nowState_live']],
    ['paused', 'paused', ['eventLive.changedElsewhere', 'eventLive.nowState_paused']],
    ['paused', 'finished', ['eventEnd.alreadyOver', 'eventLive.nowState_finished']],
  ] as const)('words a %s event the server calls %s as before', (status, phase, words) => {
    expect(changedWords({ ...event, status, phase })).toEqual(words);
  });

  it('says a colleague called it off when it ended before it started (sc-17382)', () => {
    expect(
      changedWords({
        ...event,
        status: 'ended',
        phase: 'finished',
        concludedAt: '2030-11-14T15:59:59+01:00',
      }),
    ).toEqual(['eventLive.changedElsewhere', 'eventLive.nowState_calledOff']);
  });

  it('keeps the already over words for an event ended at or after its start', () => {
    for (const concludedAt of ['2030-11-14T16:00:00+01:00', '2030-11-14T20:00:00+01:00'])
      expect(changedWords({ ...event, status: 'ended', phase: 'finished', concludedAt })).toEqual([
        'eventEnd.alreadyOver',
        'eventLive.nowState_finished',
      ]);
  });
});
