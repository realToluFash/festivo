import { describe, expect, it } from 'vitest';

import { type CountLineMeasure, countLineDrawn, countLineStarts } from './countSizeRules.ts';

const AX1 = 1.786;
const AX5 = 3.571;

const line = (given: Partial<CountLineMeasure>): CountLineMeasure => ({
  scale: AX5,
  cap: 43,
  room: 362,
  gap: 16,
  count: 120,
  clear: 110,
  countWidest: 90,
  clearWidest: 70,
  ...given,
});

describe('countLineDrawn', () => {
  it('keeps the count and Clear filters on one line when both fit whole beside each other', () => {
    expect(countLineDrawn(line({ count: 180, clear: 160 })).stacked).toBe(false);
  });

  it('puts Clear filters under the count once they cannot share the line', () => {
    expect(countLineDrawn(line({ count: 280, clear: 400 })).stacked).toBe(true);
  });

  it('never stacks at the standard sizes, as main', () => {
    expect(countLineDrawn(line({ scale: 1.353, cap: 34, count: 280, clear: 400 })).stacked).toBe(
      false,
    );
  });

  it('stops both at the title the page draws', () => {
    expect(countLineStarts(AX5, 43)).toEqual({ count: 43, clear: 43 });
    expect(countLineStarts(AX1, 38).count).toBeCloseTo(16 * AX1);
  });

  it('steps a word wider than its own line down, never below the default', () => {
    const drawn = countLineDrawn(line({ count: 500, clear: 400, countWidest: 430 }));

    expect(drawn.countSize).toBe(Math.floor((43 * 362) / 430));
    expect(drawn.clearSize).toBe(43);
  });

  it('steps the count down alone on its line too, with no filter set', () => {
    const drawn = countLineDrawn(line({ count: 0, clear: 0, countWidest: 430 }));

    expect(drawn.stacked).toBe(false);
    expect(drawn.countSize).toBe(Math.floor((43 * 362) / 430));
  });
});
