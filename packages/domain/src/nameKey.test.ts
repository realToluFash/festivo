import { describe, expect, it } from 'vitest';

import { holdingName, nameKey } from './nameKey.ts';

describe('nameKey', () => {
  it('reads a name without its case, accents or extra spaces', () => {
    expect(nameKey('  TÉRRACE   Bar ')).toBe('terrace bar');
  });

  it('folds a compatibility character as the API does', () => {
    expect(nameKey('Ｊosé Ｇriﬃn')).toBe(nameKey('jose griffin'));
  });

  it('names the one that holds a name, leaving out the one being renamed', () => {
    const named = [
      { id: 'a', name: 'Terrace' },
      { id: 'b', name: 'Table 2' },
    ];

    expect(holdingName(named, 'TÉRRACE', null)?.name).toBe('Terrace');
    expect(holdingName(named, 'terrace', 'a')).toBeNull();
    expect(holdingName(named, ' table  2', 'a')?.id).toBe('b');
  });
});
