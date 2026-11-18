import type { MenuDishChoice } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  type FixedRow,
  dishItemProblems,
  itemNameOf,
  itemOffers,
  movedItems,
  ownItemProblems,
  sentItems,
} from './dishItems.ts';

const orList = (names: string[]) =>
  new Intl.ListFormat('en', { type: 'disjunction' }).format(names);

const choice = (id: string, question: string): MenuDishChoice => ({
  id,
  question,
  pick: 1,
  required: true,
  draft: question === '',
  noneAnswers: 0,
  options: [],
});

const plain = { variants: [], choices: [choice('ch1', 'And a side?'), choice('ch3', '')] };
const fish = {
  variants: [{ name: 'Croaker' }, { name: 'Tilapia' }] as never[],
  choices: [],
};

const fixed = (key: string, name: string): FixedRow => ({ key, kind: 'fixed', name });

describe('a dish’s items', () => {
  it('names a choice by its question and the variant as an or list', () => {
    expect(itemNameOf({ kind: 'choice', choiceId: 'ch1' }, plain, orList)).toBe('And a side?');
    expect(itemNameOf({ kind: 'choice', choiceId: 'ch3' }, plain, orList)).toBeNull();
    expect(itemNameOf({ kind: 'variants' }, fish, orList)).toBe('Croaker or Tilapia');
  });

  it('offers the variant first and only choices with a question that are not items yet', () => {
    expect(itemOffers(plain, [])).toEqual([{ kind: 'choice', choiceId: 'ch1' }]);
    expect(itemOffers(plain, [{ kind: 'choice', choiceId: 'ch1' }])).toEqual([]);
    expect(itemOffers(fish, [])).toEqual([{ kind: 'variants' }]);
    expect(itemOffers(fish, [{ kind: 'variants' }])).toEqual([]);
  });

  it('refuses a single item, a blank, over 40, and the later of two same names', () => {
    expect(dishItemProblems([fixed('a', 'Rice')], plain, orList).list).toBe('onlyOne');
    expect(dishItemProblems([], plain, orList).list).toBeNull();
    expect(
      dishItemProblems(
        [fixed('a', 'Rice'), fixed('b', ' '), fixed('c', 'x'.repeat(41)), fixed('d', ' RICE ')],
        plain,
        orList,
      ).byKey,
    ).toEqual({ b: 'blank', c: 'long', d: 'taken' });
    expect(
      dishItemProblems(
        [fixed('a', 'and a side?'), { key: 'b', kind: 'choice', choiceId: 'ch1' }],
        plain,
        orList,
      ).byKey,
    ).toEqual({ b: 'taken' });
  });

  it('keeps a choice item whose question was cleared without a refusal', () => {
    expect(
      dishItemProblems(
        [fixed('a', 'Rice'), { key: 'b', kind: 'choice', choiceId: 'ch3' }],
        plain,
        orList,
      ).byKey,
    ).toEqual({});
  });

  it('refuses a course’s own items under the same names', () => {
    expect(ownItemProblems([fixed('a', 'Bread roll'), fixed('b', 'bread ROLL')]).byKey).toEqual({
      b: 'taken',
    });
    expect(ownItemProblems([fixed('a', 'Bread roll')]).list).toBeNull();
  });

  it('moves one place and not past either end', () => {
    expect(movedItems(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movedItems(['a', 'b'], 0, -1)).toBeNull();
    expect(movedItems(['a', 'b'], 1, 1)).toBeNull();
  });

  it('sends names trimmed, without the keys', () => {
    expect(sentItems([fixed('a', ' Rice '), { key: 'b', kind: 'variants' }])).toEqual([
      { kind: 'fixed', name: 'Rice' },
      { kind: 'variants' },
    ]);
  });
});
