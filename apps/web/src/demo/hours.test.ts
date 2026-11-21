import { describe, expect, it } from 'vitest';

import {
  HW,
  clockedWords,
  draftOf,
  hoursStart,
  hoursWords,
  markWords,
  rowsOf,
  summaryOf,
  summaryRest,
  timesProblems,
  workedOf,
} from './hours.ts';

const rowsAt = (state: Parameters<typeof hoursStart>[0]) => {
  const start = hoursStart(state);

  return rowsOf(start.plan, start.clocks);
};
const row = (key: string, state: Parameters<typeof hoursStart>[0] = 'list') => {
  const found = rowsAt(state).find((one) => one.key === key);
  if (found == null) throw new Error(key);

  return found;
};

describe('Hours worked (sc-234)', () => {
  it('counts a missing clock-out to the scheduled end, and says so', () => {
    const lead = row('lead:ifeoma');

    expect(workedOf(lead.shift, lead.times)).toMatchObject({ minutes: 548, assumed: 548 });
    expect(clockedWords(lead)).toBe('In 15:52 · No clock-out');
    expect(markWords(lead)).toBe('Not clocked out · Counted to 01:00, the scheduled end');
  });

  it('counts nothing for a shift with no clock-in', () => {
    const emeka = row('w2:emeka');

    expect(workedOf(emeka.shift, emeka.times).minutes).toBe(0);
    expect(markWords(emeka)).toBe('No attendance recorded · 0 h counted');
  });

  it('sums the event, with what is assumed and what had no attendance', () => {
    const sum = summaryOf(rowsAt('list'));

    expect(HW.of(hoursWords(sum.worked), hoursWords(sum.scheduled))).toBe(
      '81 h 10 min of 81 h 30 min scheduled',
    );
    expect(summaryRest(sum)).toBe(
      'of which 9 h 8 min assumed (not clocked out) · 1 shift with no attendance recorded',
    );
  });

  it('keeps the original beside a correction, with who and when', () => {
    expect(clockedWords(row('lead:ifeoma', 'corrected'))).toBe(
      'Out 01:15 · corrected from no clock-out by Amara Nwosu, Sunday 02:10',
    );
  });

  it('prefills the recorded times, else the scheduled ones', () => {
    expect(draftOf(row('lead:ifeoma'))).toEqual({
      inDate: '2026-11-07',
      inTime: '15:52',
      outDate: '2026-11-08',
      outTime: '01:00',
    });
    expect(draftOf(row('lead:ifeoma'), true).outTime).toBe('');
  });

  it('checks the times as the 16 Oct form does', () => {
    const draft = draftOf(row('lead:ifeoma'));

    expect(timesProblems({ ...draft, inTime: '' }, false)).toEqual({ in: HW.inBlank });
    expect(timesProblems({ ...draft, outTime: '' }, false)).toEqual({ out: HW.outBlank });
    expect(timesProblems({ ...draft, outTime: '' }, true)).toEqual({});
    expect(timesProblems({ ...draft, outDate: draft.inDate, outTime: '01:15' }, false)).toEqual({
      out: HW.order,
    });
    expect(timesProblems({ ...draft, outDate: '2026-11-09' }, false)).toEqual({ out: HW.long });
    expect(timesProblems(draft, false)).toEqual({});
  });
});
