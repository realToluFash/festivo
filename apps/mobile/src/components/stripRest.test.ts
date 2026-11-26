import { describe, expect, it } from 'vitest';

import { stripRest } from './stripRest.ts';

describe('stripRest', () => {
  it('rests at the start while the chosen pill ends 24 pt or more inside the strip', () => {
    expect(stripRest(300, 700, 1400)).toBe(0);
    expect(stripRest(676, 700, 1400)).toBe(0);
  });

  it('moves just far enough to show a pill past that, its end 24 pt from the right edge', () => {
    expect(stripRest(677, 700, 1400)).toBe(1);
    expect(stripRest(1000, 700, 1400)).toBe(324);
  });

  it('never moves past the strip end, for the last pill', () => {
    expect(stripRest(1390, 700, 1400)).toBe(700);
  });
});
