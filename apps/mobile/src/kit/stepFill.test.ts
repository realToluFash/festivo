import { describe, expect, it } from 'vitest';

import { stepFill } from './stepFill.ts';

describe('stepFill', () => {
  it('fills the step bar a step at a time, short of full', () => {
    expect(stepFill(1, 4)).toBeCloseTo(0.22, 2);
    expect(stepFill(4, 4)).toBeLessThan(1);
    expect(stepFill(0, 0)).toBe(0);
  });
});
