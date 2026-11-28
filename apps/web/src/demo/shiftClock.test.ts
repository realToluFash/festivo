import { describe, expect, it } from 'vitest';

import {
  CLOCK_STATES,
  KW,
  cardOf,
  lineWords,
  outLimit,
  tapped,
  tappedAgain,
  timeWords,
} from './shiftClock.ts';

describe('The clock card in a browser (sc-234)', () => {
  it('gives a time not today its weekday, never the date', () => {
    const off = cardOf('clocked_out');

    expect(
      KW.inOut(timeWords(off.clockIn ?? 0, off.now), timeWords(off.clockOut ?? 0, off.now)),
    ).toBe('Clocked in Saturday 16:58 · Clocked out 01:42');
  });

  it('signs a browser out at 07:00 unless they clock out first', () => {
    const c = cardOf('access_ended_clocked_in');

    expect(KW.browserOut(timeWords(outLimit(c.clockIn ?? 0), c.now))).toBe(
      'Clocking out signs you out of this browser. Otherwise you will be signed out at 07:00.',
    );
  });

  it('keeps the button as the retry when there is no connection', () => {
    const c = tapped({ ...cardOf('ready'), offline: true });

    expect(c.phase).toBe('ready');
    expect(lineWords(c)).toBe(KW.offIn);
  });

  it('changes nothing on a second tap, and says when it was', () => {
    expect(lineWords(tappedAgain(cardOf('clocked_in')))).toBe(
      'You had already clocked in at 16:58. Nothing has changed.',
    );
  });

  it('has a card for every state', () => {
    for (const state of CLOCK_STATES) expect(cardOf(state)).toBeTruthy();
  });
});
