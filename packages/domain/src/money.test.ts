import { describe, expect, it } from 'vitest';

import { amountExample, readAmount, typedAmount } from './money.ts';

describe('readAmount', () => {
  it.each([
    ['4,500', 'en', 'NGN', '4500.00'],
    ['12.50', 'en', 'GBP', '12.50'],
    ['4 500', 'fr', 'EUR', '4500.00'],
    ['4\u202f500', 'fr', 'EUR', '4500.00'],
    ['12,50', 'fr', 'EUR', '12.50'],
    ['4.500', 'es', 'EUR', '4500.00'],
    ['12,50', 'pt', 'EUR', '12.50'],
    ['4500', 'pt', 'EUR', '4500.00'],
    ['3500', 'en', 'JPY', '3500'],
    ['12.125', 'en', 'KWD', '12.125'],
  ] as const)('takes %s in %s for %s', (typed, language, currency, amount) => {
    expect(readAmount(typed, language, currency)).toBe(amount);
  });

  it.each([
    ['-5', 'en', 'NGN'],
    ['3,500 naira', 'en', 'NGN'],
    ['12,50', 'en', 'GBP'],
    ['45,00', 'en', 'GBP'],
    ['3500.50', 'en', 'JPY'],
    ['12.505', 'en', 'NGN'],
    ['1.2345', 'en', 'KWD'],
  ] as const)('refuses %s in %s for %s', (typed, language, currency) => {
    expect(readAmount(typed, language, currency)).toBeNull();
  });
});

describe('amountExample', () => {
  it.each([
    ['en', 'GBP', '12.50'],
    ['fr', 'EUR', '12,50'],
    ['en', 'JPY', '12'],
    ['en', 'KWD', '12.500'],
  ] as const)('is %s %s as %s', (language, currency, example) => {
    expect(amountExample(language, currency)).toBe(example);
  });

  it('writes a stored price back in the language', () => {
    expect(typedAmount('4500.00', 'fr', 'EUR')).toBe('4 500,00');
    expect(typedAmount('3500', 'en', 'JPY')).toBe('3,500');
  });
});
