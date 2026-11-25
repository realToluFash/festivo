import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { type CodeClock, endsWords, eventEndWords } from './doorCodes.ts';
import { clockWords, dayWords } from './staffTimes.ts';

const reordering = ((key: string, values: Record<string, string> = {}) =>
  key === 'doorCodes.dayTime'
    ? `${values.time} · ${values.day}`
    : `${key}(${values.at ?? ''})`) as unknown as TFunction;

const clock: CodeClock = {
  endsAt: '2026-12-05T23:00:00Z',
  timeZone: 'Europe/Paris',
  locale: 'fr',
  now: new Date('2026-12-01T10:00:00Z'),
};
const times = { long: false, timeZone: clock.timeZone, locale: clock.locale };
const eventEnd = Date.parse(clock.endsAt);
const reordered = `${clockWords(eventEnd, times)} · ${dayWords(eventEnd, times)}`;

describe('door code end words', () => {
  it("puts the event's end in the order the locale's dayTime gives", () => {
    expect(eventEndWords(clock, reordering)).toBe(reordered);
  });

  it('carries that order into the line for a code that ends with the event', () => {
    expect(endsWords({ kind: 'event' }, clock, reordering)).toBe(
      `doorCodes.endsEvent(${reordered})`,
    );
  });

  it('puts an earlier end in that order too', () => {
    const line = endsWords(
      { kind: 'earlier', day: '2026-12-05', time: '21:30' },
      clock,
      reordering,
    );
    const at = Date.parse('2026-12-05T20:30:00Z');

    expect(line).toBe(`doorCodes.endsEarlier(${clockWords(at, times)} · ${dayWords(at, times)})`);
  });
});
