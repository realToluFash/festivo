import { describe, expect, it } from 'vitest';

import { EARLIER, GUEST_PICKS, sendPicks } from './mealClose.ts';
import { coursesStart, menuCloses } from './menuCourses.ts';
import {
  PCW,
  SAMPLE_PICKS,
  closeOf,
  dayWords,
  headerClose,
  lineClose,
  sentence,
} from './picksClose.ts';

const header = (state: Parameters<typeof coursesStart>[0]) => {
  const first = coursesStart(state);

  return headerClose(menuCloses(first.courses, first.picks), 'en');
};

describe('when picks close (sc-3905)', () => {
  it('falls back from the choose-by date to the reply-by date to the event’s start', () => {
    expect(closeOf('k1', { ...SAMPLE_PICKS, own: { k1: '2026-10-16' } }).source).toBe('own');
    expect(closeOf('k1', SAMPLE_PICKS)).toEqual({
      on: '2026-10-19',
      source: 'replyBy',
      closed: false,
    });
    expect(closeOf('k1', { ...SAMPLE_PICKS, replyBy: null })).toEqual({
      on: '2026-11-14',
      source: 'start',
      closed: false,
    });
  });

  it('closes a date at the end of its day, and the start at its time', () => {
    const atStart = { ...SAMPLE_PICKS, replyBy: null, today: '2026-11-14' };
    expect(closeOf('k1', { ...SAMPLE_PICKS, today: '2026-10-19', now: '23:58' }).closed).toBe(
      false,
    );
    expect(closeOf('k1', { ...SAMPLE_PICKS, today: '2026-10-20', now: '00:00' }).closed).toBe(true);
    expect(closeOf('k1', { ...atStart, now: '10:00' }).closed).toBe(false);
    expect(closeOf('k1', { ...atStart, now: '15:59' }).closed).toBe(false);
    expect(closeOf('k1', { ...atStart, now: '16:00' }).closed).toBe(true);
    expect(closeOf('k1', { ...atStart, today: '2026-11-15', now: '00:00' }).closed).toBe(true);
  });

  it('writes the date as each locale does, with one full stop', () => {
    expect(dayWords('2026-10-19', 'en')).toBe('Monday, Oct 19');
    expect(dayWords('2026-10-19', 'fr')).toBe('lundi 19 oct.');
    expect(sentence('Picks close lundi 19 oct.')).toBe('Picks close lundi 19 oct.');
    expect(PCW.line('Monday, Oct 19')).toBe('Picks close Monday, Oct 19.');
  });

  it('heads the Menu with the earliest close ahead, “from”, or the last close', () => {
    expect(header('picksOneDate')).toBe('picks close Monday, Oct 19');
    expect(header('picksDifferentDates')).toBe('picks close from Friday, Oct 16');
    expect(header('picksOneClosed')).toBe('picks close Saturday, Nov 14');
    expect(header('picksAllClosed')).toBe('picks closed on Monday, Oct 19');
  });

  it('gives the Picks card the header’s close, as a sentence (sc-3909)', () => {
    const line = (state: Parameters<typeof coursesStart>[0]) => {
      const first = coursesStart(state);

      return lineClose(menuCloses(first.courses, first.picks), 'en');
    };
    expect(line('picksOneDate')).toBe('Picks close Monday, Oct 19.');
    expect(line('picksDifferentDates')).toBe('Picks close from Friday, Oct 16.');
    expect(line('picksAllClosed')).toBe('Picks closed on Monday, Oct 19.');
    expect(lineClose([], 'en')).toBeNull();
  });

  it('counts only the courses that ask guests something', () => {
    const first = coursesStart('menu');
    expect(menuCloses(first.courses, first.picks)).toHaveLength(2);
  });

  it('refuses a closed course with a 409 and saves the open one in the same send', () => {
    const changed = { starter: 'pepper', main: 'croaker' };
    const mixed = sendPicks(EARLIER, changed, GUEST_PICKS, '2026-10-17');
    expect(mixed.refused).toEqual(['starter']);
    expect(mixed.saved).toEqual({ ...EARLIER, main: 'croaker' });
    expect(mixed.savedOther).toBe(true);

    const both = sendPicks(EARLIER, changed, GUEST_PICKS, '2026-10-20');
    expect(both.refused).toEqual(['starter', 'main']);
    expect(both.saved).toEqual(EARLIER);
    expect(both.savedOther).toBe(false);
  });
});
