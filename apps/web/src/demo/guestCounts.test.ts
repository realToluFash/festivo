import { describe, expect, it } from 'vitest';

import { CLOCKS, resetSample, sampleEvents } from './events.ts';
import { GUEST_WORDS, SAMPLE_GUESTS, figureOf, guestCountsOf } from './guestCounts.ts';

describe('the guest counts on Events (sc-23284)', () => {
  it('adds up the live, happening now and paused events', () => {
    resetSample();

    expect(guestCountsOf(sampleEvents(), SAMPLE_GUESTS, CLOCKS.rest)).toEqual({
      invited: 405,
      coming: 257,
      replied: 309,
      notReplied: 96,
    });
  });

  it('drops an event once it is finished', () => {
    resetSample();

    expect(guestCountsOf(sampleEvents(), SAMPLE_GUESTS, CLOCKS.finished).invited).toBe(225);
  });

  it('counts 0 when nobody is invited, never a blank', () => {
    resetSample();

    expect(guestCountsOf(sampleEvents(), {}, CLOCKS.rest)).toEqual({
      invited: 0,
      coming: 0,
      replied: 0,
      notReplied: 0,
    });
    expect(GUEST_WORDS.coming(0)).toBe('0 coming');
    expect(GUEST_WORDS.notReplied(0)).toBe('0 haven’t replied');
    expect(GUEST_WORDS.notReplied(1)).toBe('1 hasn’t replied');
  });

  it('formats the figures for the language, as 1,250 in English', () => {
    expect(figureOf(1250)).toBe('1,250');
    expect(GUEST_WORDS.coming(1250)).toBe('1,250 coming');
    expect(GUEST_WORDS.notReplied(1250)).toBe('1,250 haven’t replied');
  });
});
