import { describe, expect, it } from 'vitest';

import { replyByCheckAt, showsPreview } from './replyBy.ts';

const STARTS = '2026-11-05T18:00:00Z';
const NOW = new Date('2026-11-03T09:41:00Z');
const ZONE = 'Europe/London';

describe('Reply by’s rules (sc-3780)', () => {
  it.each([
    ['2026-11-05', '2026-11-04', 'tooLate'],
    ['2026-11-03', '2026-11-04', 'sooner'],
    ['2026-11-02', null, 'now'],
    ['2026-11-04', null, 'save'],
    [null, '2026-11-04', 'save'],
  ] as const)('%s over %s is %s', (next, was, verdict) => {
    expect(
      replyByCheckAt({ next, was, startsAt: STARTS, now: NOW, timeZone: ZONE, noReply: 25 }),
    ).toBe(verdict);
  });

  it('asks nothing when nobody is left to reply, and still refuses the start day', () => {
    const none = { was: '2026-11-04', startsAt: STARTS, now: NOW, timeZone: ZONE, noReply: 0 };

    expect(replyByCheckAt({ ...none, next: '2026-11-02' })).toBe('save');
    expect(replyByCheckAt({ ...none, next: '2026-11-05' })).toBe('tooLate');
  });

  it('shows the guests’ sentence only for a day they can still answer by', () => {
    expect(showsPreview('2026-11-04', 'save', '2026-11-03')).toBe(true);
    expect(showsPreview('2026-11-02', 'now', '2026-11-03')).toBe(false);
    expect(showsPreview('2026-11-05', 'tooLate', '2026-11-03')).toBe(false);
  });
});
