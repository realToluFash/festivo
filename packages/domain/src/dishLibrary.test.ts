import { describe, expect, it } from 'vitest';

import { type Dish } from '@soirely/api-client';
import {
  blankDishForm,
  dietClashes,
  dishDetailsOf,
  dishProblems,
  firstDishProblem,
  priceExample,
  readPrice,
  sameNamedDish,
  shownDishes,
  typedPrice,
} from './dishLibrary.ts';

const dish = (id: string, name: string, more: Partial<Dish> = {}): Dish => ({
  id,
  name,
  description: null,
  allergens: [],
  diets: [],
  usedByEvent: false,
  archivedAt: null,
  ...more,
});

describe('readPrice', () => {
  it.each([
    ['4,500', 'en', 'NGN', '4500.00'],
    ['12.50', 'en', 'GBP', '12.50'],
    ['4 500', 'fr', 'EUR', '4500.00'],
    ['4\u202f500', 'fr', 'EUR', '4500.00'],
    ['12,50', 'fr', 'EUR', '12.50'],
    ['4.500', 'es', 'EUR', '4500.00'],
    ['12,50', 'pt', 'EUR', '12.50'],
    ['4500', 'pt', 'EUR', '4500.00'],
    ['3500', 'en', 'JPY', '3500'],
    ['12.125', 'en', 'KWD', '12.125'],
  ] as const)('takes %s in %s for %s', (typed, language, currency, amount) => {
    expect(readPrice(typed, language, currency)).toBe(amount);
  });

  it.each([
    ['-5', 'en', 'NGN'],
    ['3,500 naira', 'en', 'NGN'],
    ['12,50', 'en', 'GBP'],
    ['45,00', 'en', 'GBP'],
    ['3500.50', 'en', 'JPY'],
    ['12.505', 'en', 'NGN'],
    ['1.2345', 'en', 'KWD'],
  ] as const)('refuses %s in %s for %s', (typed, language, currency) => {
    expect(readPrice(typed, language, currency)).toBeNull();
  });
});

describe('priceExample', () => {
  it.each([
    ['en', 'GBP', '12.50'],
    ['fr', 'EUR', '12,50'],
    ['en', 'JPY', '12'],
    ['en', 'KWD', '12.500'],
  ] as const)('is %s %s as %s', (language, currency, example) => {
    expect(priceExample(language, currency)).toBe(example);
  });

  it('writes a stored price back in the language', () => {
    expect(typedPrice('4500.00', 'fr', 'EUR')).toBe('4 500,00');
    expect(typedPrice('3500', 'en', 'JPY')).toBe('3,500');
  });
});

describe('dietClashes', () => {
  it('gives one line per diet, in the diet list’s order', () => {
    expect(dietClashes(['fish'], ['vegan', 'vegetarian'])).toEqual([
      { diet: 'vegetarian', clash: 'vegetarianSea' },
      { diet: 'vegan', clash: 'veganSea' },
    ]);
    expect(dietClashes(['milk'], ['vegan'])).toEqual([{ diet: 'vegan', clash: 'veganAnimal' }]);
    expect(dietClashes(['eggs', 'molluscs'], ['vegan'])).toEqual([
      { diet: 'vegan', clash: 'veganBoth' },
    ]);
    expect(dietClashes(['milk'], ['vegetarian'])).toEqual([]);
  });
});

describe('dishProblems', () => {
  it('moves focus to the first problem, the picker before the amount', () => {
    const blank = dishProblems(blankDishForm(''), 'en', true);
    expect(firstDishProblem(blank)).toBe('lib-name');

    const noCurrency = dishProblems(
      { ...blankDishForm(''), name: 'Asun', none: true, amount: '4,500' },
      'en',
      true,
    );
    expect(noCurrency.currency).toBe('blank');
    expect(firstDishProblem(noCurrency)).toBe('lib-currency');
  });

  it('asks nothing about a price without budget.read', () => {
    const form = { ...blankDishForm('NGN'), name: 'Asun', none: true, amount: 'lots' };
    expect(firstDishProblem(dishProblems(form, 'en', false))).toBeNull();
    expect(dishDetailsOf(form, 'en', false, false)).not.toHaveProperty('lastPrice');
  });

  it('clears the last price with the amount', () => {
    const form = { ...blankDishForm('NGN'), name: 'Asun', none: true };
    expect(dishDetailsOf(form, 'en', true, false).lastPrice).toBeNull();
  });
});

describe('the library list', () => {
  const dishes = [
    dish('b', 'Puff puff', { archivedAt: '2026-11-01T00:00:00Z' }),
    dish('a', 'Jollof rice', { diets: ['vegan'] }),
    dish('c', 'Égusi soup'),
  ];

  it('sorts A to Z and finds names ignoring case and accents', () => {
    expect(shownDishes(dishes, '', [], 'en').map((one) => one.name)).toEqual([
      'Égusi soup',
      'Jollof rice',
      'Puff puff',
    ]);
    expect(shownDishes(dishes, 'EGU', [], 'en').map((one) => one.id)).toEqual(['c']);
    expect(shownDishes(dishes, '', ['vegan'], 'en').map((one) => one.id)).toEqual(['a']);
  });

  it('names the stored dish a name lands on, saying when only an archived one does', () => {
    expect(sameNamedDish('jollof Rice', dishes, null)).toEqual({
      dish: dishes[1],
      archivedOnly: false,
    });
    expect(sameNamedDish('PUFF PUFF', dishes, null)).toEqual({
      dish: dishes[0],
      archivedOnly: true,
    });
    expect(sameNamedDish('Jollof rice', dishes, 'a')).toBeNull();
  });
});
