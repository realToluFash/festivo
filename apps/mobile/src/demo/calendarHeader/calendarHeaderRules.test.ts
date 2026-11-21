import { describe, expect, it } from 'vitest';

import { subscribeSize, subscribeUnder, underStart } from './calendarHeaderRules.ts';

const AX1 = 1.786;
const AX5 = 3.571;
const SEVENTH = 1.353;

describe('subscribeUnder', () => {
  it('keeps Subscribe on the title’s row at the standard sizes', () => {
    expect(subscribeUnder(1)).toBe(false);
    expect(subscribeUnder(SEVENTH)).toBe(false);
  });

  it('moves it under the title from AX1 to AX5', () => {
    expect(subscribeUnder(AX1)).toBe(true);
    expect(subscribeUnder(AX5)).toBe(true);
  });
});

describe('underStart', () => {
  it('grows with the text at the standard sizes, as on main', () => {
    expect(underStart(15, SEVENTH, 40.59)).toBeCloseTo(15 * SEVENTH);
  });

  it('stops at the title’s size from AX1', () => {
    expect(underStart(15, AX1, 38)).toBeCloseTo(15 * AX1);
    expect(underStart(15, AX5, 43)).toBe(43);
  });
});

describe('subscribeSize', () => {
  it('keeps its start while the widest word fits beside the glyph', () => {
    expect(subscribeSize(AX5, 43, 250, 700)).toBe(43);
  });

  it('steps down until the widest word fits, never under 15', () => {
    const size = subscribeSize(AX5, 43, 250, 300);

    expect(size).toBeLessThan(43);
    expect(size).toBeGreaterThanOrEqual(15);
    expect(subscribeSize(AX5, 43, 250, 60)).toBe(15);
  });
});
