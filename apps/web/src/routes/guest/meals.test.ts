import type { MealCourse, MealDish } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  against,
  cardParts,
  dishRuled,
  markOf,
  nothingSafe,
  partsAllergens,
  picksOf,
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

  it('reads not stated when any part never stated its allergens', () => {
    expect(partsAllergens([{ allergens: [] }, { allergens: null }])).toBeNull();
  });
});
