import { type OrganisationEvent } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import { closedLine, decideBy, decideRow, repliesOf } from './guestReplyBy.ts';

const t = i18next.getFixedT('en');
const ZONE = 'Europe/London';

function event(fields: Partial<OrganisationEvent>): OrganisationEvent {
  return {
    replyBy: '2026-11-04',
    repliesCloseAt: '2026-11-04T23:59:59+00:00',
    repliesClosedOn: null,
    ...fields,
  } as OrganisationEvent;
}

describe('Guests once there is a Reply by (sc-3780)', () => {
  it('closes by the server’s day, or by the clock past the instant it gave', () => {
    expect(repliesOf(event({}), new Date('2026-11-04T23:59:59Z'))).toEqual({
      replyBy: '2026-11-04',
      closedOn: null,
    });
    expect(repliesOf(event({}), new Date('2026-11-05T00:00:00Z')).closedOn).toBe('2026-11-04');
    expect(
      repliesOf(event({ repliesClosedOn: '2026-11-02' }), new Date('2026-11-02T10:00:00Z'))
        .closedOn,
    ).toBe('2026-11-02');
    expect(
      repliesOf(event({ replyBy: null, repliesCloseAt: null }), new Date('2026-12-31T00:00:00Z')),
    ).toEqual({ replyBy: null, closedOn: null });
  });

  it('asks Not sure yet to decide by the day, and nobody else', () => {
    expect(decideBy(t, { reply: 'maybe' }, '2026-11-04', 'en-US')).toBe('asked to decide by Nov 4');
    expect(decideRow(t, { reply: 'maybe' }, '2026-11-04', 'en-US')).toBe(
      'Not sure yet · asked to decide by Nov 4',
    );
    expect(decideBy(t, { reply: 'coming' }, '2026-11-04', 'en-US')).toBeNull();
    expect(decideRow(t, { reply: 'maybe' }, null, 'en-US')).toBeNull();
  });

  it('tells a host who manages guests how to open a reply again, and a viewer only that it closed', () => {
    const closed = { replyBy: '2026-11-04', closedOn: '2026-11-04' };

    expect(closedLine(t, { repliesReopened: null }, closed, true, ZONE, 'en-US')).toBe(
      'Replies closed on Wed, Nov 4. Record a reply opens again if you let them change their reply.',
    );
    expect(closedLine(t, { repliesReopened: null }, closed, false, ZONE, 'en-US')).toBe(
      'Replies closed on Wed, Nov 4.',
    );
    expect(
      closedLine(
        t,
        { repliesReopened: { by: 'Folake Adeyemi', at: '2026-11-05T10:00:00Z' } },
        closed,
        true,
        ZONE,
        'en-US',
      ),
    ).toBe('Reply reopened by Folake Adeyemi, Nov 5. They can answer until the event starts.');
    expect(
      closedLine(
        t,
        { repliesReopened: null },
        { replyBy: null, closedOn: null },
        true,
        ZONE,
        'en-US',
      ),
    ).toBeNull();
  });
});
