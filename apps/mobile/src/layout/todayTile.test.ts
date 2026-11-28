import { describe, expect, it } from 'vitest';

import { TILE, tileWidth } from './todayTile.ts';

describe('tileWidth', () => {
  it('keeps main’s tile below AX1', () => {
    expect(tileWidth(1, 402)).toBe(TILE);
    expect(tileWidth(1.35, 402)).toBe(TILE);
  });

  it('widens to 322 on an iPhone 17 Pro from AX1', () => {
    expect(tileWidth(3.12, 402)).toBe(322);
  });

  it('never narrows below main’s tile', () => {
    expect(tileWidth(3.12, 300)).toBe(TILE);
  });
});
