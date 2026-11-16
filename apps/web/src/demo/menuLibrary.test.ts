import { describe, expect, it } from 'vitest';

import {
  LIBRARY_PAGES,
  LW,
  SAMPLE_DISHES,
  allergenName,
  blankForm,
  checkDish,
  containsLine,
  dietClashes,
  dietName,
  duplicateLine,
  duplicateOf,
  firstProblem,
  libraryStart,
  priceExample,
  readPrice,
  savedDish,
  shownDishes,
} from './menuLibrary.ts';

describe('Last price in the language’s own number format', () => {
  it.each([
    ['en', '4,500', 450000],
    ['en', '12.50', 1250],
    ['fr', '4 500', 450000],
    ['fr', '12,50', 1250],
    ['es', '4.500', 450000],
    ['pt', '12,50', 1250],
    ['en', '4500', 450000],
    ['fr', '4500', 450000],
  ] as const)('%s reads “%s”', (lang, typed, minor) => {
    expect(readPrice(typed, lang, 'NGN')).toEqual({ minor });
  });

  it.each([
    ['en', '-5'],
    ['en', '3,500 naira'],
    ['en', '12,50'],
    ['fr', '12.50'],
    ['en', '1,50,000'],
  ] as const)('%s refuses “%s”', (lang, typed) => {
    expect(readPrice(typed, lang, 'NGN')).toEqual({ wrong: 'number' });
  });

  it('refuses more decimals than the currency’s minor unit, never rounding', () => {
    expect(readPrice('3500.50', 'en', 'JPY')).toEqual({ wrong: 'decimals' });
    expect(readPrice('12.505', 'en', 'NGN')).toEqual({ wrong: 'decimals' });
    expect(readPrice('12.505', 'en', 'KWD')).toEqual({ minor: 12505 });
  });

  it('writes the example to the currency and the language', () => {
    expect(priceExample('en', 'NGN')).toBe('12.50');
    expect(priceExample('fr', 'EUR')).toBe('12,50');
    expect(priceExample('en', 'JPY')).toBe('12');
    expect(priceExample('en', 'KWD')).toBe('12.500');
  });
});

describe('the diet clashes, one line per diet', () => {
  it('names the certain rules only', () => {
    expect(dietClashes(['crustaceans'], ['vegetarian', 'halal'])).toEqual([
      { diet: 'vegetarian', line: LW.vegetarianFish },
    ]);
    expect(dietClashes(['milk'], ['vegan']).map((one) => one.line)).toEqual([LW.veganMilk]);
    expect(dietClashes(['fish'], ['vegan']).map((one) => one.line)).toEqual([LW.veganFish]);
    expect(
      dietClashes(['eggs', 'molluscs'], ['vegan', 'vegetarian']).map((one) => one.line),
    ).toEqual([LW.vegetarianFish, LW.veganBoth]);
    expect(dietClashes(['peanuts'], ['vegan'])).toEqual([]);
  });
});

describe('the form’s checks', () => {
  it('refuses a blank form at the name first', () => {
    const errors = checkDish(blankForm('NGN'), 'en', true);

    expect(errors.name).toBe(LW.nameBlank);
    expect(errors.contains).toBe(LW.containsBlank);
    expect(firstProblem(errors)).toBe('lib-name');
  });

  it('asks for a currency before the amount when the organisation has none', () => {
    const errors = checkDish(
      { ...blankForm(''), name: 'Ofada stew', none: true, amount: '4,500' },
      'en',
      true,
    );

    expect(errors.currency).toBe(LW.currencyBlank);
    expect(firstProblem(errors)).toBe('lib-currency');
  });

  it('asks for nothing about a price without budget.read', () => {
    const errors = checkDish(
      { ...blankForm(''), name: 'Ofada stew', none: true, amount: 'lots' },
      'en',
      false,
    );

    expect(firstProblem(errors)).toBeNull();
  });
});

describe('the duplicate question', () => {
  it('uses the stored name, ignoring case and accents', () => {
    const found = duplicateOf('jollof Rice', SAMPLE_DISHES, null);

    expect(found == null ? null : duplicateLine(found)).toBe(LW.duplicate('Jollof rice'));
  });

  it('says where an archived match is', () => {
    const found = duplicateOf('PUFF PUFF', SAMPLE_DISHES, null);

    expect(found == null ? null : duplicateLine(found)).toBe(
      `${LW.duplicate('Puff puff')} ${LW.underArchived}`,
    );
  });

  it('never matches the dish being edited', () => {
    expect(duplicateOf('Jollof rice', SAMPLE_DISHES, 'd-jollof')).toBeNull();
  });
});

describe('the list', () => {
  it('lists A to Z, finds by name only, and combines the diets', () => {
    const active = SAMPLE_DISHES.filter((one) => !one.archived);

    expect(shownDishes(active, '', []).map((one) => one.name)[0]).toBe('Asun');
    expect(shownDishes(active, 'RICE', []).map((one) => one.name)).toEqual([
      'Coconut rice',
      'Jollof rice',
    ]);
    expect(shownDishes(active, 'crayfish', [])).toEqual([]);
    expect(shownDishes(active, '', ['vegan', 'kosher']).map((one) => one.name)).toEqual([
      'Jollof rice',
      'Zobo sorbet',
    ]);
  });

  it('writes Contains as a shape’s words', () => {
    expect(containsLine(['sesame', 'peanuts'], 'en')).toBe('Contains: Peanuts · Sesame');
    expect(containsLine('none', 'en')).toBe(LW.containsNone);
    expect(containsLine(null, 'en')).toBe(LW.notStated);
  });

  it('names allergens and diets in the page’s language', () => {
    expect(containsLine(['sesame', 'peanuts'], 'fr')).toBe('Contains: Arachides · Sésame');
    expect(allergenName('mustard', 'fr')).toBe('Moutarde');
    expect(dietName('vegetarian', 'en')).toBe('Vegetarian');
  });
});

describe('saving', () => {
  const jollof = SAMPLE_DISHES[0];

  it('keeps the last price without budget.read', () => {
    if (jollof == null) throw new Error('no sample');
    const saved = savedDish(
      { ...blankForm('NGN'), name: 'Jollof rice', none: true },
      jollof,
      jollof.id,
      'en',
      false,
    );

    expect(saved.price).toEqual(jollof.price);
  });

  it('clears the price, currency included, when the amount is cleared', () => {
    if (jollof == null) throw new Error('no sample');
    const saved = savedDish(
      { ...blankForm('NGN'), name: 'Jollof rice', none: true, amount: '' },
      jollof,
      jollof.id,
      'en',
      true,
    );

    expect(saved.price).toBeNull();
  });
});

describe('the states', () => {
  it('opens every linked state', () => {
    for (const page of LIBRARY_PAGES)
      for (const link of page.states) {
        const state = new URL(link.to, 'http://demo').searchParams.get('state');
        expect(libraryStart(state).name).not.toBe('');
      }
  });
});
