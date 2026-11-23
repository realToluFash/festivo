import type { MealCourse, MealDish } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  against,
  cardParts,
  copyPlates,
  copyable,
  dishRuled,
  markOf,
  nothingSafe,
  partsAllergens,
  keyOf,
  picksOf,
  plateAllergens,
  refusalOf,
  samePlate,
  stepsOf,
} from './meals.ts';

const dish = (over: Partial<MealDish> = {}): MealDish => ({
  id: 'rice',
  name: 'Jollof rice',
  description: null,
  allergens: ['celery'],
  diets: [],
  variants: [],
  choices: [],
  ...over,
});

const course = (dishes: MealDish[], answer: 'choose' | 'same' = 'choose'): MealCourse => ({
  id: 'main',
  name: 'Main',
  answer,
  skippable: false,
  picksClose: { at: '2030-11-10T23:59:00+01:00', source: 'replyBy', closed: false },
  default: null,
  dishes,
});

const WAYS = [
  { id: 'chicken', name: 'Chicken', allergens: ['celery'], diets: [] },
  { id: 'fish', name: 'Fish', allergens: ['fish'], diets: [] },
];

const SIDE = {
  id: 'side',
  question: 'And a side?',
  pick: 1,
  required: true,
  options: [
    { id: 'plantain', name: 'Plantain', allergens: [] },
    { id: 'beans', name: 'Beans', allergens: ['milk'] },
  ],
};

describe('the one allergen rule', () => {
  it('rules out a plate holding the person’s allergens, in Annex II order, and one that states nothing for anyone with one of the 14', () => {
    expect(against(['sesame', 'peanuts'], ['sesame', 'peanuts'])).toEqual({
      kind: 'allergen',
      codes: ['peanuts', 'sesame'],
    });
    expect(against(null, ['milk'])).toEqual({ kind: 'notStated' });
    expect(against(null, [])).toBeNull();
    expect(against(null, ['other'])).toBeNull();
  });

  it('rules a dish out when every way is, or a required choice is left short', () => {
    expect(dishRuled(dish({ variants: WAYS }), ['fish'])).toBeNull();
    expect(dishRuled(dish({ variants: WAYS }), ['fish', 'celery'])).toEqual({
      kind: 'allergen',
      codes: ['fish', 'celery'],
    });
    expect(dishRuled(dish({ allergens: [], choices: [SIDE] }), ['milk'])).toBeNull();
    expect(dishRuled(dish({ allergens: [], choices: [{ ...SIDE, pick: 2 }] }), ['milk'])).toEqual({
      kind: 'allergen',
      codes: ['milk'],
    });
    expect(nothingSafe(course([dish()]), ['celery'])).toBe(true);
  });

  it('marks a pick holding an allergen given since, way and options included', () => {
    const main = course([dish({ allergens: [], variants: WAYS, choices: [SIDE] })]);
    const plate = {
      kind: 'chosen' as const,
      dish: 'rice',
      variant: 'chicken',
      options: { side: ['beans'] },
    };

    expect(markOf(main, plate, ['milk'])).toEqual({ kind: 'allergen', codes: ['milk'] });
    expect(markOf(main, { ...plate, options: { side: ['plantain'] } }, ['milk'])).toBeNull();
    expect(markOf(main, { ...plate, byHost: true }, ['milk'])).toBeNull();
  });
});

describe('the screens a course asks', () => {
  it('asks the dish, then its way when it has two, then each choice', () => {
    const main = course([dish({ variants: WAYS, choices: [SIDE] })]);
    const plate = { kind: 'chosen' as const, dish: 'rice', variant: null, options: {} };

    expect(stepsOf(main, null).map((one) => one.kind)).toEqual(['dish']);
    expect(stepsOf(main, plate).map((one) => one.kind)).toEqual(['dish', 'way', 'choice']);
    expect(stepsOf(course(main.dishes, 'same'), null).map((one) => one.kind)).toEqual([
      'way',
      'choice',
    ]);
  });

  it('refuses Next with nothing, the wrong count, and asks the course on its first screen', () => {
    const step = { kind: 'choice' as const, choice: { ...SIDE, pick: 2 } };
    const plate = { kind: 'chosen' as const, dish: 'rice', variant: null, options: {} };

    expect(refusalOf({ kind: 'dish' }, null, true)).toEqual({ kind: 'course' });
    expect(refusalOf(step, plate, false)).toEqual({ kind: 'one' });
    expect(refusalOf(step, plate, true)).toEqual({ kind: 'course' });
    expect(refusalOf(step, { ...plate, options: { side: ['beans'] } }, false)).toEqual({
      kind: 'count',
      pick: 2,
      had: 1,
    });
    expect(refusalOf({ kind: 'dish' }, { ...plate, kind: 'chefsChoice' }, true)).toBeNull();
  });
});

describe('what Send sends', () => {
  it('sends open answers by person id, a served needs-the-host pick as the pick it is, and nothing for a closed course', () => {
    const open = course([dish()]);
    const shut = {
      ...course([dish()]),
      id: 'starter',
      picksClose: { ...open.picksClose, closed: true },
    };
    const eaters = [{ key: 'me', id: 'g1', name: null, you: true }];
    const plates = {
      'me|main': { kind: 'needsHost' as const, dish: 'rice', variant: null, options: {} },
      'me|starter': { kind: 'chefsChoice' as const, dish: null, variant: null, options: {} },
    };

    expect(picksOf(plates, eaters, [open, shut], () => 'g1')).toEqual([
      { person: 'g1', course: 'main', answer: 'chosen', dish: 'rice', variant: null, options: [] },
    ]);
    expect(samePlate(plates['me|main'], { ...plates['me|main'], kind: 'chosen' })).toBe(true);
  });
});

describe('the dish card once picked', () => {
  const rice = dish({ allergens: [], variants: WAYS, choices: [SIDE] });

  it('lists the way and each picked option with its own allergens, and adds them up', () => {
    const parts = cardParts(rice, {
      kind: 'chosen',
      dish: 'rice',
      variant: 'fish',
      options: { side: ['beans'] },
    });
    expect(parts).toEqual([
      { way: 'Fish', name: 'Jollof rice', allergens: ['fish'] },
      { way: null, name: 'Beans', allergens: ['milk'] },
    ]);
    expect(partsAllergens(parts ?? [])).toEqual(['fish', 'milk']);
  });

  it('shows the dish alone before its way, and nothing for another dish or chef’s choice', () => {
    const plate = { kind: 'chosen', dish: 'rice', variant: null, options: {} } as const;
    expect(cardParts(rice, plate)).toEqual([{ way: null, name: 'Jollof rice', allergens: [] }]);
    expect(cardParts(dish({ id: 'coconut' }), plate)).toBeNull();
    expect(cardParts(rice, { ...plate, kind: 'chefsChoice' })).toBeNull();
  });

  it('draws no card for a picked dish with no ways and no choices', () => {
    const soup = dish({ id: 'soup', allergens: ['celery'], variants: [], choices: [] });
    const plate = { kind: 'chosen', dish: 'soup', variant: null, options: {} } as const;

    expect(cardParts(soup, plate)).toBeNull();
    expect(cardParts({ ...soup, variants: [WAYS[1]!] }, plate)).toBeNull();
  });

  it('adds up a one-way dish with no way stored as its card does', () => {
    const fish = dish({ allergens: null, variants: [WAYS[1]!], choices: [SIDE] });
    const plate = {
      kind: 'chosen',
      dish: 'rice',
      variant: null,
      options: { side: ['beans'] },
    } as const;

    expect(plateAllergens(fish, plate)).toEqual(['fish', 'milk']);
    expect(partsAllergens(cardParts(fish, plate) ?? [])).toEqual(plateAllergens(fish, plate));
  });

  it('reads not stated for a dish of two ways with no way stored, whatever the dish says', () => {
    const plate = { kind: 'needsHost', dish: 'rice', variant: null, options: {} } as const;

    expect(plateAllergens(rice, plate)).toBeNull();
    expect(markOf(course([rice]), plate, ['fish'])).toEqual({ kind: 'notStated' });
  });

  it('keeps the dish’s own allergens on the card while the mark of that plate reads not stated', () => {
    const plate = { kind: 'chosen', dish: 'rice', variant: null, options: {} } as const;

    expect(partsAllergens(cardParts(rice, plate) ?? [])).toEqual([]);
    expect(plateAllergens(rice, plate)).toBeNull();
    expect(markOf(course([rice]), plate, ['fish'])).toEqual({ kind: 'notStated' });
  });

  it('reads not stated when any part never stated its allergens', () => {
    expect(partsAllergens([{ allergens: [] }, { allergens: null }])).toBeNull();
  });
});

describe('Same as an earlier person (sc-17283)', () => {
  const chosen = (dishId: string, variant: string | null = null, options = {}) => ({
    kind: 'chosen' as const,
    dish: dishId,
    variant,
    options,
  });
  const kind = (one: 'chefsChoice' | 'skipped' | 'needsHost') => ({
    kind: one,
    dish: null,
    variant: null,
    options: {},
  });
  const starter = (over: Partial<MealCourse> = {}): MealCourse => ({
    ...course([dish({ id: 'soup', name: 'Pepper soup', allergens: [] })]),
    id: 'starter',
    name: 'Starter',
    skippable: true,
    ...over,
  });
  const main = course([
    dish({ allergens: [], variants: WAYS, choices: [SIDE] }),
    dish({ id: 'yam', name: 'Pounded yam', allergens: null }),
    dish({ id: 'stew', name: 'Stew', allergens: ['milk'] }),
  ]);

  it('copies a pick whose dish, way and every option can be picked by hand, and no other', () => {
    const pick = chosen('rice', 'chicken', { side: ['plantain'] });
    expect(copyable(pick, main, [])).toBe(true);
    expect(copyable(pick, main, ['celery'])).toBe(false);
    expect(copyable(chosen('rice', 'chicken', { side: ['beans'] }), main, ['milk'])).toBe(false);
    expect(copyable(chosen('yam'), main, ['milk'])).toBe(false);
    expect(copyable(chosen('yam'), main, ['other'])).toBe(true);
    expect(copyable(chosen('stew'), main, ['milk'])).toBe(false);
    expect(copyable(chosen('rice', 'children', { side: ['plantain'] }), main, [])).toBe(false);
  });

  it('copies chef’s choice unless nothing is safe, skipped where the course can be skipped, and never needs the host', () => {
    const only = course([dish({ allergens: ['milk'] })]);
    expect(copyable(kind('chefsChoice'), main, ['milk'])).toBe(true);
    expect(copyable(kind('chefsChoice'), only, ['milk'])).toBe(false);
    expect(copyable(kind('skipped'), starter(), [])).toBe(true);
    expect(copyable(kind('skipped'), main, [])).toBe(false);
    expect(copyable(kind('needsHost'), main, [])).toBe(false);
    expect(copyable({ ...chosen('rice'), kind: 'needsHost' }, main, [])).toBe(false);
    expect(copyable(undefined, main, [])).toBe(false);
  });

  it('replaces what the person had, clears and asks what can’t be copied in course order, and skips a closed course', () => {
    const closed = {
      ...starter(),
      id: 'dessert',
      picksClose: { ...main.picksClose, closed: true },
    };
    const courses = [starter(), main, closed];
    const plates = {
      [keyOf('you', 'starter')]: kind('skipped'),
      [keyOf('you', 'main')]: chosen('stew'),
      [keyOf('you', 'dessert')]: kind('chefsChoice'),
      [keyOf('tom', 'starter')]: chosen('soup'),
      [keyOf('tom', 'main')]: chosen('rice', 'fish', { side: ['plantain'] }),
      [keyOf('tom', 'dessert')]: kind('skipped'),
    };
    const result = copyPlates(plates, 'you', 'tom', courses, ['milk']);
    expect(result.asked).toEqual(['main']);
    expect(result.plates[keyOf('tom', 'starter')]).toEqual(kind('skipped'));
    expect(result.plates[keyOf('tom', 'main')]).toBeUndefined();
    expect(result.plates[keyOf('tom', 'dessert')]).toEqual(kind('skipped'));
    expect(result.plates[keyOf('you', 'main')]).toEqual(chosen('stew'));
  });

  it('is a copy, not a link: changing the earlier person’s pick afterwards leaves the copy as it was', () => {
    const plates = { [keyOf('you', 'main')]: chosen('rice', 'chicken', { side: ['plantain'] }) };
    const copied = copyPlates(plates, 'you', 'tom', [main], []).plates;
    const source = copied[keyOf('you', 'main')];
    const copy = copied[keyOf('tom', 'main')];
    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy?.options.side).not.toBe(source?.options.side);
    const changed = { ...copied, [keyOf('you', 'main')]: chosen('yam') };
    expect(changed[keyOf('tom', 'main')]).toEqual(
      chosen('rice', 'chicken', { side: ['plantain'] }),
    );
  });

  it('sends a copied pick exactly as one picked by hand', () => {
    const pick = chosen('rice', 'chicken', { side: ['plantain'] });
    const eaters = [{ key: 'tom', id: 'tom-id', name: 'Tom', you: false }];
    const copied = copyPlates({ [keyOf('you', 'main')]: pick }, 'you', 'tom', [main], []).plates;
    expect(picksOf(copied, eaters, [main], (key) => (key === 'tom' ? 'tom-id' : null))).toEqual(
      picksOf({ [keyOf('tom', 'main')]: pick }, eaters, [main], () => 'tom-id'),
    );
  });
});
