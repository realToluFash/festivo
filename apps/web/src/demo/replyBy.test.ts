import { describe, expect, it } from 'vitest';

import {
  REPLY_BY_WORDS as R,
  closingInstant,
  noReplyOf,
  replyByCheck,
  replyByOf,
  repliesOpen,
  rowDay,
  shortDay,
  showsPreview,
} from './replyBy.ts';

const STARTS = '2026-11-05T18:00:00Z';
const NOW = new Date('2026-11-03T09:41:00Z');
const ZONE = 'Europe/London';

describe('the date to reply by (sc-3780)', () => {
  it('holds the wedding’s Wed, Nov 4 and who hasn’t replied, as its card counts; others have none', () => {
    expect(replyByOf('evt-wed-4')).toBe('2026-11-04');
    expect(noReplyOf('evt-wed-4')).toEqual({ guests: 21, companions: 4 });
    expect(replyByOf('evt-draft-4')).toBeNull();
  });

  it('closes at 23:59:59 in the event’s zone, either side of a change of clocks', () => {
    expect(closingInstant('2026-10-24', ZONE)).toBe('2026-10-24T22:59:59Z');
    expect(closingInstant('2026-10-25', ZONE)).toBe('2026-10-25T23:59:59Z');
    expect(closingInstant('2026-03-29', ZONE)).toBe('2026-03-29T22:59:59Z');
    expect(closingInstant('2026-11-04', 'Africa/Lagos')).toBe('2026-11-04T22:59:59Z');
  });

  it('keeps replies open to the last second of the day, and closed from the next', () => {
    expect(repliesOpen(new Date('2026-11-04T23:59:59Z'), '2026-11-04', ZONE)).toBe(true);
    expect(repliesOpen(new Date('2026-11-05T00:00:00Z'), '2026-11-04', ZONE)).toBe(false);
    expect(repliesOpen(new Date('2026-10-25T23:30:00Z'), '2026-10-25', ZONE)).toBe(true);
    expect(repliesOpen(NOW, null, ZONE)).toBe(true);
  });

  it.each([
    ['2026-11-05', '2026-11-04', 'tooLate'],
    ['2026-11-06', '2026-11-04', 'tooLate'],
    ['2026-11-03', '2026-11-04', 'sooner'],
    ['2026-11-02', '2026-11-04', 'now'],
    ['2026-11-02', null, 'now'],
    ['2026-11-04', null, 'save'],
    ['2026-11-04', '2026-11-03', 'save'],
    [null, '2026-11-04', 'save'],
  ] as const)('%s over %s is %s', (next, was, verdict) => {
    expect(replyByCheck({ next, was, startsAt: STARTS, now: NOW, timeZone: ZONE })).toBe(verdict);
  });

  it('shows the guests’ sentence only for a date they can still answer by', () => {
    expect(showsPreview('2026-11-04', 'save')).toBe(true);
    expect(showsPreview('2026-11-03', 'sooner')).toBe(true);
    expect(showsPreview('2026-11-02', 'now')).toBe(false);
    expect(showsPreview('2026-11-05', 'tooLate')).toBe(false);
    expect(showsPreview(null, 'save')).toBe(false);
  });

  it('writes the dates and the words as the boards do', () => {
    expect(rowDay('2026-11-04')).toBe('Wed, Nov 4, 2026');
    expect(shortDay('2026-11-03')).toBe('Tue, Nov 3');
    const who = R.who(noReplyOf('evt-wed-4'));

    expect(R.soonerTitle(shortDay('2026-11-03'), who)).toBe(
      'Close replies sooner, on Tue, Nov 3, for 21 guests and 4 of their companions who haven’t replied?',
    );
    expect(R.nowTitle(who)).toBe(
      'Close replies now for 21 guests and 4 of their companions who haven’t replied?',
    );
    expect(R.who({ guests: 1, companions: 0 })).toBe('1 guest');
    expect(R.who({ guests: 3, companions: 1 })).toBe('3 guests and 1 of their companions');
    expect(R.keep(shortDay('2026-11-04'))).toBe('Keep Wed, Nov 4');
    expect(R.saved(shortDay('2026-11-03'), ZONE)).toBe(
      'Saved. Replies close Tue, Nov 3 at 23:59, Europe/London time.',
    );
    expect(R.hint(ZONE)).toBe(
      'Replies close at the end of this day, 23:59 Europe/London time. Leave it empty and replies stay open until the event starts.',
    );
  });
});
