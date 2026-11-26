import type { HoursRow } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import {
  besideWords,
  clockedWords,
  draftOf,
  hoursWords,
  markWords,
  summaryRest,
  timeWords,
  timesProblems,
  trailWords,
  typedOf,
} from './hoursWorked.ts';

const t = i18next.getFixedT('en');
const ON = { timeZone: 'Africa/Lagos', locale: 'en-GB' };

function row(fields: Partial<HoursRow> = {}): HoursRow {
  return {
    shiftId: 'lead',
    staffId: 'ifeoma',
    name: 'Ifeoma Nduka',
    job: 'Floor lead',
    startsAt: '2026-11-28T16:00:00+01:00',
    endsAt: '2026-11-29T01:00:00+01:00',
    scheduledMinutes: 540,
    clockedInAt: '2026-11-28T15:52:00+01:00',
    clockedOutAt: null,
    recordedInAt: '2026-11-28T15:52:00+01:00',
    recordedOutAt: null,
    workedMinutes: 548,
    assumedMinutes: 548,
    mark: 'not_clocked_out',
    live: 'in',
    opensAt: '2026-11-28T15:00:00+01:00',
    stillOn: false,
    corrections: [],
    ...fields,
  };
}

describe('Hours worked (sc-234)', () => {
  it('writes a length of time as the demo does', () => {
    expect([0, 42, 480, 524].map((minutes) => hoursWords(t, minutes))).toEqual([
      '0 h',
      '42 min',
      '8 h',
      '8 h 44 min',
    ]);
  });

  it('says a missing clock-out counts to the scheduled end', () => {
    expect(clockedWords(t, row(), ON)).toBe('In 15:52 · No clock-out');
    expect(markWords(t, row(), ON)).toBe('Not clocked out · Counted to 01:00, the scheduled end');
  });

  it('counts nothing for a shift with no clock-in, and says so', () => {
    const none = row({ clockedInAt: null, recordedInAt: null, mark: 'no_attendance' });

    expect(clockedWords(t, none, ON)).toBe('No clock-in');
    expect(markWords(t, none, ON)).toBe('No attendance recorded · 0 h counted');
    expect(besideWords(t, none, ON)).toEqual({ in: 'Not recorded', out: 'Not recorded' });
  });

  it('keeps the original beside a correction, with who and when', () => {
    const fixed = row({
      clockedOutAt: '2026-11-29T01:15:00+01:00',
      mark: null,
      corrections: [
        { field: 'out', was: null, by: 'Amara Nwosu', at: '2026-11-29T02:10:00+01:00' },
      ],
    });

    expect(clockedWords(t, fixed, ON)).toBe('In 15:52 · Out 01:15');
    expect(trailWords(t, fixed, ON)).toEqual([
      'Out 01:15 · corrected from no clock-out by Amara Nwosu, Sunday 02:10',
    ]);
    expect(besideWords(t, fixed, ON)).toEqual({ in: 'Recorded 15:52', out: 'Not recorded' });
  });

  it('hints what a missing clock-out counts to', () => {
    expect(besideWords(t, row(), ON).out).toBe('Not recorded, counted to 01:00');
    expect(
      besideWords(t, row({ recordedOutAt: '2026-11-29T00:42:00+01:00', mark: null }), ON).out,
    ).toBe('Recorded 00:42');
  });

  it('sums what is assumed and what had no attendance', () => {
    const sum = {
      workedMinutes: 4870,
      scheduledMinutes: 4890,
      assumedMinutes: 548,
      noAttendance: 1,
      clockedIn: 11,
      total: 12,
    };

    expect(summaryRest(t, sum)).toBe(
      'of which 9 h 8 min assumed (not clocked out) · 1 shift with no attendance recorded',
    );
    expect(summaryRest(t, { ...sum, assumedMinutes: 0, noAttendance: 0 })).toBeNull();
  });

  it('fills the panel from the times that count, else the scheduled ones', () => {
    expect(draftOf(row(), ON.timeZone)).toEqual({
      inDate: '2026-11-28',
      inTime: '15:52',
      outDate: '2026-11-29',
      outTime: '01:00',
    });
    expect(draftOf(row({ stillOn: true }), ON.timeZone).outTime).toBe('');
  });

  it('checks the times in order: a clock-in, a clock-out, the order, then 24 hours', () => {
    const draft = draftOf(row(), ON.timeZone);

    expect(timesProblems({ ...draft, inTime: '' }, false)).toEqual({ in: 'inBlank' });
    expect(timesProblems({ ...draft, outTime: '' }, false)).toEqual({ out: 'outBlank' });
    expect(timesProblems({ ...draft, outTime: '' }, true)).toEqual({});
    expect(timesProblems({ ...draft, outDate: draft.inDate, outTime: '01:15' }, false)).toEqual({
      out: 'order',
    });
    expect(timesProblems({ ...draft, outDate: '2026-11-30', outTime: '01:15' }, false)).toEqual({
      out: 'long',
    });
    expect(timesProblems(draft, false)).toEqual({});
  });

  it('sends the typed times on the event’s clock, the clock-out empty while still on', () => {
    const draft = draftOf(row(), ON.timeZone);

    expect(typedOf(draft)).toEqual({
      clockedInAt: '2026-11-28T15:52',
      clockedOutAt: '2026-11-29T01:00',
    });
    expect(typedOf({ ...draft, outTime: '' }).clockedOutAt).toBeNull();
  });

  it('gives a time not today its weekday, never the date', () => {
    const now = Date.parse('2026-11-29T02:05:00+01:00');

    expect(timeWords(t, '2026-11-29T01:42:00+01:00', now, ON)).toBe('01:42');
    expect(timeWords(t, '2026-11-28T16:58:00+01:00', now, ON)).toBe('Saturday 16:58');
  });
});
