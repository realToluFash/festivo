import { describe, expect, it } from 'vitest';

import {
  HEADING_TRACKING,
  ROOMS,
  type Widths,
  atLargest,
  glyphSide,
  rowPad,
  sidebarAtOf,
  sidebarScale,
  sidebarSizeOf,
  sideTextSize,
} from './sidebarSizeRules.ts';

function oneWord(width: number, letters = 0): Widths {
  return { words: [{ width, letters }], whole: { width, letters } };
}

describe('the sidebar at the largest text sizes', () => {
  it('draws as on main through the ninth step', () => {
    const scale = sidebarScale('ninth', 1);

    expect(atLargest(scale)).toBe(false);
    expect(sideTextSize(ROOMS.place, scale, oneWord(500))).toBe(14.5 * scale);
    expect(glyphSide(ROOMS.place, scale, 30)).toBe(18);
    expect(rowPad(scale)).toBe(0);
  });

  it('keeps a label at its full size from the tenth step while its word and glyph fit', () => {
    const scale = sidebarScale('tenth', 1);
    const start = 14.5 * scale;

    expect(atLargest(scale)).toBe(true);
    expect(sideTextSize(ROOMS.place, scale, oneWord(60))).toBe(start);
  });

  it('steps a label down until its widest word and the glyph that grows with it fill the row', () => {
    const scale = sidebarScale('twelfth', 1);
    const start = 14.5 * scale;
    const widest = 6 * start;
    const size = sideTextSize(ROOMS.place, scale, oneWord(widest));

    expect(size).toBeLessThan(start);
    expect(size).toBeGreaterThan(14.5);
    expect((widest / start) * size + glyphSide(ROOMS.place, scale, size)).toBeLessThanOrEqual(
      ROOMS.place.inside,
    );
  });

  it('never draws a label below its size on main', () => {
    expect(sideTextSize(ROOMS.place, sidebarScale('twelfth', 1), oneWord(5000))).toBe(14.5);
  });

  it('fits a one-line name whole, not only its widest word', () => {
    const scale = sidebarScale('twelfth', 1);
    const widths = {
      words: [
        { width: 200, letters: 0 },
        { width: 150, letters: 0 },
      ],
      whole: { width: 400, letters: 0 },
    };

    expect(sideTextSize(ROOMS.org, scale, widths, true)).toBeLessThan(
      sideTextSize(ROOMS.org, scale, widths),
    );
  });

  it('steps a label with no glyph down until its widest word fills the row', () => {
    const scale = sidebarScale('twelfth', 1);
    const start = 12 * scale;
    const widest = 2 * ROOMS.role.inside;
    const size = sideTextSize(ROOMS.role, scale, {
      words: [
        { width: widest, letters: 0 },
        { width: widest / 2, letters: 0 },
      ],
      whole: { width: 1.5 * widest, letters: 0 },
    });

    expect(size).toBeLessThan(start);
    expect((widest / start) * size).toBeLessThanOrEqual(ROOMS.role.inside);
  });

  it('keeps the tracking of a heading in its room, which stays the same as the size steps down', () => {
    const scale = sidebarScale('twelfth', 1);
    const start = ROOMS.heading.size * scale;
    const letters = 'ÉVÉNEMENTS'.length;
    const width = 1.5 * ROOMS.heading.inside;
    const size = sideTextSize(ROOMS.heading, scale, {
      words: [
        { width: 0.3 * width, letters: 3 },
        { width, letters },
      ],
      whole: { width: 1.3 * width, letters: 14 },
    });

    expect(size).toBeLessThan(sideTextSize(ROOMS.heading, scale, oneWord(width)));
    expect((width / start) * size + letters * HEADING_TRACKING).toBeLessThanOrEqual(
      ROOMS.heading.inside,
    );
  });

  it('opens on This iPad and Members when the link names neither', () => {
    expect(sidebarSizeOf(undefined)).toBe('device');
    expect(sidebarScale('device', 1.4)).toBe(1.4);
    expect(sidebarAtOf('nowhere')).toBe('members');
  });
});
