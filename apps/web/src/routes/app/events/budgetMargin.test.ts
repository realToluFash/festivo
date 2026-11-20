import { describe, expect, it } from 'vitest';

import type { BudgetLine } from '@soirely/api-client';

import { markupProblem, listedOnMarginFace, percentWords, sentMarkup } from './budgetMargin.ts';

describe('a typed markup (sc-92)', () => {
  it.each([
    ['-5', 'en', 'negative'],
    ['−5', 'en', 'negative'],
    ['twenty', 'en', 'number'],
    ['20.25', 'en', 'decimals'],
    ['1000', 'en', 'high'],
    ['999.9', 'en', null],
    ['12,5', 'fr', null],
    ['12.5', 'fr', 'number'],
  ] as const)('%s in %s is %s', (typed, language, problem) => {
    expect(markupProblem(typed, language)).toBe(problem);
  });

  it('takes blank as a removal only where a markup is set', () => {
    expect(markupProblem(' ', 'en', true)).toBeNull();
    expect(markupProblem(' ', 'en')).toBe('number');
  });

  it('is sent with a point, and blank takes the markup away', () => {
    expect(sentMarkup('12,5', 'fr')).toBe('12.5');
    expect(sentMarkup('  ', 'en')).toBeNull();
  });

  it('writes the cap as the language writes a percent', () => {
    expect(percentWords(999.9, 'fr', 1).replace(/\s/gu, ' ')).toBe('999,9 %');
    expect(percentWords(999.9, 'en', 1)).toBe('999.9%');
  });
});

describe('the costs the margin face lists (sc-92)', () => {
  const line = (over: Partial<BudgetLine>): BudgetLine =>
    ({
      basis: 'fixed',
      rate: null,
      amount: '1000.00',
      quantity: { count: 1 },
      ...over,
    }) as BudgetLine;

  it('lists a fixed line at 0, so a fee with no price yet can be given one', () => {
    expect(listedOnMarginFace(line({ amount: '0.00' }))).toBe(true);
  });

  it('lists a priced line, and leaves out a rate of 0 and a line counting nothing yet', () => {
    expect(listedOnMarginFace(line({}))).toBe(true);
    expect(listedOnMarginFace(line({ basis: 'per_head', amount: null, rate: '0.00' }))).toBe(false);
    expect(listedOnMarginFace(line({ quantity: { count: 0 } } as Partial<BudgetLine>))).toBe(false);
  });
});
