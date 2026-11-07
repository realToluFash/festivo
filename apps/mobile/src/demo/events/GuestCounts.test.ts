import { describe, expect, it } from 'vitest';

import { CLOCKS, EVENTS } from './EventsSample.ts';
import { GUEST_WORDS, SAMPLE_GUESTS, figureOf, guestCountsOf } from './GuestCounts.ts';

describe('the guest counts on Events (sc-23284)', () => {
  it('adds up the live, happening now and paused events, as the web demo does', () => {
    expect(guestCountsOf(EVENTS, SAMPLE_GUESTS, new Date(CLOCKS.reader))).toEqual({
      invited: 405,
      coming: 257,
      replied: 309,
      notReplied: 96,
    });
  });

  it('drops an event once it is finished', () => {
    expect(guestCountsOf(EVENTS, SAMPLE_GUESTS, new Date(CLOCKS.finished)).invited).toBe(225);
  });

  it('counts 0 when nobody is invited, never a blank', () => {
    expect(guestCountsOf(EVENTS, {}, new Date(CLOCKS.reader))).toEqual({
      invited: 0,
      coming: 0,
      replied: 0,
      notReplied: 0,
    });
    expect(GUEST_WORDS.coming(0)).toBe('0 coming');
    expect(GUEST_WORDS.notReplied(1)).toBe('1 hasn’t replied');
  });

  it('formats the figures for the language, as 1,250 in English', () => {
    expect(figureOf(1250, 'en-US')).toBe('1,250');
    expect(GUEST_WORDS.coming(1250, 'en-GB')).toBe('1,250 coming');
    expect(GUEST_WORDS.notReplied(1250)).toBe('1,250 haven’t replied');
  });
});
