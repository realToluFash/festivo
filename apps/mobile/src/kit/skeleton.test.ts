import { describe, expect, it } from 'vitest';

import { SKELETON_AFTER_MS, SKELETON_PULSE, barWidths, fillingRows } from './skeleton.ts';

describe('a screen waiting for its content (sc-23303)', () => {
  it('shows nothing for the first second', () => {
    expect(SKELETON_AFTER_MS).toBe(1000);
  });

  it('pulses for under five seconds, then holds still', () => {
    expect(SKELETON_PULSE.ms * SKELETON_PULSE.times).toBeLessThan(5000);
  });

  it('fills the room it has with rows, never fewer than three or more than ten', () => {
    expect(fillingRows(600, 64)).toBe(9);
    expect(fillingRows(100, 76)).toBe(3);
    expect(fillingRows(2000, 56)).toBe(10);
  });

  it('repeats one fixed pattern of bar widths', () => {
    expect(barWidths(0)).toEqual(barWidths(4));
    expect(barWidths(1)).not.toEqual(barWidths(0));
  });
});
