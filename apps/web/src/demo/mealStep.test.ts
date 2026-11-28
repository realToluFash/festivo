import { describe, expect, it } from 'vitest';

import {
  MW,
  PERSON,
  cardLines,
  mealStart,
  nothingSafe,
  recordedOf,
  refusalOf,
  ruledOutBy,
  screensOf,
} from './mealStep.ts';

const at = (state: Parameters<typeof mealStart>[0]) => {
  const start = mealStart(state);
  const screens = screensOf(start.course, start.answer);

  return { ...start, screen: screens[start.at] ?? { kind: 'done' as const }, screens };
};

describe('the screens a course asks (sc-3904)', () => {
  it('asks the dish, the way, then each choice, one per screen', () => {
    expect(at('side').screens.map((one) => one.kind)).toEqual([
      'dish',
      'way',
      'choice',
      'choice',
      'done',
    ]);
  });

  it('starts a set course on its first choice, or its way', () => {
    expect(at('setChoices').screens.map((one) => one.kind)).toEqual(['choice', 'choice', 'done']);
    expect(at('setVariants').screens[0]?.kind).toBe('way');
  });
});

describe('what Next refuses', () => {
  it('names the course on a set course’s first screen', () => {
    const { screen, course, answer } = at('setNoAnswer');
    expect(refusalOf(screen, course, answer, true)).toBe(MW.chooseFor('Main', PERSON));
  });

  it('asks a required choice, and offers None for me on an optional one', () => {
    const side = at('sideBlank');
    expect(refusalOf(side.screen, side.course, side.answer, false)).toBe(MW.chooseOne);
    const sauce = at('sauceBlank');
    expect(refusalOf(sauce.screen, sauce.course, sauce.answer, false)).toBe(MW.pickOrNone);
  });

  it('says the count when it is wrong', () => {
    const { screen, course, answer } = at('setWrongCount');
    expect(refusalOf(screen, course, answer, true)).toBe('Pick exactly 2. You’ve picked 1.');
  });

  it('takes the kitchen’s choice and no course without a pick', () => {
    const { screen, course, answer } = at('setNoAnswer');
    expect(refusalOf(screen, course, { ...answer, way: 'kitchen' }, true)).toBeNull();
    expect(refusalOf(screen, course, { ...answer, way: 'skipped' }, true)).toBeNull();
  });
});

describe('allergies', () => {
  it('rules out an option by the person’s recorded allergens', () => {
    expect(ruledOutBy(['mustard'], ['mustard', 'peanuts'])).toEqual(['mustard']);
    expect(ruledOutBy('none', ['mustard'])).toEqual([]);
  });

  it('finds nothing safe when the dish itself is ruled out', () => {
    const { course, allergies } = mealStart('setNothingSafe');
    expect(nothingSafe(course.dishes[0]!, allergies)).toBe(true);
    expect(nothingSafe(course.dishes[0]!, ['mustard'])).toBe(false);
  });
});

describe('the dish card and the answer', () => {
  it('adds the picked options’ allergens to the way’s, each source on its line', () => {
    const { course, answer } = mealStart('cardShito');
    expect(cardLines(course.dishes[0]!, answer, 'en')).toEqual({
      contains: 'Contains: crustaceans, fish',
      sources: [
        'Jollof rice with fish · fish',
        'Plantain · none of the 14 allergens',
        'Shito · crustaceans, fish',
      ],
    });
  });

  it('names the allergens in the language the format asks', () => {
    const { course, answer } = mealStart('cardShito');
    expect(cardLines(course.dishes[0]!, answer, 'fr')?.contains).toBe(
      'Contains: crustacés, poissons',
    );
  });

  it('records the picks, the kitchen’s choice, or the host', () => {
    const { course, answer } = mealStart('card');
    expect(recordedOf(course, answer, false)).toBe(
      'Main is recorded as chosen: Jollof rice, Fish, Plantain, None for me.',
    );
    expect(recordedOf(course, { ...answer, way: 'kitchen' }, false)).toBe(
      'Main is recorded as chef’s choice.',
    );
    expect(recordedOf(course, answer, true)).toBe('Main is recorded as needs the host.');
  });
});
