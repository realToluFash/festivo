import { describe, expect, it } from 'vitest';

import { moreChip } from './moreChip.ts';

describe('moreChip', () => {
  it('writes a plus and the number up to 99', () => {
    expect(moreChip(1)).toBe('+1');
    expect(moreChip(42)).toBe('+42');
    expect(moreChip(99)).toBe('+99');
  });

  it('writes 99+ from 100 on, never the figure', () => {
    expect(moreChip(100)).toBe('99+');
    expect(moreChip(1321)).toBe('99+');
  });
});
