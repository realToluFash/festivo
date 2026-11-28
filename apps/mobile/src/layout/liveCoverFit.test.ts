import { describe, expect, it } from 'vitest';

import { dayChipRoom, liveChipRoom, openRoom } from './liveCoverFit.ts';

describe('the live cover’s words on its side (sc-92312)', () => {
  it('gives each chip and the button the 13-inch column less what each draws beside its words', () => {
    expect(liveChipRoom(1008)).toBe(1008 - 24 - 14 - 6);
    expect(dayChipRoom(1008)).toBe(1008 - 24);
    expect(openRoom(1008)).toBe(1008 - 44 - 8 - 18);
  });

  it('never gives a negative room before the column is laid out', () => {
    expect(liveChipRoom(0)).toBe(0);
    expect(dayChipRoom(0)).toBe(0);
    expect(openRoom(0)).toBe(0);
  });
});
