import { describe, expect, it } from 'vitest';

import {
  backLabelSize,
  bandPlace,
  breakableEmail,
  capUnderTitle,
  drawnLine,
  fitWidest,
  frameTitleSize,
  nameLines,
  paddingToCentre,
  railWidth,
  rowsFloor,
  sideListWidth,
  TITLE_LINE,
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
    for (const size of [20, 26, 28, 30, 34]) {
      expect(titleSize(size, AX2)).toBeGreaterThan(size);
    }
  });
});

describe('capUnderTitle', () => {
  // A size drawn under a multiplier, as React Native draws it.
  const drawn = (size: number, scale: number, multiplier: number) =>
    size * Math.min(scale, multiplier);

  it('never lets the words under a title draw larger than it, at any scale (sc-28812)', () => {
    for (const scale of [1, 1.353, AX1, AX2, 3.1]) {
      // Sign in's title, at its own size and stepped down to its default by a long word.
      for (const title of [titleSize(26, scale), 26]) {
        for (const size of [13, 14, 15, 16, 17, 20]) {
          expect(drawn(size, scale, capUnderTitle(title, size))).toBeLessThanOrEqual(title);
        }
      }
    }
  });

  it('keeps a smaller multiplier the text already had', () => {
    expect(capUnderTitle(43, 15, 2)).toBe(2);
    expect(capUnderTitle(43, 15)).toBeCloseTo(43 / 15);
  });

  it('never asks for less than the default size', () => {
    expect(capUnderTitle(26, 28)).toBe(1);
  });
});

describe('frameTitleSize', () => {
  it.each([
    [false, 402, 34],
    [false, 390, 34],
    [false, 375, 30],
    [true, 834, 30],
  ])('on a tablet %s, %s across, draws the title at %s', (tablet, side, size) => {
    expect(frameTitleSize(tablet, side)).toBe(size);
  });

  it('draws it at 43 on a phone at the largest text', () => {
    expect(titleSize(frameTitleSize(false, 402), AX2)).toBe(43);
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

describe('paddingToCentre', () => {
  // The offline band's words on 15/600's line beside a 48 pt Try again, at iOS's default, eighth and ninth steps (sc-27142).
  it.each([
    [1, 14.25],
    [1.79, 6.59],
    [2.14, 3.14],
    [0.82, 16.01],
  ])('pads a title line at scale %s by %s', (scale, padding) => {
    expect(paddingToCentre(48, drawnLine(TITLE_LINE, scale, null))).toBeCloseTo(padding, 1);
  });

  it('puts the middle of the first line at the middle of the row', () => {
    const line = drawnLine(TITLE_LINE, 1.79, null);
    expect(paddingToCentre(48, line) + line / 2).toBeCloseTo(24);
  });

  it('pads nothing once the line is taller than the row', () => {
    expect(paddingToCentre(48, drawnLine(TITLE_LINE, 3.1, null))).toBe(0);
  });
});

describe('bandPlace', () => {
  const PRO = { band: 402, sidePadding: 16 };
  const tryAgainLeaving = (room: number) => 370 - 18 - 10 - 16 - 34 - room;

  // The widest word and the room beside Try again on the iPhone 17 Pro, from ux's sums (sc-27686).
  it.each([
    ['en at the ninth step', 100, 164, true],
    ['es at the eighth step', 145, 168, true],
    ['es at the ninth step', 174, 143, false],
    ['pt at the eighth step', 137, 77, false],
    ['pt at the ninth step', 164, 34, false],
    ['"Wednesday," at the ninth step', 186, 164, false],
    ['"dimanche" at the ninth step', 152, 148, false],
    ['"segunda-feira," at the seventh step', 139, 129, false],
  ])('places %s', (_, widestWord, room, beside) => {
    expect(bandPlace({ ...PRO, widestWord, tryAgain: tryAgainLeaving(room) }).beside).toBe(beside);
  });

  it('keeps a word exactly as wide as the room beside', () => {
    expect(bandPlace({ ...PRO, widestWord: 100, tryAgain: tryAgainLeaving(100) }).beside).toBe(
      true,
    );
  });

  it('takes the room from the band it is given, not the window', () => {
    const asked = { widestWord: 164, tryAgain: 258, sidePadding: 24 };

    expect(bandPlace({ ...asked, band: 402 }).beside).toBe(false);
    expect(bandPlace({ ...asked, band: 894 }).beside).toBe(true);
  });

  it('wraps the pill only once it is wider than the inner width', () => {
    expect(bandPlace({ ...PRO, widestWord: 164, tryAgain: 336 }).pillWraps).toBe(false);
    expect(bandPlace({ ...PRO, widestWord: 164, tryAgain: 337 }).pillWraps).toBe(true);
  });
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
