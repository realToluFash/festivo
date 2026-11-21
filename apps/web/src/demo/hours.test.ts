import { describe, expect, it } from 'vitest';

import { clock } from './shifts.ts';
import {
  CORRECTED_AT,
  HW,
  clockedWords,
  corrected,
  draftOf,
  hoursStart,
  hoursWords,
  liveOf,
  markWords,
  outLimit,
  rowsOf,
  stillOnOf,
  summaryOf,
  summaryRest,
  timesProblems,
  trailWords,
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
    const lead = row('lead:ifeoma', 'corrected');

    expect(clockedWords(lead)).toBe('In 15:52 · Out 01:15');
    expect(trailWords(lead)).toEqual([
      'Out 01:15 · corrected from no clock-out by Amara Nwosu, Sunday 02:10',
    ]);
  });

  it('names in the trail only the time that changed, from what was recorded', () => {
    const amina = row('w1:amina');
    const moved = {
      ...amina,
      times: corrected(
        amina.times,
        { ...draftOf(amina), inTime: '16:30' },
        'Amara Nwosu',
        CORRECTED_AT,
      ),
    };

    expect(clockedWords(moved)).toBe('In 16:30 · Out 00:20');
    expect(trailWords(moved)).toEqual([
      'In 16:30 · corrected from 16:55 by Amara Nwosu, Sunday 02:10',
    ]);
  });

  it('names both times when a shift with no attendance gets both', () => {
    const emeka = row('w2:emeka');
    const entered = {
      ...emeka,
      times: corrected(emeka.times, draftOf(emeka), 'Amara Nwosu', CORRECTED_AT),
    };

    expect(clockedWords(entered)).toBe(
      `In ${clock(emeka.shift.start)} · Out ${clock(emeka.shift.end)}`,
    );
    expect(trailWords(entered)).toHaveLength(2);
    expect(trailWords(entered)[0]).toContain('corrected from no clock-in');
    expect(trailWords(entered)[1]).toContain('corrected from no clock-out');
  });

  it('writes no trail when nothing changed', () => {
    const amina = row('w1:amina');

    expect(corrected(amina.times, draftOf(amina), 'Amara Nwosu', CORRECTED_AT)).toBe(amina.times);
  });

  it('leaves the clock-out empty only for somebody still clocked in', () => {
    const rows = rowsAt('list_live');
    const on = rows.find((one) => liveOf(one) === 'in');
    const notYet = rows.find((one) => liveOf(one) === 'notYet');
    if (on == null || notYet == null) throw new Error('sample');

    expect(stillOnOf(on, true)).toBe(true);
    expect(stillOnOf(notYet, true)).toBe(false);
    expect(draftOf(notYet, stillOnOf(notYet, true)).outTime).toBe(clock(notYet.shift.end));
    expect(stillOnOf(on, true, outLimit(on.shift, on.times.clockIn ?? 0) + 1)).toBe(false);
  });

  it('writes a length of time one way', () => {
    expect(hoursWords(42)).toBe('42 min');
    expect(hoursWords(0)).toBe('0 h');
    expect(hoursWords(8 * 60 + 44)).toBe('8 h 44 min');
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
