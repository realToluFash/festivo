import { describe, expect, it } from 'vitest';

import { sideInsets } from './bodyEdges.ts';

const BARS = { left: 48, right: 48 };

describe('sideInsets', () => {
  it('clears a navigation bar on either side of a phone on its side (sc-52423)', () => {
    expect(sideInsets('phone', BARS)).toEqual({ paddingLeft: 48, paddingRight: 48 });
  });

  it('leaves the left of a tablet on its side to the sidebar', () => {
    expect(sideInsets('tabletLandscape', BARS)).toEqual({ paddingLeft: 0, paddingRight: 48 });
  });
});
