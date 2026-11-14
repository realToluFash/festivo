import { describe, expect, it } from 'vitest';

import { APPLE_ANDROID, appleIosWeight, drawnWeight, MAP_ROWS } from './BoldTextModel.ts';

describe('the map, one step and capped at Bold', () => {
  it.each([
    [400, 600],
    [500, 600],
    [600, 700],
    [700, 700],
  ] as const)('with Bold text on, %i is drawn at %i', (asked, drawn) => {
    expect(drawnWeight(asked, true)).toBe(drawn);
  });

  it('leaves every weight where it is with Bold text off', () => {
    for (const asked of [400, 500, 600, 700] as const) {
      expect(drawnWeight(asked, false)).toBe(asked);
    }
  });

  it('keeps a line one step under its title', () => {
    expect(drawnWeight(500, true)).toBeLessThan(drawnWeight(600, true));
  });

  it('says headings are the only weight left where it was', () => {
    expect(MAP_ROWS.filter((row) => row.on.endsWith('unchanged')).map((row) => row.asked)).toEqual([
      700,
    ]);
  });
});

describe("Apple's words", () => {
  it('go from Medium to Bold in the system font on the iPhone', () => {
    expect(appleIosWeight(false)).toBe('medium');
    expect(appleIosWeight(true)).toBe('bold');
  });

  it('take the map on Android, asked for at 500', () => {
    expect(APPLE_ANDROID.offWeight).toBe(500);
    expect(APPLE_ANDROID.onWeight).toBe(600);
  });
});
