import { describe, expect, it } from 'vitest';

import {
  type Answers,
  NO_ALLERGIES,
  SCREENS,
  clearRuledOut,
  courseOf,
  dishOf,
  markOf,
  markedOpen,
  nothingSafe,
  ruledOut,
  screenAt,
  screensOf,
} from './mealParty.ts';

const dish = (course: 'starter' | 'main' | 'dessert', id: string) => {
  const one = dishOf(course, id);
  if (one == null) throw new Error(id);

  return one;
};

describe('the allergy rule on the meal step (sc-3907)', () => {
  it('rules out a dish by the allergens of theirs it contains, in Annex II order', () => {
    expect(ruledOut(dish('starter', 'canape'), ['sesame', 'peanuts'])).toEqual({
      kind: 'allergen',
      codes: ['peanuts', 'sesame'],
    });
    expect(ruledOut(dish('starter', 'pepper'), ['peanuts'])).toBeNull();
  });

  it('rules out Allergens not stated for anyone with one of the 14, and nobody else', () => {
    expect(ruledOut(dish('starter', 'gizdodo'), ['milk'])).toEqual({ kind: 'notStated' });
    expect(ruledOut(dish('starter', 'gizdodo'), [])).toBeNull();
  });

  it('finds nothing safe when every dish is ruled out', () => {
    expect(nothingSafe(courseOf('main'), ['celery', 'fish'])).toBe(true);
    expect(nothingSafe(courseOf('main'), ['fish'])).toBe(false);
  });

  it('asks person by person, course by course', () => {
    expect(SCREENS.map((one) => `${one.who} ${one.course} ${one.n}/${one.total}`)).toEqual([
      'me starter 1/3',
      'me main 2/3',
      'me dessert 3/3',
      'chidi starter 1/3',
      'chidi main 2/3',
      'chidi dessert 3/3',
    ]);
  });
});

const picked: Answers = {
  'chidi|main': { kind: 'chosen', dishId: 'egusi', by: 'guest' },
  'chidi|dessert': { kind: 'chosen', dishId: 'icecream', by: 'host' },
  'chidi|starter': { kind: 'kitchen' },
};

describe('a pick an allergy given since rules out (sc-3907)', () => {
  it('clears it going forward, keeps the rest, and keeps a pick the host made', () => {
    const result = clearRuledOut(picked, { me: [], chidi: ['milk'] }, SCREENS);

    expect(result.answers['chidi|main']).toBeUndefined();
    expect(result.answers['chidi|starter']).toEqual({ kind: 'kitchen' });
    expect(result.answers['chidi|dessert']).toEqual(picked['chidi|dessert']);
    expect(result.cleared).toEqual({ 'chidi|main': { dishId: 'egusi', codes: ['milk'] } });
  });

  it('marks it at Check and send, never a host’s pick, and counts open rows only', () => {
    const milk = { me: [], chidi: ['milk'] } as const;

    expect(markOf('chidi|main', picked, milk, 'en')).toBe(
      'Chidi Okonkwo-Williams is allergic to: milk.',
    );
    expect(markOf('chidi|dessert', picked, milk, 'en')).toBeNull();
    expect(markOf('chidi|main', picked, NO_ALLERGIES, 'en')).toBeNull();
    expect(markedOpen(picked, milk, () => false, 'en', SCREENS)).toEqual(['chidi|main']);
    expect(markedOpen(picked, milk, (course) => course === 'main', 'en', SCREENS)).toEqual([]);
  });

  it('walks only the people it is given, as Preview as guest does for the host alone', () => {
    const milk = { me: [], chidi: ['milk'] } as const;
    const hostAlone = screensOf(['me']);

    expect(clearRuledOut(picked, milk, hostAlone).cleared).toEqual({});
    expect(markedOpen(picked, milk, () => false, 'en', hostAlone)).toEqual([]);
    expect(screenAt('me', 'main', hostAlone)).toBe(1);
    expect(screenAt('chidi', 'main', hostAlone)).toBe(-1);
  });
});
