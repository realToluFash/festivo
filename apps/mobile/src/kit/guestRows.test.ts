import type { Guest } from '@soirely/api-client';
import { peopleOf } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { companionShown, contactOf, rowWords } from './guestRows.ts';

const t = (key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key}${JSON.stringify(values)}`;

function guest(more: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    fullName: 'Adaeze Okafor',
    email: null,
    mobile: null,
    language: null,
    chosenLanguage: null,
    messageLanguage: null,
    reply: 'noReply',
    repliedAt: null,
    companions: [],
    ...more,
  };
}

describe('the app guest rows', () => {
  it('numbers a blank companion from the second blank one', () => {
    expect(companionShown(t, 'Ada', [null, 'Bo', null], 0)).toBe('guestList.guestOf{"host":"Ada"}');
    expect(companionShown(t, 'Ada', [null, 'Bo', null], 1)).toBe('Bo');
    expect(companionShown(t, 'Ada', [null, 'Bo', null], 2)).toBe(
      'guestList.guestOfNth{"host":"Ada","nth":2}',
    );
  });

  it('shows no contact to a reader the API sent none', () => {
    expect(contactOf(t, guest())).toBeNull();
    expect(contactOf(t, guest({ email: 'ada@example.com' }))).toBe('ada@example.com');
  });

  it('says a guest with no reply and no contact by their reply alone', () => {
    const [person] = peopleOf([guest()]);

    expect(rowWords(t, person!, false, 'Europe/London', 'en-GB')).toEqual({
      name: 'Adaeze Okafor',
      line: 'guestList.reply.noReply',
    });
  });

  it('says a held companion is held, under their host', () => {
    const people = peopleOf([guest({ companions: [{ id: 'c1', fullName: null, state: 'held' }] })]);

    expect(rowWords(t, people[1]!, true, 'Europe/London', 'en-GB')).toEqual({
      name: 'guestList.guestOf{"host":"Adaeze Okafor"}',
      line: 'guestList.heldLine',
    });
  });
});
