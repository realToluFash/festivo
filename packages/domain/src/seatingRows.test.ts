import { describe, expect, it } from 'vitest';

import { rowExtent, rowSeatsOf, rowTabAt } from './seatingRows.ts';

describe('a row of seats', () => {
  it('numbers from the left of someone sitting in it, spacing apart', () => {
    expect(rowSeatsOf({ seats: 3, spacingCm: 50 })).toEqual([
      { seat: 1, x: -50, y: 0 },
      { seat: 2, x: 0, y: 0 },
      { seat: 3, x: 50, y: 0 },
    ]);
  });

  it('takes the floor of its seats and its label tab', () => {
    expect(rowExtent({ seats: 10, spacingCm: 50 })).toEqual([299, 22]);
    expect(rowExtent({ seats: 1, spacingCm: 50 })).toEqual([74, 22]);
  });

  it('puts the label just past seat 1', () => {
    expect(rowTabAt({ seats: 10, spacingCm: 50 })).toEqual([-277, 0]);
  });
});
