import { describe, expect, it } from 'vitest';

import { crowdName } from './sampleNames.ts';

describe('crowdName', () => {
  it('gives 1,600 different names before one repeats', () => {
    const names = new Set(Array.from({ length: 1600 }, (_, index) => crowdName(index)));

    expect(names.size).toBe(1600);
  });
});
