import type { HoursRow } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  clockedWords,
  draftOf,
  markWords,
  recordedHints,
  summaryLines,
  timesProblem,
  trailWords,
  typedOf,
  wallOf,
} from './staffHours.ts';

const i18n = createInstance();

beforeAll(() =>
  i18n.init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const L = 'en-GB';

const TOPE: HoursRow = {
  shiftId: 's1',
  staffId: 'tope',
  name: 'Tope Bello',
  job: 'Waiter',
  startsAt: '2026-10-17T17:00:00+01:00',
  endsAt: '2026-10-18T01:00:00+01:00',
  scheduledMinutes: 480,
  clockedInAt: '2026-10-17T16:55:00+01:00',
  clockedOutAt: null,
  recordedInAt: '2026-10-17T16:55:00+01:00',
  recordedOutAt: null,
  workedMinutes: 485,
  assumedMinutes: 485,
  mark: 'not_clocked_out',
  live: 'in',
  opensAt: '2026-10-17T16:00:00+01:00',
  stillOn: false,
  corrections: [],
};

const YUSUF: HoursRow = {
  ...TOPE,
  staffId: 'yusuf',
  name: 'Yusuf Bello',
  clockedInAt: null,
  recordedInAt: null,
  workedMinutes: 0,
  assumedMinutes: 0,
  mark: 'no_attendance',
  live: 'not_yet',
};

describe('Correct times, prefilled', () => {
  it('takes the counted times, else the scheduled ones, across midnight', () => {
    expect(draftOf(TOPE)).toEqual({
      inDate: '2026-10-17',
      inTime: '16:55',
      outDate: '2026-10-18',
      outTime: '01:00',
    });
    expect(draftOf(YUSUF).inTime).toBe('17:00');
  });

  it('leaves the clock-out empty while they are still on', () => {
    expect(draftOf({ ...TOPE, stillOn: true }).outTime).toBe('');
  });

  it('names what was recorded beside each field', () => {
    expect(recordedHints(i18n.t, TOPE, L)).toEqual({
      in: 'Recorded 16:55',
      out: 'Not recorded, counted to 01:00',
    });
    expect(recordedHints(i18n.t, { ...YUSUF, mark: null }, L)).toEqual({
      in: 'Not recorded',
      out: 'Not recorded',
    });
  });
});

describe('the four checks, in order', () => {
  const draft = draftOf(TOPE);

  it('needs the start', () => {
    expect(timesProblem({ ...draft, inTime: '' }, false)).toEqual({
      field: 'in',
      problem: 'inBlank',
    });
  });

  it('needs the end only once they are no longer on', () => {
    expect(timesProblem({ ...draft, outTime: '' }, false)?.problem).toBe('outBlank');
    expect(timesProblem({ ...draft, outTime: '' }, true)).toBeNull();
  });

  it('puts the end after the start', () => {
    expect(
      timesProblem({ ...draft, outDate: draft.inDate, outTime: '01:15' }, false)?.problem,
    ).toBe('order');
  });

  it('keeps a shift to 24 hours', () => {
    expect(
      timesProblem({ ...draft, outDate: '2026-10-19', outTime: '01:15' }, false)?.problem,
    ).toBe('long');
    expect(timesProblem({ ...draft, outDate: '2026-10-18', outTime: '16:55' }, false)).toBeNull();
  });

  it('sends the event’s wall clock, a typed 1:15 as 01:15', () => {
    expect(typedOf({ ...draft, outTime: '1:15' })).toEqual({
      clockedInAt: '2026-10-17T16:55',
      clockedOutAt: '2026-10-18T01:15',
    });
    expect(typedOf({ ...draft, outTime: '' }).clockedOutAt).toBeNull();
    expect(wallOf('2026-02-30', '10:00')).toBeNull();
    expect(wallOf('2026-10-17', '24:00')).toBeNull();
  });
});

describe('a row’s words', () => {
  it('reads the clocked times, during service only what has happened', () => {
    expect(clockedWords(i18n.t, TOPE, false, L)).toBe('In 16:55 · No clock-out');
    expect(clockedWords(i18n.t, TOPE, true, L)).toBe('Clocked in · 16:55');
    expect(clockedWords(i18n.t, YUSUF, false, L)).toBe('No clock-in');
    expect(clockedWords(i18n.t, YUSUF, true, L)).toBe('Not clocked in yet');
  });

  it('marks a missing clock-out and a missing clock-in', () => {
    expect(markWords(i18n.t, TOPE, L)).toBe(
      'Not clocked out · Counted to 01:00, the scheduled end',
    );
    expect(markWords(i18n.t, YUSUF, L)).toBe('No attendance recorded · 0 h counted');
    expect(markWords(i18n.t, { ...TOPE, mark: null }, L)).toBeNull();
  });

  it('keeps a trail line for each corrected time, its time with the weekday', () => {
    const corrected: HoursRow = {
      ...TOPE,
      clockedOutAt: '2026-10-18T01:15:00+01:00',
      mark: null,
      corrections: [
        { field: 'out', was: null, by: 'Amara Nwosu', at: '2026-10-18T02:10:00+01:00' },
      ],
    };

    expect(trailWords(i18n.t, corrected, L)).toEqual([
      'Out 01:15 · corrected from no clock-out by Amara Nwosu, Sunday 02:10',
    ]);
  });

  it('sums the night, with what was assumed and the shifts nobody came to', () => {
    expect(
      summaryLines(i18n.t, {
        workedMinutes: 3100,
        scheduledMinutes: 3300,
        assumedMinutes: 485,
        noAttendance: 1,
        clockedIn: 6,
        total: 7,
      }),
    ).toEqual({
      head: '51 h 40 min of 55 h scheduled',
      rest: 'of which 8 h 5 min assumed (not clocked out) · 1 shift with no attendance recorded',
    });
  });
});
