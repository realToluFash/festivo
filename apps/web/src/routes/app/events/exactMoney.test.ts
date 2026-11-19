import { describe, expect, it } from 'vitest';

import { figureGroups, wholeMoney } from './exactMoney.ts';

describe('wholeMoney (sc-72618)', () => {
  it('reads a figure past 16 digits exactly, in whole units', () => {
    expect(wholeMoney('100999999999999998.99', 'GBP', 'en')).toBe('£100,999,999,999,999,999');
    expect(wholeMoney('99999999999999999.00', 'GBP', 'en')).toBe('£99,999,999,999,999,999');
    expect(wholeMoney('999999999999999.99', 'GBP', 'en')).toBe('£1,000,000,000,000,000');
    expect(wholeMoney('100999999999999998.99', 'GBP', 'es')).toBe('100.999.999.999.999.999 GBP');
  });

  it('rounds half up at any size', () => {
    expect(wholeMoney('101999999999999998.49', 'GBP', 'en')).toBe('£101,999,999,999,999,998');
    expect(wholeMoney('101999999999999998.50', 'GBP', 'en')).toBe('£101,999,999,999,999,999');
    expect(wholeMoney('270.50', 'GBP', 'en')).toBe('£271');
  });

  it('keeps a change under one unit in the minor unit', () => {
    expect(wholeMoney('0.40', 'GBP', 'en')).toBe('£0.40');
    expect(wholeMoney('0.00', 'GBP', 'en')).toBe('£0');
    expect(wholeMoney('1.40', 'GBP', 'en')).toBe('£1');
  });
});

describe('figureGroups', () => {
  it('ends each piece after a group separator, the sign and code kept with their group', () => {
    expect(figureGroups('+£1,000,000')).toEqual(['+£1,', '000,', '000']);
    expect(figureGroups('100.999.999 GBP')).toEqual(['100.', '999.', '999 GBP']);
    expect(figureGroups('1 000 000 GBP')).toEqual(['1 ', '000 ', '000 GBP']);
    expect(figureGroups('£270')).toEqual(['£270']);
  });
});
