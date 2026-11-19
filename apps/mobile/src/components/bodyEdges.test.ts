import { describe, expect, it } from 'vitest';

import { coverRowSides, sideInsets, sidePadding, tabBarSides } from './bodyEdges.ts';

const BARS = { left: 48, right: 48 };

describe('sideInsets', () => {
  it('clears a navigation bar on either side of a phone on its side (sc-52423)', () => {
    expect(sideInsets('phone', BARS)).toEqual({ paddingLeft: 48, paddingRight: 48 });
  });

  it('leaves the left of a tablet on its side to the sidebar', () => {
    expect(sideInsets('tabletLandscape', BARS)).toEqual({ paddingLeft: 0, paddingRight: 48 });
  });
});

describe('tabBarSides', () => {
  it('keeps the tab bar 18 in from each side of an upright phone', () => {
    expect(tabBarSides({ left: 0, right: 0 })).toEqual({ left: 18, right: 18 });
  });

  it('moves its ends past a navigation bar on either side of a phone on its side (sc-54891)', () => {
    expect(tabBarSides({ left: 48, right: 0 })).toEqual({ left: 66, right: 18 });
    expect(tabBarSides({ left: 0, right: 48 })).toEqual({ left: 18, right: 66 });
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
