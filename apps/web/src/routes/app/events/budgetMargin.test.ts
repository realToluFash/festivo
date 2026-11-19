import { describe, expect, it } from 'vitest';

import { markupProblem, percentWords, sentMarkup } from './budgetMargin.ts';

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
    ['', 'en', null],
  ] as const)('%s in %s is %s', (typed, language, problem) => {
    expect(markupProblem(typed, language)).toBe(problem);
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
