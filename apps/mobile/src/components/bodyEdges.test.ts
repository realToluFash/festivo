import { describe, expect, it } from 'vitest';

import { sideInsets, tabBarSides } from './bodyEdges.ts';

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
