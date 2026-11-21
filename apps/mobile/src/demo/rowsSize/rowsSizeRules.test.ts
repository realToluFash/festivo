import { describe, expect, it } from 'vitest';

import { labelSize } from './rowsSizeRules.ts';

describe('labelSize', () => {
  it('keeps the start while the widest word fits', () => {
    expect(labelSize(16, 43, 200, 246)).toBe(43);
  });

  it('steps down to the largest size at which the widest word fits', () => {
    // Notifications measures about 300 at 43 in a 246 room.
    expect(labelSize(16, 43, 300, 246)).toBe(35);
  });

  it('never draws a label under its default size, so a word too wide even there breaks alone', () => {
    expect(labelSize(16, 43, 1400, 246)).toBe(16);
  });
});
