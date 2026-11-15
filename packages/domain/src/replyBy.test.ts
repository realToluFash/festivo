import { describe, expect, it } from 'vitest';

import {
  closedOn,
  haventLine,
  replyByAfterStart,
  replyByAsk,
  replyByCheck,
  repliesClosed,
} from './replyBy.ts';

const EVENT = {
  replyBy: '2026-10-25',
  repliesCloseAt: '2026-10-25T23:59:59+00:00',
  repliesClosedOn: null,
};

const t = (key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`;

describe('Reply by closes at 23:59:59 on its day, in the event’s zone (sc-3780)', () => {
  it('stays open to the last second before the instant, and is closed on it, as the server says', () => {
    expect(repliesClosed(EVENT, new Date('2026-10-25T23:59:58Z'))).toBe(false);
    expect(repliesClosed(EVENT, new Date('2026-10-25T23:59:59Z'))).toBe(true);
  });

  it('is closed at once after Close replies now, and names the day of that save', () => {
    const saved = { ...EVENT, replyBy: '2026-11-05', repliesClosedOn: '2026-11-08' };

    expect(repliesClosed(saved, new Date('2026-11-08T10:00:00Z'))).toBe(true);
    expect(closedOn(saved, new Date('2026-11-08T10:00:00Z'))).toBe('2026-11-08');
  });

  it('names the Reply by day when replies closed at its end, and nothing while open or without one', () => {
    expect(closedOn(EVENT, new Date('2026-10-27T10:00:00Z'))).toBe('2026-10-25');
    expect(closedOn(EVENT, new Date('2026-10-20T10:00:00Z'))).toBeNull();
    expect(closedOn({ replyBy: null, repliesCloseAt: null }, new Date())).toBeNull();
  });
});

describe('the Reply by ask', () => {
  it('asks before an earlier day or a past one, never with nobody left to reply', () => {
    expect(replyByAsk('2026-11-04', '2026-11-03', '2026-11-01', 25)).toBe('sooner');
    expect(replyByAsk('2026-11-04', '2026-10-30', '2026-11-01', 25)).toBe('now');
    expect(replyByAsk('2026-11-03', '2026-11-04', '2026-11-01', 25)).toBeNull();
    expect(replyByAsk(null, '2026-11-04', '2026-11-01', 25)).toBeNull();
    expect(replyByAsk('2026-11-04', '2026-10-30', '2026-11-01', 0)).toBeNull();
  });

  it.each([
    ['2026-11-05', '2026-11-04', 'tooLate'],
    ['2026-11-03', '2026-11-04', 'sooner'],
    ['2026-11-02', null, 'now'],
    ['2026-11-04', null, 'save'],
    [null, '2026-11-04', 'save'],
  ] as const)('checks %s over %s as %s', (next, saved, verdict) => {
    expect(
      replyByCheck({ next, saved, startDay: '2026-11-05', today: '2026-11-03', havent: 25 }),
    ).toBe(verdict);
  });

  it('asks nothing when nobody is left to reply, and still refuses the start day', () => {
    const none = { saved: '2026-11-04', startDay: '2026-11-05', today: '2026-11-03', havent: 0 };

    expect(replyByCheck({ ...none, next: '2026-11-02' })).toBe('save');
    expect(replyByCheck({ ...none, next: '2026-11-05' })).toBe('tooLate');
  });

  it('moves Reply by to the day before a start moved onto it, tomorrow or today', () => {
    expect(replyByAfterStart('2026-11-04', '2026-11-02')).toBe('2026-11-01');
    expect(replyByAfterStart('2026-11-04', '2026-11-04')).toBe('2026-11-03');
    expect(replyByAfterStart('2026-11-04', '2026-11-10')).toBeNull();
    expect(replyByAfterStart(null, '2026-11-02')).toBeNull();
  });
});

describe('Guests’ count sentence', () => {
  it('says everyone replied at 0, and brackets the companions only when there are some', () => {
    expect(haventLine(t, { havent: 0, haventGuests: 0, haventCompanions: 0 })).toBe(
      'guestList.everyoneReplied',
    );
    expect(haventLine(t, { havent: 3, haventGuests: 3, haventCompanions: 0 })).toBe(
      'guestList.haventLine {"havent":"guestList.havent {\\"count\\":3}"}',
    );
    expect(haventLine(t, { havent: 25, haventGuests: 21, haventCompanions: 4 })).toContain(
      'guestList.haventWho',
    );
  });
});
