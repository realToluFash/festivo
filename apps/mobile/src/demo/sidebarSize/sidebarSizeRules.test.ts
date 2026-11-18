import { describe, expect, it } from 'vitest';

import {
  ROOMS,
  atLargest,
  glyphSide,
  rowPad,
  sidebarAtOf,
  sidebarScale,
  sidebarSizeOf,
  sideTextSize,
} from './sidebarSizeRules.ts';

describe('the sidebar at the largest text sizes', () => {
  it('draws as on main through the ninth step', () => {
    const scale = sidebarScale('ninth', 1);

    expect(atLargest(scale)).toBe(false);
    expect(sideTextSize(ROOMS.place, scale, { widest: 500, whole: 500 })).toBe(14.5 * scale);
    expect(glyphSide(ROOMS.place, scale, 30)).toBe(18);
    expect(rowPad(scale)).toBe(0);
  });

  it('keeps a label at its full size from the tenth step while its word and glyph fit', () => {
    const scale = sidebarScale('tenth', 1);
    const start = 14.5 * scale;

    expect(atLargest(scale)).toBe(true);
    expect(sideTextSize(ROOMS.place, scale, { widest: 60, whole: 60 })).toBe(start);
  });

  it('steps a label down until its widest word and the glyph that grows with it fill the row', () => {
    const scale = sidebarScale('twelfth', 1);
    const start = 14.5 * scale;
    const widest = 6 * start;
    const size = sideTextSize(ROOMS.place, scale, { widest, whole: widest });

    expect(size).toBeLessThan(start);
    expect(size).toBeGreaterThan(14.5);
    expect((widest / start) * size + glyphSide(ROOMS.place, scale, size)).toBeLessThanOrEqual(
      ROOMS.place.inside,
    );
  });

  it('never draws a label below its size on main', () => {
    expect(
      sideTextSize(ROOMS.place, sidebarScale('twelfth', 1), { widest: 5000, whole: 5000 }),
    ).toBe(14.5);
  });

  it('fits a one-line name whole, not only its widest word', () => {
    const scale = sidebarScale('twelfth', 1);
    const widths = { widest: 200, whole: 400 };

    expect(sideTextSize(ROOMS.org, scale, widths, true)).toBeLessThan(
      sideTextSize(ROOMS.org, scale, widths),
    );
  });

  it('opens on This iPad and Members when the link names neither', () => {
    expect(sidebarSizeOf(undefined)).toBe('device');
    expect(sidebarScale('device', 1.4)).toBe(1.4);
    expect(sidebarAtOf('nowhere')).toBe('members');
  });
});
