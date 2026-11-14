import { describe, expect, it } from 'vitest';

import { type Typed, newGuestOf } from './guestForm.ts';

const typed: Typed = {
  fullName: '  Adaeze Okafor ',
  email: ' ',
  country: 'NG',
  number: '',
  companions: ['', ' Bo '],
  language: 'fr',
};

describe('a new guest as both clients send them', () => {
  it('sends the Language chosen, and null for Not set', () => {
    expect(newGuestOf(typed, false).language).toBe('fr');
    expect(newGuestOf({ ...typed, language: null }, false).language).toBeNull();
  });

  it('trims what was typed and sends blanks as null', () => {
    expect(newGuestOf(typed, false)).toEqual({
      fullName: 'Adaeze Okafor',
      email: null,
      mobile: null,
      companions: [{ fullName: null }, { fullName: 'Bo' }],
      language: 'fr',
    });
  });

  it('sends the number with its country, and asks past a duplicate only when told to', () => {
    const sent = newGuestOf({ ...typed, number: ' 803 123 4567 ' }, true);

    expect(sent.mobile).toEqual({ countryCode: 'NG', number: '803 123 4567' });
    expect(sent.allowDuplicate).toBe(true);
  });
});
