import { describe, expect, it } from 'vitest';

import {
  HEADING_TRACKING,
  ROOMS,
  type Widths,
  atLargest,
  glyphSide,
  rowPad,
  sideStart,
  sideTextSize,
} from './sidebarSize.ts';

// React Native's fontScale on iOS at the ninth, tenth and twelfth steps of Larger Text.
const NINTH = 2.143;
const TENTH = 2.643;
const TWELFTH = 3.571;

function oneWord(width: number, letters = 0): Widths {
  return { words: [{ width, letters }], whole: { width, letters } };
}

describe('the sidebar at the largest text sizes', () => {
  it('draws rows, glyphs and names as on main through the ninth step', () => {
    const scale = NINTH;

    expect(atLargest(scale)).toBe(false);
    expect(sideTextSize(ROOMS.event, scale, oneWord(500), 'line')).toBe(14 * scale);
    expect(sideTextSize(ROOMS.cardName, scale, oneWord(500), 'lines')).toBe(14 * scale);
    expect(glyphSide(ROOMS.place, scale, 30)).toBe(18);
    expect(rowPad(scale)).toBe(0);
  });

  it('keeps a label at its size on main below the tenth step while its widest word fits beside the glyph', () => {
    const scale = NINTH;

    expect(sideTextSize(ROOMS.place, scale, oneWord(ROOMS.place.inside - 18))).toBe(14.5 * scale);
  });

  it('steps a label down alone at the ninth step where its widest word would break beside main’s glyph', () => {
    const scale = NINTH;
    const start = 14.5 * scale;
    const evenements = 183;
    const size = sideTextSize(ROOMS.place, scale, oneWord(evenements));

    expect(size).toBe(28);
    expect((evenements / start) * size + 18).toBeLessThanOrEqual(ROOMS.place.inside);
    expect(sideTextSize(ROOMS.place, 1, oneWord(5000))).toBe(14.5);
  });

  it('keeps a label at its full size from the tenth step while its word and glyph fit', () => {
    const scale = TENTH;
    const start = 14.5 * scale;

    expect(atLargest(scale)).toBe(true);
    expect(sideTextSize(ROOMS.place, scale, oneWord(60))).toBe(start);
  });

  it('steps a label down until its widest word and the glyph that grows with it fill the row', () => {
    const scale = TWELFTH;
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
    expect(sideTextSize(ROOMS.place, TWELFTH, oneWord(5000))).toBe(14.5);
  });

  it('fits a one-line name whole, not only its widest word', () => {
    const scale = TWELFTH;
    const widths = {
      words: [
        { width: 200, letters: 0 },
        { width: 150, letters: 0 },
      ],
      whole: { width: 400, letters: 0 },
    };

    expect(sideTextSize(ROOMS.org, scale, widths, 'line')).toBeLessThan(
      sideTextSize(ROOMS.org, scale, widths, 'lines'),
    );
  });

  it('steps a label with no glyph down until its widest word fills the row', () => {
    const scale = TWELFTH;
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
    const scale = TWELFTH;
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

  it('caps a text inside an event at its area’s name, never below its size on main', () => {
    expect(sideStart(ROOMS.place, 3.571, 43)).toBe(43);
    expect(sideStart(ROOMS.place, 3.571, 10)).toBe(14.5);
    expect(sideTextSize(ROOMS.place, 3.571, oneWord(10), 'label', 43)).toBe(43);
  });
});
