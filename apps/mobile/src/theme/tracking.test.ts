import { describe, expect, it } from 'vitest';

import { tokens } from './tokens.ts';
import { tracking } from './tracking.ts';

describe('tracking', () => {
  it('turns typeLabel 0.1em at 12 into 1.2 points', () => {
    expect(tracking(tokens.typeLabel)).toBeCloseTo(1.2);
  });

  it('keeps a negative em negative', () => {
    expect(tracking({ size: 20, letterSpacing: '-0.02em' })).toBeCloseTo(-0.4);
  });

  it('reads a bare 0 as no tracking', () => {
    expect(tracking({ size: 14, letterSpacing: '0' })).toBe(0);
  });
});
