import { describe, expect, it } from 'vitest';

import {
  type Dish,
  type Part,
  MW,
  checkOwn,
  checkParts,
  keptHidden,
  menuStart,
  moved,
  movedLine,
  offeredChoices,
  partName,
  platedTables,
  removeChoiceLine,
  withoutChoice,
} from './menuServed.ts';

const fixed = (key: string, name: string): Part => ({ key, kind: 'fixed', name });
const choice = (key: string, choiceId: string): Part => ({ key, kind: 'choice', choiceId });

const DISH: Dish = {
  id: 'd',
  name: 'Jollof rice',
  desc: '',
  contains: ['Celery'],
  variants: [],
  choices: [
    { id: 'ch1', question: 'And a side?', options: ['Plantain', 'Salad'] },
    { id: 'ch2', question: 'And a sauce?', options: ['Shito', 'Pepper sauce'] },
    { id: 'ch3', question: '', options: ['Mild', 'Hot'] },
  ],
  parts: [],
  fromLibrary: false,
};

describe('a dish’s parts (sc-34230)', () => {
  it('takes none, or 2 to 6, and refuses a single part', () => {
    expect(checkParts([], DISH).list).toBeNull();
    expect(checkParts([fixed('a', 'Rice')], DISH).list).toBe(MW.onlyOne);
    expect(checkParts([fixed('a', 'Rice'), fixed('b', 'Chicken')], DISH).list).toBeNull();
  });

  it('refuses the later of two names that differ only in case and spaces', () => {
    const errors = checkParts([fixed('a', 'Rice'), fixed('b', ' rICE ')], DISH);

    expect(errors.byKey).toEqual({ b: MW.same });
  });

  it('refuses a blank name and one over 40 characters', () => {
    const errors = checkParts(
      [fixed('a', '  '), fixed('b', 'x'.repeat(41)), fixed('c', 'Rice')],
      DISH,
    );

    expect(errors.byKey).toEqual({ a: MW.blank, b: MW.long });
    expect(checkParts([fixed('a', 'x'.repeat(40)), fixed('b', 'Rice')], DISH).byKey).toEqual({});
  });

  it('shows a choice by its question, and one with none as a draft', () => {
    expect(partName(choice('a', 'ch1'), DISH)).toBe('And a side?');
    expect(partName(choice('a', 'ch3'), DISH)).toBe('Choice 3 · no question yet');
  });

  it('offers a choice once it has a question, and not again once it is a part', () => {
    expect(offeredChoices(DISH, [choice('a', 'ch1')]).map((one) => one.id)).toEqual(['ch2']);
  });

  it('moves a part and says where it went, never past either end', () => {
    const parts = [fixed('a', 'Chicken'), fixed('b', 'Rice'), choice('c', 'ch1')];

    expect(moved(parts, 1, -1)?.map((one) => one.key)).toEqual(['b', 'a', 'c']);
    expect(moved(parts, 0, -1)).toBeNull();
    expect(moved(parts, 2, 1)).toBeNull();
    expect(movedLine('Rice', 0, 3)).toBe('Rice moved to part 1 of 3.');
  });
});

describe('removing a choice that is a part', () => {
  const parted = {
    ...DISH,
    parts: [fixed('a', 'Rice'), fixed('b', 'Chicken'), choice('c', 'ch1')],
  };

  it('says the choice is also a part', () => {
    expect(removeChoiceLine(parted, DISH.choices[0]!, 0)).toBe(
      'Remove “And a side?” from Jollof rice? “And a side?” is also one of Jollof rice’s parts.',
    );
    expect(removeChoiceLine(parted, DISH.choices[1]!, 1)).toBe(
      'Remove “And a sauce?” from Jollof rice?',
    );
  });

  it('takes the part with it, leaving 2', () => {
    expect(withoutChoice(parted, 'ch1').parts.map((one) => one.key)).toEqual(['a', 'b']);
  });

  it('takes a single part left with it too, so the dish is one plate', () => {
    const two = { ...DISH, parts: [fixed('a', 'Rice'), choice('c', 'ch1')] };

    expect(withoutChoice(two, 'ch1').parts).toEqual([]);
  });
});

describe('a course’s own parts, Plated at and the kept parts', () => {
  it('names course parts under the dish’s rules, one allowed', () => {
    expect(checkOwn([{ key: 'o', kind: 'fixed', name: 'Drink' }]).byKey).toEqual({});
    expect(
      checkOwn([
        { key: 'o', kind: 'fixed', name: 'Drink' },
        { key: 'p', kind: 'fixed', name: 'drink' },
      ]).byKey,
    ).toEqual({ p: MW.same });
  });

  it('starts every course Plated', () => {
    expect(menuStart(null).courses.every((one) => one.howServed === 'plated')).toBe(true);
  });

  it('keeps parts out of sight on a Plated course', () => {
    const course = menuStart('hidden').courses[1]!;

    expect(keptHidden({ ...course, howServed: 'plated' })).toBe(true);
    expect(keptHidden(course)).toBe(false);
  });

  it('drops a deleted table from Plated at', () => {
    const start = menuStart('tableDeleted');

    expect(platedTables(start.courses[1]!, start.tables).map((one) => one.name)).toEqual([
      'Top table',
    ]);
  });
});
