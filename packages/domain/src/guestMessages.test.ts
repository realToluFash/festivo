import { describe, expect, it } from 'vitest';

import { closedOf, overLimits, shortTitle } from './guestMessages.ts';

describe('closedOf', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  const event = { concludedAt: null, endsAt: '2026-10-20T22:00:00Z' };

  it('closes a Draft and an event finished more than 30 days ago, never a paused one', () => {
    expect(closedOf({ ...event, phase: 'draft' }, now)).toBe('closedDraft');
    expect(closedOf({ ...event, phase: 'paused' }, now)).toBeNull();
    expect(closedOf({ ...event, phase: 'finished' }, now)).toBe('closedEnded');
    expect(
      closedOf(
        { phase: 'finished', concludedAt: '2026-10-27T12:00:01Z', endsAt: event.endsAt },
        now,
      ),
    ).toBeNull();
  });
});

describe('overLimits', () => {
  it('holds 150 and 10,000 in code points, the ends trimmed, so an emoji is one', () => {
    expect(overLimits(` ${'s'.repeat(150)} `, 'm'.repeat(10_000))).toEqual({});
    expect(overLimits('s'.repeat(151), 'm'.repeat(10_001))).toEqual({
      subject: 'subjectTooLong',
      message: 'messageTooLong',
    });
    expect(overLimits('👍'.repeat(150), 'Hi')).toEqual({});
  });
});

describe('shortTitle', () => {
  it('shortens a first line at a word', () => {
    expect(shortTitle('Dinner starts at seven')).toBe('Dinner starts at seven');
    expect(shortTitle('Parking is behind the hall, by the side gate on Adeola Street')).toBe(
      'Parking is behind the hall, by the side…',
    );
  });
});
