import { formatWallDay } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { countsOf, repliesClosed, replyByOf, sampleGuests } from './guests.ts';
import {
  REPLY_BY_WORDS as R,
  haventRepliedOf,
  replyByAfterStart,
  replyByCheck,
  rowDay,
  showsPreview,
} from './replyBy.ts';
import { closingInstant, repliesOpen } from './replyClose.ts';

const STARTS = '2026-11-05T18:00:00Z';
const NOW = new Date('2026-11-03T09:41:00Z');
const ZONE = 'Europe/London';

describe('the date to reply by (sc-3780)', () => {
  it('reads the wedding’s Wed, Nov 4 and who hasn’t replied from Guests’ own sample', () => {
    const counts = countsOf(sampleGuests('evt-wed-4'));

    expect(replyByOf('evt-wed-4')).toBe('2026-11-04');
    expect(replyByOf('evt-draft-4')).toBeNull();
    expect(haventRepliedOf('evt-wed-4')).toBe(
      `${counts.haventGuests} guests and ${counts.haventCompanions} of their companions`,
    );
    expect(haventRepliedOf('evt-wed-4')).toBe('21 guests and 4 of their companions');
  });

  it('closes Guests by the same instant (sc-3780, one rule)', () => {
    expect(repliesClosed('evt-wed-4', new Date('2026-11-04T23:59:59Z'))).toBe(false);
    expect(repliesClosed('evt-wed-4', new Date('2026-11-05T00:00:00Z'))).toBe(true);
    expect(repliesClosed('evt-draft-4', new Date('2026-12-31T00:00:00Z'))).toBe(false);
  });

  it.each([
    ['2026-11-04', '2026-11-04T18:00:00Z', '2026-11-03'],
    ['2026-11-04', '2026-11-03T18:00:00Z', '2026-11-02'],
    ['2026-11-04', '2026-11-05T18:00:00Z', null],
    ['2026-11-04', '2026-11-12T18:00:00Z', null],
    [null, '2026-11-04T18:00:00Z', null],
  ] as const)(
    'Reply by %s, a start at %s: Reply by moves to %s (pm, 8 Nov)',
    (was, start, moved) => {
      expect(replyByAfterStart(was, start, ZONE)).toBe(moved);
    },
  );

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
    const who = haventRepliedOf('evt-wed-4');

    expect(R.soonerTitle(formatWallDay('2026-11-03', 'en-US'), who)).toBe(
      'Close replies sooner, on Tue, Nov 3, for 21 guests and 4 of their companions who haven’t replied?',
    );
    expect(R.nowTitle(who)).toBe(
      'Close replies now for 21 guests and 4 of their companions who haven’t replied?',
    );
    expect(R.keep(formatWallDay('2026-11-04', 'en-US'))).toBe('Keep Wed, Nov 4');
    expect(R.startMoves('Wed, Nov 4', 'Tue, Nov 3')).toBe(
      'Replies close on Wed, Nov 4, which isn’t before the new start. Saving moves Reply by to Tue, Nov 3.',
    );
    expect(R.savedMoved('Tue, Nov 3')).toBe('Saved. Replies now close Tue, Nov 3.');
    expect(R.saved(formatWallDay('2026-11-03', 'en-US'), ZONE)).toBe(
      'Saved. Replies close Tue, Nov 3 at 23:59, Europe/London time.',
    );
    expect(R.hint(ZONE)).toBe(
      'Replies close at the end of this day, 23:59 Europe/London time. Leave it empty and replies stay open until the event starts.',
    );
  });
});
