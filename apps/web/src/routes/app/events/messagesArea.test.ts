import { describe, expect, it } from 'vitest';

import { closedOf, firstRefused, matching, refusalsOf, shortTitle } from './messagesArea.ts';

const all = { kind: 'all' } as const;

describe('refusalsOf', () => {
  it('refuses a blank message, spaces only included', () => {
    expect(refusalsOf(all, '', '  \n ')).toEqual({ message: 'enterMessage' });
  });

  it('holds the limits at 150 and 10,000, the ends trimmed, an emoji counted once', () => {
    expect(refusalsOf(all, ` ${'s'.repeat(150)} `, 'Hi')).toEqual({});
    expect(refusalsOf(all, 's'.repeat(151), 'Hi')).toEqual({ subject: 'subjectTooLong' });
    expect(refusalsOf(all, '👍'.repeat(150), 'Hi')).toEqual({});
    expect(refusalsOf(all, '', 'm'.repeat(10_000))).toEqual({});
    expect(refusalsOf(all, '', 'm'.repeat(10_001))).toEqual({ message: 'messageTooLong' });
  });

  it('refuses every failing field at once, focus going to the first in the form', () => {
    const refusals = refusalsOf({ kind: 'chosen', ids: [] }, 's'.repeat(151), '');

    expect(refusals).toEqual({
      who: 'chooseOne',
      subject: 'subjectTooLong',
      message: 'enterMessage',
    });
    expect(firstRefused(refusals)).toBe('who');
    expect(firstRefused({ message: 'enterMessage', subject: 'subjectTooLong' })).toBe('subject');
  });
});

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

describe('matching', () => {
  const guests = [
    { id: '1', name: 'Émile Okoro', flag: null, email: 'emile@example.test' },
    { id: '2', name: 'Ada Bello', flag: 'no_address' as const },
  ];

  it('matches any part of the name, ignoring case and accents, and the address when shown', () => {
    expect(matching(guests, 'emi').map((guest) => guest.id)).toEqual(['1']);
    expect(matching(guests, 'BELL').map((guest) => guest.id)).toEqual(['2']);
    expect(matching(guests, 'example.test').map((guest) => guest.id)).toEqual(['1']);
    expect(matching(guests, '  ')).toHaveLength(2);
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
