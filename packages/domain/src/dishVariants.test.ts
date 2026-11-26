import { describe, expect, it } from 'vitest';

import {
  type VariantForm,
  addVariantOutcome,
  blankVariantForm,
  firstVariantProblem,
  guestsPickTheWay,
  removeVariantOutcome,
  variantDetailsOf,
  variantProblems,
} from './dishVariants.ts';

const form = (more: Partial<VariantForm>): VariantForm => ({
  ...blankVariantForm('EUR'),
  none: true,
  ...more,
});

const variant = (id: string, chosen: 'everyone' | 'children', picked = false) => ({
  id,
  for: chosen,
  picked,
});

describe('variantProblems', () => {
  it('refuses a blank name, one over 60 and one another variant or a block above has', () => {
    const problems = variantProblems(
      [
        form({ name: ' ' }),
        form({ name: 'x'.repeat(61) }),
        form({ name: 'fish' }),
        form({ name: 'FISH' }),
      ],
      [{ name: 'Fish', for: 'everyone' }],
      'en',
      false,
    );

    expect(problems.map((one) => one.name)).toEqual(['blank', 'long', 'taken', 'taken']);
  });

  it('refuses each For when every block is Children only and nothing else is for Everyone', () => {
    const both = [form({ name: 'A', for: 'children' }), form({ name: 'B', for: 'children' })];

    expect(variantProblems(both, [], 'en', false).map((one) => one.for)).toEqual([
      'noEveryone',
      'noEveryone',
    ]);
    expect(
      variantProblems(both.slice(0, 1), [{ name: 'C', for: 'everyone' }], 'en', false)[0]?.for,
    ).toBeNull();
  });

  it('asks Contains, and reads the money only with budget.read', () => {
    const [one] = variantProblems(
      [form({ name: 'A', none: false, amount: '12.5.0' })],
      [],
      'en',
      true,
    );

    expect(one?.contains).toBe('blank');
    expect(one?.amount).toBe('wrong');
    expect(
      variantProblems([form({ name: 'A', amount: 'x' })], [], 'en', false)[0]?.amount,
    ).toBeNull();
  });

  it('puts focus on the first problem across the blocks, For on its checked radio', () => {
    const forms = [form({ name: 'A', for: 'children' }), form({ name: '', for: 'children' })];

    expect(firstVariantProblem(variantProblems(forms, [], 'en', false), forms)).toBe(
      'vb0-for-children',
    );
  });
});

describe('variantDetailsOf', () => {
  it('sends the cost on an event and the last price in the library, only with budget.read', () => {
    const typed = form({ name: ' Fish ', amount: '15,50' });

    expect(variantDetailsOf(typed, 'event', 'fr', true)).toMatchObject({
      name: 'Fish',
      cost: '15.50',
    });
    expect(variantDetailsOf(typed, 'library', 'fr', true).lastPrice).toEqual({
      amount: '15.50',
      currency: 'EUR',
    });
    expect(variantDetailsOf(typed, 'event', 'fr', false)).not.toHaveProperty('cost');
  });
});

describe('Add variant and Remove…', () => {
  it('opens nothing at six, or on a picked dish without variants', () => {
    expect(addVariantOutcome([1, 2, 3, 4, 5, 6], false)).toBe('limit');
    expect(addVariantOutcome([], true)).toBe('picked');
    expect(addVariantOutcome([1, 2], true)).toBe('open');
  });

  it('folds from two, asks from three, and refuses the last Everyone variant and a picked one', () => {
    const three = [variant('a', 'everyone'), variant('b', 'children'), variant('c', 'children')];

    expect(removeVariantOutcome(three.slice(0, 2), three[0]!)).toEqual({ kind: 'fold' });
    expect(removeVariantOutcome(three, three[1]!)).toEqual({ kind: 'ask' });
    expect(removeVariantOutcome(three, three[0]!)).toEqual({
      kind: 'refused',
      lines: ['lastEveryone'],
    });
    expect(removeVariantOutcome(three, { ...three[0]!, picked: true })).toEqual({
      kind: 'refused',
      lines: ['picked', 'lastEveryone'],
    });
  });
});

describe('guestsPickTheWay', () => {
  it('shows only while two or more variants of the one dish are for Everyone', () => {
    expect(
      guestsPickTheWay([{ variants: [variant('a', 'everyone'), variant('b', 'everyone')] }]),
    ).toBe(true);
    expect(
      guestsPickTheWay([{ variants: [variant('a', 'everyone'), variant('b', 'children')] }]),
    ).toBe(false);
  });
});
