import { describe, expect, it } from 'vitest';

import {
  bandPlace,
  breakableEmail,
  capChipInDisc,
  capInDisc,
  capUnderTitle,
  drawnLine,
  besideGlyph,
  fitWidest,
  grownPad,
  labelStart,
  lineStart,
  LABEL_LINE,
  frameTitleSize,
  nameLines,
  paddingToCentre,
  pasteHeight,
  rowsFloor,
  sideListWidth,
  TITLE_LINE,
  piecesIn,
  titleSize,
  wordsIn,
  wordsRoomKey,
  wordsSlot,
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

describe('capInDisc', () => {
  it('never lets initials draw past half the disc, at any scale (sc-37693)', () => {
    for (const [side, size] of [
      [40, 14],
      [34, 12],
      [34, 13],
      [56, 20],
    ] as const) {
      for (const scale of [1, AX1, AX2, 3.1]) {
        expect(size * Math.min(scale, capInDisc(side, size))).toBeLessThanOrEqual(side * 0.5);
      }
    }
  });

  it("lets a 40 disc's initials grow to 20", () => {
    expect(14 * capInDisc(40, 14)).toBeCloseTo(20);
  });

  it('never asks for less than the default size', () => {
    expect(capInDisc(20, 12)).toBe(1);
  });
});

describe('capChipInDisc', () => {
  it.each([1, 2, 3])(
    'keeps a chip of %i characters inside a 34 disc at every scale (sc-37693)',
    (characters) => {
      for (const scale of [1, AX1, AX2, 3.1]) {
        const drawn = 13 * Math.min(scale, capChipInDisc(34, 13, characters));

        expect(drawn * characters * 0.62).toBeLessThan(34 * 0.8 + 0.01);
        expect(drawn).toBeLessThanOrEqual(34 * 0.5);
      }
    },
  );

  it('lets +5 grow as far as its height allows', () => {
    expect(capChipInDisc(34, 13, 2)).toBe(capInDisc(34, 13));
  });

  it('holds 99+ under what its height alone would allow', () => {
    expect(capChipInDisc(34, 13, 3)).toBeLessThan(capInDisc(34, 13));
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

describe('piecesIn', () => {
  it('splits a word after the hyphen it already has, keeping the hyphen on the first part', () => {
    expect(piecesIn(['Password, two-factor, signed-in devices'])).toEqual([
      'Password,',
      'two-',
      'factor,',
      'signed-',
      'in',
      'devices',
    ]);
  });

  it('keeps a word with no hyphen whole, and lists each piece once across the texts', () => {
    expect(piecesIn(['Notifications', 'e-mail Notifications'])).toEqual([
      'Notifications',
      'e-',
      'mail',
    ]);
  });
});

describe('labelStart', () => {
  it('grows a title to the cap and no further', () => {
    expect(labelStart(16, 3.571, 43)).toBe(43);
  });

  it('keeps main’s size below the cap', () => {
    expect(labelStart(16, 1, 34)).toBe(16);
    expect(labelStart(16, 2.143, 43)).toBeCloseTo(34.29, 2);
  });
});

describe('lineStart', () => {
  it('starts the line no larger than its title draws', () => {
    expect(lineStart(13.5, 3.571, 43, 35)).toBe(35);
  });

  it('starts the line at the cap when its title draws at the cap', () => {
    expect(lineStart(13.5, 3.571, 43, 43)).toBe(43);
  });

  it('keeps main’s line at the default size', () => {
    expect(lineStart(13.5, 1, 34, 16)).toBe(13.5);
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

describe('besideGlyph, Sign out at the foot of Settings (sc-66900)', () => {
  // The iPhone 17 Pro's page, 402 less 20 a side, less the pill's 20 and 1.5 ring a side and the 8 beside the glyph.
  const inside = 362 - 2 * (20 + 1.5) - 8;
  const glyph = 18 / 16;

  it('keeps the label at 16 at the default size', () => {
    expect(besideGlyph(16, 16, 40, glyph, inside)).toBe(16);
  });

  it('keeps Sign at its full size, about 50, at the twelfth step', () => {
    expect(besideGlyph(16, 49.92, 100, glyph, inside)).toBeCloseTo(49.92, 2);
  });

  it('steps déconnecter down to 44, so it fits whole beside the glyph, at the twelfth step', () => {
    expect(besideGlyph(16, 49.92, 290, glyph, inside)).toBe(44);
  });

  it('never draws the label under the default size', () => {
    expect(besideGlyph(16, 49.92, 2000, glyph, inside)).toBe(16);
  });
});

describe('grownPad, the room above and below Sign out’s words (sc-66900)', () => {
  it('keeps main’s 44 on a tablet on its side at the default size', () => {
    expect(2 * grownPad(44, 15, 1.5) + 2 * 1.5 + 15 * LABEL_LINE).toBeCloseTo(44, 5);
  });

  it('keeps 12 on a phone, where the words and 12 stay under 52', () => {
    expect(grownPad(52, 16, 1.5)).toBe(12);
  });
});

it('lets a name in the frame take two lines only at the accessibility sizes', () => {
  expect(nameLines(1.353)).toBe(1);
  expect(nameLines(AX1)).toBe(2);
});

describe('widths', () => {
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

describe('the width labels have to fit (sc-37298)', () => {
  it('keeps a container’s reported width when only the text size changes', () => {
    const reported = { windowWidth: 360, width: 76 };

    expect(wordsSlot({ wrapped: null, kept: null, reported }, 12, 360)).toBe(76);
    expect(wordsSlot({ wrapped: null, kept: null, reported }, 20, 360)).toBe(76);
  });

  it('forgets a reported width once the window changes width', () => {
    const reported = { windowWidth: 360, width: 76 };

    expect(wordsSlot({ wrapped: null, kept: null, reported }, 20, 412)).toBe(0);
  });

  it('keeps a wrapped text’s width only for the start it wrapped at', () => {
    const kept = { key: '20|360', width: 120 };

    expect(wordsSlot({ wrapped: null, kept, reported: null }, 20, 360)).toBe(120);
    expect(wordsSlot({ wrapped: null, kept, reported: null }, 24, 360)).toBe(0);
  });

  it('forgets a wrapped text’s width once its container reports a new room (sc-69816)', () => {
    const kept = { key: wordsRoomKey(43, 402), width: 129 };
    const reported = { windowWidth: 402, width: 238 };

    expect(wordsSlot({ wrapped: null, kept, reported }, 43, 402, 238)).toBe(238);
    expect(fitWidest(16, 43, 171, wordsSlot({ wrapped: null, kept, reported }, 43, 402, 238))).toBe(
      43,
    );
  });

  it('keeps a wrapped text’s width while its container’s room is the same (sc-69816)', () => {
    const kept = { key: wordsRoomKey(43, 402, 238), width: 236 };
    const reported = { windowWidth: 402, width: 238 };

    expect(wordsSlot({ wrapped: null, kept, reported }, 43, 402, 238)).toBe(236);
  });

  it('takes the width a text wrapped at over anything kept', () => {
    const kept = { key: '20|360', width: 120 };

    expect(
      wordsSlot({ wrapped: 90, kept, reported: { windowWidth: 360, width: 76 } }, 20, 360),
    ).toBe(90);
  });

  it('steps the bar’s labels below the cap after a live change with no new layout', () => {
    const tab = 76;
    const reported = { windowWidth: 360, width: tab };
    const widestAt = (start: number) => (start / 12) * 60;

    expect(wordsSlot({ wrapped: null, kept: null, reported }, 20, 360)).toBeGreaterThan(0);

    const before = fitWidest(
      12,
      12,
      widestAt(12),
      wordsSlot({ wrapped: null, kept: null, reported }, 12, 360),
    );
    const after = fitWidest(
      12,
      20,
      widestAt(20),
      wordsSlot({ wrapped: null, kept: null, reported }, 20, 360),
    );

    expect(before / 12).toBe(1);
    expect(after / 12).toBeLessThan(20 / 12);
  });
});

describe('pasteHeight', () => {
  it('keeps the field height up to xxxL', () => {
    expect(pasteHeight(45, 1)).toBe(45);
    expect(pasteHeight(45, 1.353)).toBe(45);
  });

  it('grows past the word Apple draws at the accessibility sizes', () => {
    expect(pasteHeight(45, AX1)).toBeGreaterThan(17 * AX1 * 1.2 + 14);
    expect(pasteHeight(45, 3.12)).toBeGreaterThan(17 * 3.12 * 1.2 + 14);
  });
});
