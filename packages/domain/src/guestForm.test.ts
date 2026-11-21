import { describe, expect, it } from 'vitest';

import { type Typed, newGuestOf, placesTo } from './guestForm.ts';

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

describe('Fewer places (sc-3779), with arrived places held (sc-1454)', () => {
  it('takes unnamed places only, from the end, and refuses once every place left is named', () => {
    expect(placesTo(['', 'Hauwa Bello', ''], 1)).toEqual({ kept: [1], added: 0 });
    expect(placesTo(['Marc Laurent'], 0)).toEqual({ refused: 1, arrived: false });
  });

  it('never drops an arrived place, named or not', () => {
    expect(placesTo(['', '', ''], 1, [true, false, false])).toEqual({ kept: [0], added: 0 });
    expect(placesTo(['', '', ''], 2, [false, false, true])).toEqual({ kept: [0, 2], added: 0 });
  });

  it('refuses once every place left is named or arrived, counting each place once', () => {
    expect(placesTo(['', 'Hauwa Bello', ''], 1, [true, false, false])).toEqual({
      refused: 2,
      arrived: true,
    });
    expect(placesTo(['Rui Duarte'], 0, [true])).toEqual({ refused: 1, arrived: true });
  });

  it('adds unnamed places at the end, whoever has arrived', () => {
    expect(placesTo([''], 3, [true])).toEqual({ kept: [0], added: 2 });
  });
});
