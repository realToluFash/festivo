import { describe, expect, it } from 'vitest';

import { SHIFT_CLOCK_BOARDS, STAFF_HOURS_BOARDS } from './boards.ts';
import {
  CLOCK_STATES,
  CW,
  cardOf,
  lineWords,
  limitOf,
  tapped,
  tappedAgain,
} from './shiftClockModel.ts';
import {
  HW,
  clockedWords,
  hoursStart,
  liveWords,
  markWords,
  sampleRows,
  summaryLines,
  summaryOf,
} from './staffHoursModel.ts';

describe('the clock card', () => {
  it('reads each tap line whole, with the weekday when not today', () => {
    expect(lineWords(cardOf('already_in'))).toBe(
      'You had already clocked in at 16:58. Nothing has changed.',
    );
    expect(lineWords(cardOf('already_out'))).toBe(
      'You had already clocked out at 01:42. Nothing has changed.',
    );
    expect(lineWords(cardOf('access_ended_already'))).toBe(
      'You had already clocked out at 03:12. Nothing has changed.',
    );
    expect(lineWords(cardOf('offline'))).toBe(CW.offIn);
    expect(lineWords(cardOf('access_ended_offline'))).toBe(CW.offOut);
  });

  it('signs a browser out at the limit, 07:00 in the sample', () => {
    expect(CW.browserOut('07:00')).toBe(
      'Clocking out signs you out of this browser. Otherwise you will be signed out at 07:00.',
    );
    expect(limitOf(cardOf('access_ended_clocked_in'))).toBe(31 * 60);
  });

  it('keeps the button as the retry with no connection, and records on the next tap', () => {
    const off = cardOf('offline');
    expect(tapped(off).phase).toBe('ready');
    expect(tapped({ ...off, offline: false }).phase).toBe('on');
  });

  it('shows a second Clock in as clocked in, with the line', () => {
    const again = tappedAgain(cardOf('clocked_in'));
    expect(again.phase).toBe('on');
    expect(again.line).toBe('alreadyIn');
  });

  it('has a demo link for every state', () => {
    for (const state of CLOCK_STATES)
      expect(SHIFT_CLOCK_BOARDS.some((board) => board.href.endsWith(`state=${state}`))).toBe(true);
  });
});

describe('the staff list’s hours', () => {
  it('marks a missing clock-out and a missing clock-in in the AC’s words', () => {
    const rows = sampleRows();
    const words = rows.map(markWords);
    expect(words).toContain('Not clocked out · Counted to 01:00, the scheduled end');
    expect(words).toContain('No attendance recorded · 0 h counted');
  });

  it('sums the rows and says how much is assumed', () => {
    const lines = summaryLines(summaryOf(sampleRows()));
    expect(lines.head).toBe('54 h 55 min of 61 h scheduled');
    expect(lines.rest).toBe(
      'of which 14 h 55 min assumed (not clocked out) · 1 shift with no attendance recorded',
    );
  });

  it('reads a correction with who made it, from what, and when', () => {
    const tope = hoursStart('corrected').rows.find((one) => one.id === 'tope');
    expect(tope == null ? null : clockedWords(tope)).toBe(
      'Out 01:15 · corrected from no clock-out by Amara Nwosu, Sunday 02:10',
    );
    expect(tope == null ? null : markWords(tope)).toBeNull();
  });

  it('shows during service who has clocked in and who has not yet', () => {
    const rows = hoursStart('list_live').rows;
    expect(rows.map(liveWords)).toContain(HW.notYet);
    expect(rows.map(liveWords)).toContain('Clocked in · 16:58');
  });

  it('has no Correct times without staff.manage', () => {
    expect(hoursStart('read_only').manage).toBe(false);
  });

  it('has a demo link for every state', () => {
    expect(STAFF_HOURS_BOARDS).toHaveLength(12);
  });
});
