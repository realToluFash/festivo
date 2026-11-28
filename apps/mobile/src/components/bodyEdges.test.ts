import { describe, expect, it } from 'vitest';

import { coverRowSides, sideInsets, sidePadding, tabBarFit, tabWidth } from './bodyEdges.ts';

const BARS = { left: 48, right: 48 };

describe('sideInsets', () => {
  it('clears a navigation bar on either side of a phone on its side (sc-52423)', () => {
    expect(sideInsets('phone', BARS)).toEqual({ paddingLeft: 48, paddingRight: 48 });
  });

  it('leaves the left of a tablet on its side to the sidebar', () => {
    expect(sideInsets('tabletLandscape', BARS)).toEqual({ paddingLeft: 0, paddingRight: 48 });
  });
});

describe('tabBarFit', () => {
  const upright = { left: 0, right: 0 };
  const main = { paddingHorizontal: 5, paddingVertical: 5, gap: 2 };

  it('keeps the tab bar 18 in from each side from 360 up, exactly 360 included', () => {
    expect(tabBarFit(360, upright)).toEqual({ left: 18, right: 18, ...main });
    expect(tabBarFit(402, upright)).toEqual({ left: 18, right: 18, ...main });
  });

  it('sits 8 from each side with 3 padding and no gap under 360 (sc-99214)', () => {
    const narrow = { left: 8, right: 8, paddingHorizontal: 3, paddingVertical: 5, gap: 0 };

    expect(tabBarFit(320, upright)).toEqual(narrow);
    expect(tabBarFit(359.5, upright)).toEqual(narrow);
  });

  it('moves its ends past a navigation bar on either side of a phone on its side (sc-54891)', () => {
    expect(tabBarFit(874, { left: 48, right: 0 })).toEqual({ left: 66, right: 18, ...main });
    expect(tabBarFit(874, { left: 0, right: 48 })).toEqual({ left: 18, right: 66, ...main });
  });
});

describe('tabWidth', () => {
  const upright = { left: 0, right: 0 };

  it('gives the demo’s tabs at 320dp: 74 for four, 59.2 for five (sc-99214)', () => {
    expect(tabWidth(320, upright, 4, 1)).toBe(74);
    expect(tabWidth(320, upright, 5, 5)).toBe(59.2);
  });

  it('rounds down to a whole pixel, and takes the insets and gaps from the same bar', () => {
    expect(tabWidth(320, upright, 5, 2)).toBe(59);
    expect(tabWidth(874, { left: 48, right: 0 }, 5, 1)).toBe(154);
  });
});

describe('coverRowSides', () => {
  it("keeps Today's top row 16 in from each side of an upright phone", () => {
    expect(coverRowSides({ left: 0, right: 0 })).toEqual({ paddingLeft: 16, paddingRight: 16 });
  });

  it("moves it to Events' 20 past a navigation bar on either side (sc-62018)", () => {
    expect(coverRowSides({ left: 48, right: 0 })).toEqual({ paddingLeft: 68, paddingRight: 20 });
    expect(coverRowSides({ left: 0, right: 48 })).toEqual({ paddingLeft: 20, paddingRight: 68 });
  });

  it("runs 82 in from each long edge of an iPhone 17 Pro on its side, as Events' does (sc-62018)", () => {
    expect(coverRowSides({ left: 62, right: 62 })).toEqual({ paddingLeft: 82, paddingRight: 82 });
  });
});

describe('sidePadding', () => {
  it('adds the bar on each side to the margin', () => {
    expect(sidePadding(20, { left: 48, right: 0 })).toEqual({ paddingLeft: 68, paddingRight: 20 });
  });
});
