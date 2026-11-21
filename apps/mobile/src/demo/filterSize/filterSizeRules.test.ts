import { describe, expect, it } from 'vitest';

import { datesStacked, drilledSize, drilledStart, filterScale } from './filterSizeRules.ts';

const AX1 = filterScale('ax1', 1);
const AX5 = filterScale('ax5', 1);

describe('drilledStart', () => {
  it('draws as main at the standard sizes', () => {
    expect(drilledStart(16, 1, 34)).toBe(16);
    expect(drilledStart(16, filterScale('seventh', 1), 46)).toBeCloseTo(21.648);
  });

  it('grows no larger than the Events title from AX1', () => {
    expect(drilledStart(16, AX1, 38)).toBeCloseTo(28.576);
    expect(drilledStart(16, AX5, 43)).toBe(43);
  });

  it('follows a title that stepped down to keep a word whole', () => {
    expect(drilledStart(16, AX5, 36)).toBe(36);
  });
});

describe('drilledSize', () => {
  it('keeps the start while the widest word fits', () => {
    expect(drilledSize(16, AX5, 43, 190, 206)).toBe(43);
  });

  it('steps a word wider than its line down to the largest size it fits whole', () => {
    // Conference measures about 236 at 43 in a 206 room.
    expect(drilledSize(16, AX5, 43, 236, 206)).toBe(37);
  });

  it('never draws under the default size, so a word too wide even there breaks alone', () => {
    expect(drilledSize(16, AX5, 43, 1400, 206)).toBe(16);
  });

  it('never steps down at the standard sizes', () => {
    expect(drilledSize(16, 1, 34, 400, 206)).toBe(16);
  });
});

describe('datesStacked', () => {
  it('keeps From and To side by side at the standard sizes and stacks them from AX1', () => {
    expect(datesStacked(filterScale('seventh', 1))).toBe(false);
    expect(datesStacked(AX1)).toBe(true);
  });
});
