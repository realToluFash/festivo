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

// React Native's fontScale on iOS at the fifth through the tenth and the twelfth steps of Larger Text.
const FIFTH = 1.118;
const SIXTH = 1.235;
const SEVENTH = 1.353;
const EIGHTH = 1.786;
const NINTH = 2.143;
const TENTH = 2.643;
const TWELFTH = 3.571;

function oneWord(width: number, letters = 0): Widths {
  return { words: [{ width, letters }], whole: { width, letters } };
}

describe('the sidebar at the largest text sizes', () => {
  it('draws rows and glyphs as on main through the ninth step', () => {
    const scale = NINTH;

    expect(atLargest(scale)).toBe(false);
    expect(glyphSide(ROOMS.place, scale, 30)).toBe(18);
    expect(rowPad(scale)).toBe(0);
  });

  it('draws names as on main at the default size and below', () => {
    expect(sideTextSize(ROOMS.org, 1, oneWord(500), 'line')).toBe(15);
    expect(sideTextSize(ROOMS.cardName, 0.882, oneWord(500), 'lines')).toBe(14 * 0.882);
  });

  it.each([FIFTH, SIXTH, SEVENTH, EIGHTH])(
    'steps a one-line name down at fontScale %s until it fits its line whole',
    (scale) => {
      const start = 15 * scale;
      const name = 1.05 * ROOMS.org.inside;
      const size = sideTextSize(ROOMS.org, scale, oneWord(name), 'line');

      expect(size).toBeLessThan(start);
      expect(size).toBeGreaterThanOrEqual(15);
      expect((name / start) * size).toBeLessThanOrEqual(ROOMS.org.inside);
    },
  );

  it.each([FIFTH, SIXTH, SEVENTH, EIGHTH])(
    'steps a two-line name down at fontScale %s until its widest word fits a line',
    (scale) => {
      const start = 14 * scale;
      const widest = 1.05 * ROOMS.cardName.inside;
      const size = sideTextSize(ROOMS.cardName, scale, oneWord(widest), 'lines');

      expect(size).toBeLessThan(start);
      expect(size).toBeGreaterThanOrEqual(14);
      expect((widest / start) * size).toBeLessThanOrEqual(ROOMS.cardName.inside);
    },
  );

  function inWords(pieces: number[][], space: number): Widths {
    const words = pieces.map((word) => word.reduce((sum, piece) => sum + piece, 0));
    const whole = words.reduce((sum, word) => sum + word, 0) + space * (words.length - 1);

    return {
      words: words.map((width) => ({ width, letters: 0 })),
      whole: { width: whole, letters: 0 },
      wrap: { pieces, space },
    };
  }

  it.each([FIFTH, SIXTH, SEVENTH, EIGHTH])(
    'steps a two-line name down at fontScale %s until all its words fit two lines, not only its widest',
    (scale) => {
      const start = 14 * scale;
      const third = 0.33 * ROOMS.cardName.inside * scale;
      const widths = inWords([[third], [third], [third], [third], [third]], 0);
      const size = sideTextSize(ROOMS.cardName, scale, widths, 'lines');

      expect(size).toBeLessThan(start);
      expect(size).toBeGreaterThanOrEqual(14);
      expect((3 * third * size) / start).toBeLessThanOrEqual(ROOMS.cardName.inside);
    },
  );

  it('keeps a two-line name at its size on main while its words take two lines', () => {
    const half = 0.45 * ROOMS.cardName.inside;
    const widths = inWords([[half], [half], [half], [half]], 4);

    expect(sideTextSize(ROOMS.cardName, EIGHTH, widths, 'lines')).toBe(14 * EIGHTH);
  });

  it('breaks a two-line name after a hyphen, as the line does', () => {
    const piece = 0.3 * ROOMS.cardName.inside;
    const widths = inWords([[piece], [piece, piece, piece], [piece]], 0);

    expect(sideTextSize(ROOMS.cardName, EIGHTH, widths, 'lines')).toBe(14 * EIGHTH);
  });

  it('draws a two-line name at the default size when it still runs past two lines there', () => {
    const word = 0.9 * ROOMS.cardName.inside;
    const widths = inWords([[word], [word], [word], [word]], 4);

    expect(sideTextSize(ROOMS.cardName, EIGHTH, widths, 'lines')).toBe(14);
  });

  it('keeps a name at its size on main at the eighth step while it fits', () => {
    expect(sideTextSize(ROOMS.org, EIGHTH, oneWord(ROOMS.org.inside), 'line')).toBe(15 * EIGHTH);
  });

  it('never draws a name smaller than at the default size, even when it is still cut there', () => {
    expect(sideTextSize(ROOMS.org, EIGHTH, oneWord(5000), 'line')).toBe(15);
  });

  it('draws a name no smaller at a larger step once it fits whole', () => {
    const widthAt = (scale: number) => 7.894 * 15 * scale;
    const sizes = [FIFTH, SIXTH, SEVENTH, EIGHTH, NINTH].map((scale) =>
      sideTextSize(ROOMS.org, scale, oneWord(widthAt(scale)), 'line'),
    );

    sizes.slice(1).forEach((size, at) => expect(size).toBeGreaterThanOrEqual(sizes[at] ?? 0));
  });

  it('steps a one-line name down at the ninth step until it fits its line whole', () => {
    const scale = NINTH;
    const start = 15 * scale;
    const qaOrganisation = 1.5 * ROOMS.org.inside;
    const size = sideTextSize(ROOMS.org, scale, oneWord(qaOrganisation), 'line');

    expect(size).toBeLessThan(start);
    expect(size).toBeGreaterThanOrEqual(15);
    expect((qaOrganisation / start) * size).toBeLessThanOrEqual(ROOMS.org.inside);
  });

  it('steps a two-line name down at the ninth step until its widest word fits a line', () => {
    const scale = NINTH;
    const start = 14 * scale;
    const widest = 1.5 * ROOMS.cardName.inside;
    const size = sideTextSize(ROOMS.cardName, scale, oneWord(widest), 'lines');

    expect(size).toBeLessThan(start);
    expect(size).toBeGreaterThanOrEqual(14);
    expect((widest / start) * size).toBeLessThanOrEqual(ROOMS.cardName.inside);
  });

  it('steps an event’s name under Your events down at the ninth step until it fits its line', () => {
    const scale = NINTH;
    const start = 14 * scale;
    const name = 1.5 * ROOMS.event.inside;
    const size = sideTextSize(ROOMS.event, scale, oneWord(name), 'line');

    expect(size).toBeLessThan(start);
    expect(size).toBeGreaterThanOrEqual(14);
    expect((name / start) * size).toBeLessThanOrEqual(ROOMS.event.inside);
  });

  it('keeps a name at its size on main at the ninth step while it fits', () => {
    const scale = NINTH;

    expect(sideTextSize(ROOMS.org, scale, oneWord(ROOMS.org.inside), 'line')).toBe(15 * scale);
    expect(sideTextSize(ROOMS.cardName, scale, oneWord(ROOMS.cardName.inside), 'lines')).toBe(
      14 * scale,
    );
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
