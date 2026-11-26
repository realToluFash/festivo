import { describe, expect, it } from 'vitest';

import type { GuestMessageRow } from '@soirely/api-client';

import { conversationsOf, firstRefused, matching, refusalsOf } from './messagesArea.ts';

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

describe('matching', () => {
  const guests = [
    { id: '1', name: 'Émile Okoro', flag: null, email: 'emile@example.test', language: 'en' },
    { id: '2', name: 'Ada Bello', flag: 'no_address' as const, language: 'fr' },
  ];

  it('matches any part of the name, ignoring case and accents, and the address with guests.manage', () => {
    expect(matching(guests, 'emi', true).map((guest) => guest.id)).toEqual(['1']);
    expect(matching(guests, 'BELL', true).map((guest) => guest.id)).toEqual(['2']);
    expect(matching(guests, 'example.test', true).map((guest) => guest.id)).toEqual(['1']);
    expect(matching(guests, 'example.test', false)).toEqual([]);
    expect(matching(guests, '  ', false)).toHaveLength(2);
  });
});

describe('conversationsOf', () => {
  const row = (id: string, follows: string | null = null) => ({ id, follows }) as GuestMessageRow;

  it('puts each follow-up under its first message, oldest first, the latest conversation first', () => {
    const newestFirst = [row('d', 'a'), row('c'), row('b', 'a'), row('a')];

    expect(
      conversationsOf(newestFirst).map(({ id, messages }) => [id, messages.map((one) => one.id)]),
    ).toEqual([
      ['a', ['a', 'b', 'd']],
      ['c', ['c']],
    ]);
  });
});
