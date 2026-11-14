import { describe, expect, it } from 'vitest';

import {
  type Dish,
  type Item,
  MW,
  asSingleDish,
  checkItems,
  checkOwn,
  courseItems,
  foldLine,
  itemName,
  menuStart,
  moved,
  movedLine,
  offered,
  orList,
  removeChoiceLine,
  removedLine,
  withoutChoice,
} from './menuServed.ts';

const fixed = (key: string, name: string): Item => ({ key, kind: 'fixed', name });
const choice = (key: string, choiceId: string): Item => ({ key, kind: 'choice', choiceId });
const variant = (key: string): Item => ({ key, kind: 'variant' });

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
  items: [],
};

const FISH: Dish = {
  ...DISH,
  id: 'f',
  name: 'Grilled fish',
  variants: ['Chicken', 'Fish'],
  choices: [],
  items: [variant('v'), fixed('a', 'Pepper sauce'), fixed('b', 'Yam chips')],
};

describe('a dish’s items (sc-34230)', () => {
  it('takes none, or 2 to 6, and refuses a single item', () => {
    expect(checkItems([], DISH).list).toBeNull();
    expect(checkItems([fixed('a', 'Rice')], DISH).list).toBe(MW.onlyOne);
    expect(checkItems([fixed('a', 'Rice'), fixed('b', 'Chicken')], DISH).list).toBeNull();
  });

  it('refuses the later of two names that differ only in case and spaces', () => {
    expect(checkItems([fixed('a', 'Rice'), fixed('b', ' rICE ')], DISH).byKey).toEqual({
      b: MW.same,
    });
  });

  it('refuses a blank name and one over 40 characters', () => {
    const errors = checkItems(
      [fixed('a', '  '), fixed('b', 'x'.repeat(41)), fixed('c', 'Rice')],
      DISH,
    );

    expect(errors.byKey).toEqual({ a: MW.blank, b: MW.long });
    expect(checkItems([fixed('a', 'x'.repeat(40)), fixed('b', 'Rice')], DISH).byKey).toEqual({});
  });

  it('shows a choice by its question, and one with none as a draft', () => {
    expect(itemName(choice('a', 'ch1'), DISH)).toBe('And a side?');
    expect(itemName(choice('a', 'ch3'), DISH)).toBe('Choice 3, no question yet');
  });

  it('shows the variant by the variants’ names as an or list', () => {
    expect(itemName(variant('v'), FISH)).toBe('Chicken or Fish');
    expect(orList(['Beef', 'Chicken', 'Fish'])).toBe('Beef, Chicken, or Fish');
    expect(orList(['Pollo', 'Pescado'], 'es')).toBe('Pollo o Pescado');
  });

  it('offers a choice once it has a question, and the variant, each only while not an item', () => {
    const names = (items: Item[], dish: Dish) =>
      offered(dish, items).map((one) => (one.kind === 'variant' ? one.name : one.choice.id));

    expect(names([choice('a', 'ch1')], DISH)).toEqual(['ch2']);
    expect(names([], { ...FISH, items: [] })).toEqual(['Chicken or Fish']);
    expect(names(FISH.items.slice(), FISH)).toEqual([]);
  });

  it('moves an item and says where it went, never past either end', () => {
    const items = [fixed('a', 'Chicken'), fixed('b', 'Rice'), choice('c', 'ch1')];

    expect(moved(items, 1, -1)?.map((one) => one.key)).toEqual(['b', 'a', 'c']);
    expect(moved(items, 0, -1)).toBeNull();
    expect(moved(items, 2, 1)).toBeNull();
    expect(movedLine('Jollof rice', 0, 3)).toBe('Jollof rice moved to item 1 of 3');
  });
});

describe('one name is one item on a course', () => {
  it('lists the course’s items once each, in the order they first appear', () => {
    const jollof: Dish = { ...DISH, items: [fixed('a', 'Jollof rice'), choice('b', 'ch1')] };
    const rice: Dish = { ...DISH, id: 'r', name: 'Rice and stew', items: [] };
    const stew: Dish = {
      ...DISH,
      id: 's',
      name: 'Stew',
      items: [fixed('a', ' JOLLOF RICE '), fixed('b', 'Salad')],
    };

    expect(
      courseItems({
        dishes: [jollof, FISH, rice, stew],
        ownItems: [
          { key: 'o', kind: 'fixed', name: 'Bread roll' },
          { key: 'p', kind: 'fixed', name: 'plantain' },
        ],
      }),
    ).toEqual([
      'Jollof rice',
      'Plantain',
      'Salad',
      'Chicken',
      'Fish',
      'Pepper sauce',
      'Yam chips',
      'Rice and stew',
      'Bread roll',
    ]);
  });
});

describe('removing a choice that is an item, and making a dish single', () => {
  const listed = {
    ...DISH,
    items: [fixed('a', 'Rice'), fixed('b', 'Chicken'), choice('c', 'ch1')],
  };

  it('says the choice is also an item', () => {
    expect(removeChoiceLine(listed, DISH.choices[0]!, 0)).toBe(
      'Remove “And a side?” from Jollof rice? “And a side?” is also one of Jollof rice’s items.',
    );
    expect(removeChoiceLine(listed, DISH.choices[1]!, 1)).toBe(
      'Remove “And a sauce?” from Jollof rice?',
    );
  });

  it('names a choice with no question as The choice once it is removed', () => {
    expect(removedLine(DISH, DISH.choices[0]!)).toBe('And a side? removed from Jollof rice.');
    expect(removedLine(DISH, DISH.choices[2]!)).toBe('The choice removed from Jollof rice.');
  });

  it('takes the item with it, leaving 2, and a single item left too', () => {
    expect(withoutChoice(listed, 'ch1').items.map((one) => one.key)).toEqual(['a', 'b']);
    expect(
      withoutChoice({ ...DISH, items: [fixed('a', 'Rice'), choice('c', 'ch1')] }, 'ch1').items,
    ).toEqual([]);
  });

  it('adds that the variants are an item to the fold question, only when they are', () => {
    expect(foldLine(FISH)).toBe(
      'Make this a single dish? The variants are also one of Grilled fish’s items.',
    );
    expect(foldLine({ ...FISH, items: [] })).toBe('Make this a single dish?');
  });

  it('takes the variant out of the items, leaving 2, and a single item left too', () => {
    expect(asSingleDish(FISH).items.map((one) => one.key)).toEqual(['a', 'b']);
    expect(asSingleDish(FISH).variants).toEqual([]);
    expect(asSingleDish({ ...FISH, items: [variant('v'), fixed('a', 'Rice')] }).items).toEqual([]);
  });
});

describe('a course’s own items', () => {
  it('names them under the dish’s rules, one allowed', () => {
    expect(checkOwn([{ key: 'o', kind: 'fixed', name: 'Bread roll' }]).byKey).toEqual({});
    expect(
      checkOwn([
        { key: 'o', kind: 'fixed', name: 'Bread roll' },
        { key: 'p', kind: 'fixed', name: 'bread roll' },
      ]).byKey,
    ).toEqual({ p: MW.same });
  });

  it('opens with items on a dish of every course but the Starter’s, which has none', () => {
    const counts = menuStart(null).courses.map((one) => one.dishes.map((d) => d.items.length));

    expect(counts).toEqual([[0], [3, 0], [2]]);
  });
});
