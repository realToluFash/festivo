import { describe, expect, it } from 'vitest';

import { phonePillAlone, pillBesideTabs } from './frameBand.ts';

describe('phonePillAlone', () => {
  it('stands alone on Home with no primary, and leaves it to the primary row otherwise', () => {
    expect(phonePillAlone(true, false, false)).toBe(true);
    expect(phonePillAlone(true, true, false)).toBe(false);
    expect(phonePillAlone(false, true, false)).toBe(false);
    expect(phonePillAlone(false, false, false)).toBe(false);
  });

  it('keeps the pill while a screen stands in, where the screen had a primary or on Home', () => {
    expect(phonePillAlone(false, true, true)).toBe(true);
    expect(phonePillAlone(true, true, true)).toBe(true);
    expect(phonePillAlone(true, false, true)).toBe(true);
    expect(phonePillAlone(false, false, true)).toBe(false);
  });
});

describe('pillBesideTabs', () => {
  it('stops the pill 12 short of the centred tabs', () => {
    expect(pillBesideTabs(1000, 470)).toEqual({ maxWidth: 253, tileAlone: false });
  });

  it('leaves the tile alone when under 120 is left, as on an upright iPad mini', () => {
    expect(pillBesideTabs(712, 470)).toEqual({ maxWidth: 109, tileAlone: true });
    expect(pillBesideTabs(480, 470)).toEqual({ maxWidth: 0, tileAlone: true });
  });

  it('caps nothing until both widths are measured', () => {
    expect(pillBesideTabs(0, 470)).toBeNull();
    expect(pillBesideTabs(1000, 0)).toBeNull();
  });
});
