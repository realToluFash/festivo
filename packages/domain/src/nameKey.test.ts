import { describe, expect, it } from 'vitest';

import { nameKey } from './nameKey.ts';

describe('nameKey', () => {
  it('reads a name without its case, accents or extra spaces', () => {
    expect(nameKey('  TÉRRACE   Bar ')).toBe('terrace bar');
  });

  it('folds a compatibility character as the API does', () => {
    expect(nameKey('Ｊosé Ｇriﬃn')).toBe(nameKey('jose griffin'));
  });
});
