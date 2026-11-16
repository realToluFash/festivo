import { describe, expect, it } from 'vitest';

import {
  type Variant,
  type VariantForm,
  EVENT_CURRENCY,
  ROOM,
  VW,
  addOutcome,
  blankVariant,
  checkVariants,
  copiedVariants,
  firstVariantProblem,
  foldInto,
  foldWords,
  jollofVariants,
  libraryJollof,
  picksOf,
  removeOutcome,
  sameHint,
  sixWays,
  twoWays,
  beefWays,
  childrenFold,
  variantAllergenLine,
  withSavedVariants,
} from './dishVariants.ts';
import { LW } from './menuLibrary.ts';

const dish = (variants: readonly Variant[] = []) => ({
  name: 'Jollof rice',
  contains: ['celery'] as const,
  diets: [],
  variants,
});

const form = (over: Partial<VariantForm>): VariantForm => ({
  ...blankVariant(EVENT_CURRENCY),
  none: true,
  ...over,
});

const event = { where: 'event' as const, lang: 'en' as const, budget: true };

describe('the variant form, checked before it sends (sc-3903)', () => {
  it('asks for a name of at most 60 characters, its own among the dish’s and the blocks above', () => {
    const [blank, long] = checkVariants([form({}), form({ name: 'x'.repeat(61) })], {
      ...event,
      others: [],
    });
    expect(blank?.name).toBe(VW.nameBlank);
    expect(long?.name).toBe(VW.nameLong);

    const twice = checkVariants([form({ name: 'Chicken' }), form({ name: 'chicken' })], {
      ...event,
      others: [],
    });
    expect(twice[0]?.name).toBeNull();
    expect(twice[1]?.name).toBe(VW.nameTwice);

    const taken = checkVariants([form({ name: 'CHICKEN' })], {
      ...event,
      others: jollofVariants(),
    });
    expect(taken[0]?.name).toBe(VW.nameTwice);
  });

  it('keeps a variant for Everyone: both blocks Children only refuses each For', () => {
    const forms = [
      form({ name: 'Small', for: 'children' }),
      form({ name: 'Plain', for: 'children' }),
    ];
    const errors = checkVariants(forms, { ...event, others: [] });
    expect(errors.map((one) => one.for)).toEqual([VW.needsEveryone, VW.needsEveryone]);
    expect(firstVariantProblem(errors, forms)).toBe('vb0-for-children');

    const fixed = checkVariants([forms[0] as VariantForm, form({ name: 'Plain' })], {
      ...event,
      others: [],
    });
    expect(fixed.map((one) => one.for)).toEqual([null, null]);
  });

  it('refuses the last Everyone variant changed to Children only, and not another', () => {
    const others = jollofVariants().filter((one) => one.id !== 'v-chicken');
    const [last] = checkVariants([form({ name: 'Chicken', for: 'children' })], {
      ...event,
      others,
    });
    expect(last?.for).toBe(VW.needsEveryone);

    const [added] = checkVariants([form({ name: 'Tiny', for: 'children' })], {
      ...event,
      others: jollofVariants(),
    });
    expect(added?.for).toBeNull();
  });

  it('refuses Contains unanswered, the diet clashes and a money field that is not a number', () => {
    const [one] = checkVariants([form({ name: 'Fish', none: false, amount: '15 euros' })], {
      ...event,
      others: [],
    });
    expect(one?.contains).toBe(LW.containsBlank);
    expect(one?.amount).toBe(VW.costWrong('12.50'));

    const [clash] = checkVariants(
      [form({ name: 'Fish', none: false, allergens: ['fish'], diets: ['vegetarian'] })],
      { ...event, others: [] },
    );
    expect(clash?.clashes.map((c) => c.line)).toEqual([LW.vegetarianFish]);

    const [library] = checkVariants([form({ name: 'Fish', amount: '15', currency: 'JPY' })], {
      where: 'library',
      lang: 'en',
      budget: true,
      others: [],
    });
    expect(library?.amount).toBeNull();
    const [kwd] = checkVariants([form({ name: 'Fish', amount: '1.5.0', currency: 'KWD' })], {
      where: 'library',
      lang: 'en',
      budget: true,
      others: [],
    });
    expect(kwd?.amount).toBe(LW.priceWrong('12.500'));
  });

  it('moves focus to the first problem across both blocks, in the order the fields sit', () => {
    const forms = [form({ name: 'Chicken' }), form({ name: '', none: false })];
    const errors = checkVariants(forms, { ...event, others: [] });
    expect(firstVariantProblem(errors, forms)).toBe('vb1-name');
  });
});

describe('saving variants', () => {
  it('turns a dish into one with two variants at once, and says so', () => {
    const saved = withSavedVariants(
      dish(),
      'addFirst',
      null,
      [form({ name: 'Chicken', amount: '14.00' }), form({ name: 'Fish' })],
      event,
    );
    expect(saved.dish.variants.map((one) => one.name)).toEqual(['Chicken', 'Fish']);
    expect(saved.dish.variants[0]?.price).toEqual({ minor: 1400, currency: 'EUR' });
    expect(saved.said).toBe('Jollof rice now comes 2 ways: Chicken and Fish.');
  });

  it('adds the line when an allergen goes on a variant guests have picked', () => {
    const chicken = jollofVariants()[0] as Variant;
    expect(variantAllergenLine('Jollof rice', chicken, ['celery'], ['celery', 'sesame'])).toBe(
      '[4 guests who picked Jollof rice, Chicken, have Sesame recorded, and nobody has told them.]',
    );
    expect(variantAllergenLine('Jollof rice', chicken, ['celery'], ['celery', 'milk'])).toBeNull();
    expect(
      variantAllergenLine('Jollof rice', chicken, ['celery', 'sesame'], ['celery']),
    ).toBeNull();
    expect(variantAllergenLine('Jollof rice', chicken, ['celery'], 'none')).toBeNull();
  });
});

describe('Add variant and Remove…', () => {
  it('refuses the 7th, and a picked dish without variants until sc-3913', () => {
    expect(addOutcome(dish(sixWays()), false)).toBe('limit');
    expect(addOutcome(dish(), true)).toBe('picked');
    expect(addOutcome(dish(jollofVariants()), true)).toBe('open');
    expect(addOutcome(dish(), false)).toBe('open');
  });

  it('asks from three, folds from two, and keeps the last Everyone variant', () => {
    const jollof = dish(jollofVariants());
    const [chicken, kids, plain] = jollofVariants() as [Variant, Variant, Variant];
    expect(removeOutcome(jollof, plain, 'event')).toEqual({ kind: 'ask' });
    expect(removeOutcome(jollof, kids, 'event')).toEqual({ kind: 'refused', lines: ['picked'] });
    expect(removeOutcome(jollof, chicken, 'event')).toEqual({
      kind: 'refused',
      lines: ['picked', 'lastEveryone'],
    });
    expect(removeOutcome(jollof, chicken, 'library')).toEqual({
      kind: 'refused',
      lines: ['lastEveryone'],
    });
    const [full] = childrenFold() as [Variant];
    expect(removeOutcome(dish(childrenFold()), full, 'event')).toEqual({ kind: 'fold' });
  });

  it('folds into the variant that stays, with its money or none', () => {
    const [fish, chicken] = twoWays() as [Variant, Variant];
    const words = foldWords(dish(twoWays()), fish, 'event', true, 'en');
    expect(words.money).toBe('EUR 15.50, from Fish');
    expect(words.children).toBeNull();
    expect(foldInto(dish(twoWays()), fish).dish.contains).toEqual(fish.contains);
    expect(chicken.name).toBe('Chicken');

    const [beef] = beefWays() as [Variant];
    expect(foldWords(dish(beefWays()), beef, 'event', true, 'en').money).toBe(
      VW.foldNoCost('Beef'),
    );
    expect(foldWords(dish(beefWays()), beef, 'library', true, 'en').money).toBe(
      VW.foldNoPrice('Beef'),
    );
    const noBudget = foldWords(dish(twoWays()), fish, 'event', false, 'en');
    expect(noBudget.money).toBeNull();
    expect(noBudget.body).toBe('Jollof rice becomes a single dish with Fish’s allergens, diets:');

    const [, small] = childrenFold() as [Variant, Variant];
    expect(foldWords(dish(childrenFold()), small, 'event', true, 'en').children).toBe(
      VW.foldChildren,
    );
  });
});

describe('a set course and the library copy', () => {
  it('hints Guests pick the way only while two or more variants are for Everyone', () => {
    expect(sameHint([dish(twoWays())])).toBe('Everyone gets Jollof rice. Guests pick the way.');
    expect(sameHint([dish(childrenFold())])).toBeNull();
    expect(sameHint([dish()])).toBeNull();
  });

  it('fills an event Cost from a Last price in the same currency only, converting nothing', () => {
    const same = copiedVariants(libraryJollof('EUR'), 'EUR', 'ev-a');
    expect(same[1]?.price).toEqual({ minor: 600, currency: 'EUR' });
    expect(same[1]?.pricedIn).toBeNull();

    const other = copiedVariants(libraryJollof('GBP'), 'EUR', 'ev-a');
    expect(other[1]?.price).toBeNull();
    expect(other[1]?.pricedIn).toBe('GBP');
    expect(other[2]?.pricedIn).toBeNull();
    expect(other.map((one) => [one.name, one.for])).toEqual([
      ['Chicken', 'everyone'],
      ['Children’s portion', 'children'],
      ['Children’s plain', 'children'],
    ]);
  });

  it('ties each copied variant to its dish copy, so two copies share no id', () => {
    const one = copiedVariants(libraryJollof('EUR'), 'EUR', 'ev-a').map((v) => v.id);
    const two = copiedVariants(libraryJollof('EUR'), 'EUR', 'ev-b').map((v) => v.id);

    expect(one.filter((id) => two.includes(id))).toEqual([]);
  });
});

describe('a variant’s picks', () => {
  it('reads its count and its share of the room, as the board’s dish rows do', () => {
    const [chicken, kids, plain] = jollofVariants() as [Variant, Variant, Variant];

    expect(picksOf(chicken)).toEqual({ count: '31', share: `${Math.round((31 / ROOM) * 100)}%` });
    expect(picksOf(kids).count).toBe('9');
    expect(picksOf(plain)).toEqual({ count: '0', share: '0%' });
  });
});
