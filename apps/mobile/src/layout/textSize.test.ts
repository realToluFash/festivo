import { describe, expect, it } from 'vitest';

import {
  backLabelSize,
  breakableEmail,
  drawnLine,
  fitWidest,
  nameLines,
  railWidth,
  rowsFloor,
  sideListWidth,
  titleSize,
  wordsIn,
} from './textSize.ts';

const AX1 = 1.786;
const AX2 = 2.143;

describe('titleSize', () => {
  it.each([
    [28, 1, 28],
    [28, 1.353, 28 * 1.353],
    [28, AX1, 38],
    [28, AX2, 43],
    [26, AX2, 43],
    [20, AX1, 31],
    [20, AX2, 37],
    [28, 2, 43],
  ])('draws a %s title at scale %s at %s', (size, scale, drawn) => {
    expect(titleSize(size, scale)).toBeCloseTo(drawn);
  });

  it('never draws a title smaller than at the default size', () => {
    for (const size of [20, 26, 28]) {
      expect(titleSize(size, AX2)).toBeGreaterThan(size);
    }
  });
});

describe('backLabelSize', () => {
  it.each([
    [1, 15],
    [1.5, 22.5],
    [2, 30],
  ])('grows with the text at %s', (fontScale, size) => {
    expect(backLabelSize(fontScale)).toBe(size);
  });

  it('stops at twice its default, so the top two iOS steps draw it alike (sc-23361)', () => {
    expect(backLabelSize(AX1)).toBe(15 * AX1);
    expect(backLabelSize(AX2)).toBe(30);
    expect(backLabelSize(3)).toBe(30);
  });
});

describe('wordsIn', () => {
  it('lists each word once, across the texts', () => {
    expect(wordsIn(['Revenir sans votre', 'sans  application '])).toEqual([
      'Revenir',
      'sans',
      'votre',
      'application',
    ]);
  });
});

describe('fitWidest', () => {
  it('keeps the start when the widest word fits its slot', () => {
    expect(fitWidest(12, 25.7, 110, 118)).toBe(25.7);
  });

  it('steps down in proportion, to a whole point, so the widest word fits', () => {
    expect(fitWidest(12, 25.7, 150, 118)).toBe(20);
  });

  it('never steps below the default size', () => {
    expect(fitWidest(12, 25.7, 400, 118)).toBe(12);
  });
});

it('lets a name in the frame take two lines only at the accessibility sizes', () => {
  expect(nameLines(1.353)).toBe(1);
  expect(nameLines(AX1)).toBe(2);
});

describe('widths', () => {
  it('widens the rail only at the accessibility sizes', () => {
    expect(railWidth(1.353)).toBe(220);
    expect(railWidth(AX1)).toBe(300);
  });

  it('gives a side list 40 percent of the content, never under its own width', () => {
    expect(sideListWidth(320, 834, 1)).toBe(320);
    expect(sideListWidth(320, 834, AX1)).toBe(334);
    expect(sideListWidth(236, 980, AX2)).toBe(392);
    expect(sideListWidth(320, 700, AX2)).toBe(320);
  });
});

describe('breakableEmail', () => {
  it('lets the line break after the @ and nowhere new', () => {
    expect(breakableEmail('camille.moreau@traiteur-lumiere.fr')).toBe(
      'camille.moreau@​traiteur-lumiere.fr',
    );
  });
});

describe('drawnLine', () => {
  it('keeps the fraction on iOS', () => {
    expect(drawnLine(18.85, 1.2, null)).toBeCloseTo(22.62);
  });

  it.each([
    [18.85, 1, 2.625, 50],
    [19.5, 1, 2.625, 52],
    [18.85, 1, 3, 57],
    [19.5, 1.3, 3, 77],
  ])(
    'rounds a %s line at scale %s up to a whole pixel at density %s: %s px',
    (height, scale, density, pixels) => {
      expect(drawnLine(height, scale, density) * density).toBeCloseTo(pixels);
    },
  );
});

describe('rowsFloor', () => {
  // Two rows of a date, a title and an owner pill with its padding, the gaps and padding of each row, and the divider between them.
  const twoRows = (small: number, title: number) =>
    (small * 2 + title + 10 * 2 + 4 * 2 + 4 * 2) * 2 + 1;

  it('is the height of two rows on iOS', () => {
    expect(rowsFloor(1, null)).toBeCloseTo(twoRows(18.85, 19.5));
    expect(rowsFloor(1.5, null)).toBeCloseTo(twoRows(18.85 * 1.5, 19.5 * 1.5));
  });

  it.each([2.625, 3])(
    'is the height of two rows as Android draws them at density %s',
    (density) => {
      expect(rowsFloor(1, density)).toBeCloseTo(
        twoRows(Math.ceil(18.85 * density) / density, Math.ceil(19.5 * density) / density),
      );
      expect(rowsFloor(1, density)).toBeGreaterThan(rowsFloor(1, null));
    },
  );
});
