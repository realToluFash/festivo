import { describe, expect, it } from 'vitest';

import { reachableOffset } from './reachableOffset.ts';

describe('reachableOffset', () => {
  it('reaches where it was left when the items are as tall as they were', () => {
    expect(reachableOffset(420, 1200, 600)).toBe(420);
  });

  it('stops at the foot when a changed pick has made the items shorter', () => {
    expect(reachableOffset(420, 900, 600)).toBe(300);
  });

  it('stays at the top while a level shorter than its panel is still laid out', () => {
    expect(reachableOffset(420, 380, 380)).toBe(0);
  });
});
