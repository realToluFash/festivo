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
} from './replyBy.ts';

const STARTS = '2026-11-05T18:00:00Z';
const NOW = new Date('2026-11-03T09:41:00Z');
const ZONE = 'Europe/London';

describe('the date to reply by (sc-3780)', () => {
  it('holds the wedding’s Wed, Nov 4 and its 21 guests with no reply; others have none', () => {
    expect(replyByOf('evt-wed-4')).toBe('2026-11-04');
    expect(noReplyOf('evt-wed-4')).toBe(21);
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

  it('writes the dates and the words as the boards do', () => {
    expect(rowDay('2026-11-04')).toBe('Wed, Nov 4, 2026');
    expect(shortDay('2026-11-03')).toBe('Tue, Nov 3');
    expect(R.soonerTitle(shortDay('2026-11-03'), 21)).toBe(
      'Close replies sooner, on Tue, Nov 3, for 21 guests who haven’t replied?',
    );
    expect(R.nowTitle(21)).toBe('Close replies now for 21 guests who haven’t replied?');
    expect(R.keep(shortDay('2026-11-04'))).toBe('Keep Wed, Nov 4');
    expect(R.saved(shortDay('2026-11-03'), ZONE)).toBe(
      'Saved. Replies close Tue, Nov 3 at 23:59, Europe/London time.',
    );
    expect(R.hint(ZONE)).toBe(
      'Replies close at the end of this day, 23:59 Europe/London time. Leave it empty and replies stay open until the event starts.',
    );
  });
});
