import { describe, expect, it } from 'vitest';

import {
  BELL_LANGUAGES,
  BESIDE_GAP,
  EMPTY_GAP,
  EMPTY_SENTENCE,
  EMPTY_TILE,
  emptySentenceSize,
  emptyStart,
  emptyTileAbove,
  MARK_ALL,
  markAllSize,
  markAllStart,
  markAllUnder,
  PHONE_TITLE,
  phoneTitleSize,
  SETTINGS_LINK,
  settingsSize,
  settingsStart,
} from './bellSizeRules.ts';

const DEFAULT = 1;
const SEVENTH = 1.353;
const AX2 = 2.143;
const AX5 = 3.571;
// The panel's 380 less its 16 on each side.
const ROOM = 348;

describe('the iPad bell panel’s top at the accessibility sizes (sc-92580)', () => {
  it('grows Mark all read as main does, with no cap', () => {
    expect(markAllStart(DEFAULT)).toBe(MARK_ALL);
    expect(markAllStart(AX2)).toBeCloseTo(MARK_ALL * AX2);
  });

  it('steps Mark all read down only for its widest word, never under 15', () => {
    expect(markAllSize(AX5, 170, ROOM)).toBeCloseTo(MARK_ALL * AX5);
    expect(markAllSize(AX5, 5000, ROOM)).toBe(MARK_ALL);
  });

  it('never steps Mark all read below AX1, where main draws it', () => {
    expect(markAllSize(SEVENTH, 5000, ROOM)).toBeCloseTo(MARK_ALL * SEVENTH);
  });

  it('keeps Mark all read beside the heading only where both fit whole on one row', () => {
    expect(markAllUnder({ room: ROOM, heading: 120, markAll: 100 })).toBe(false);
    expect(markAllUnder({ room: ROOM, heading: 200, markAll: ROOM - 200 - BESIDE_GAP })).toBe(
      false,
    );
    expect(markAllUnder({ room: ROOM, heading: 200, markAll: ROOM - 200 - BESIDE_GAP + 1 })).toBe(
      true,
    );
  });

  it('decides nothing until all three are measured', () => {
    expect(markAllUnder({ room: 0, heading: 300, markAll: 300 })).toBe(false);
    expect(markAllUnder({ room: ROOM, heading: 0, markAll: 300 })).toBe(false);
  });

  it('draws all four languages', () => {
    expect(BELL_LANGUAGES.map((one) => one.key)).toEqual(['en', 'es', 'fr', 'pt']);
  });
});

describe('the phone bell screen’s title at the accessibility sizes (sc-92959)', () => {
  // The page's 402 less its 24 on each side.
  const PAGE = 354;

  it('draws as main below AX1, however wide its word', () => {
    expect(phoneTitleSize(DEFAULT, 5000, PAGE)).toBe(PHONE_TITLE);
    expect(phoneTitleSize(SEVENTH, 5000, PAGE)).toBeCloseTo(PHONE_TITLE * SEVENTH);
  });

  it('grows with no cap while its word fits', () => {
    expect(phoneTitleSize(AX2, 300, PAGE)).toBeCloseTo(PHONE_TITLE * AX2);
  });

  it('steps down only until its word fits, never under 30', () => {
    const start = PHONE_TITLE * AX5;
    const drawn = phoneTitleSize(AX5, 500, PAGE);

    expect((500 * drawn) / start).toBeLessThanOrEqual(PAGE);
    expect((500 * (drawn + 1)) / start).toBeGreaterThan(PAGE);
    expect(phoneTitleSize(AX5, 50000, PAGE)).toBe(PHONE_TITLE);
  });
});

describe('the bell’s empty sentence at the accessibility sizes (sc-94028)', () => {
  const BESIDE = ROOM - EMPTY_TILE - EMPTY_GAP;

  it('grows as main does, with no cap', () => {
    expect(emptyStart(DEFAULT)).toBe(EMPTY_SENTENCE);
    expect(emptyStart(AX5)).toBeCloseTo(EMPTY_SENTENCE * AX5);
  });

  it('keeps the tile beside it where its widest word fits beside, and below AX1 always', () => {
    expect(emptyTileAbove(AX2, BESIDE, ROOM)).toBe(false);
    expect(emptyTileAbove(AX2, BESIDE + 1, ROOM)).toBe(true);
    expect(emptyTileAbove(SEVENTH, 5000, ROOM)).toBe(false);
  });

  it('keeps its grown size where its widest word fits its line', () => {
    expect(emptySentenceSize(AX5, BESIDE, ROOM)).toBeCloseTo(EMPTY_SENTENCE * AX5);
    expect(emptySentenceSize(AX5, ROOM, ROOM)).toBeCloseTo(EMPTY_SENTENCE * AX5);
  });

  it('steps down only for its widest word, over the panel’s full width once the tile is above', () => {
    const drawn = emptySentenceSize(AX5, ROOM * 1.25, ROOM);

    expect(drawn).toBeLessThan(EMPTY_SENTENCE * AX5);
    expect(drawn).toBeGreaterThan(EMPTY_SENTENCE * AX5 * 0.75);
    expect(emptySentenceSize(AX5, 5000, ROOM)).toBe(EMPTY_SENTENCE);
  });

  it('below AX1 draws as on main, whatever its widest word', () => {
    expect(emptySentenceSize(SEVENTH, 5000, ROOM)).toBeCloseTo(EMPTY_SENTENCE * SEVENTH);
  });
});

describe('Notification settings at the panel’s foot, by the sentence’s rule (sc-94028)', () => {
  // The iPad's body line, measured on the boards; Configuración at 15 × AX5 in Instrument Sans SemiBold.
  const IPAD_LINE = 346;
  const CONFIGURACION = 359.0;

  it('grows as main does, with no cap', () => {
    expect(settingsStart(DEFAULT)).toBe(SETTINGS_LINK);
    expect(settingsStart(AX5)).toBeCloseTo(SETTINGS_LINK * AX5);
  });

  it('keeps its grown size where its widest word fits the line', () => {
    expect(settingsSize(AX5, IPAD_LINE, IPAD_LINE)).toBeCloseTo(SETTINGS_LINK * AX5);
  });

  it('steps down to 51 at AX5 in Spanish on the iPad, so Configuración is whole', () => {
    expect(settingsSize(AX5, CONFIGURACION, IPAD_LINE)).toBe(51);
  });

  it('never draws under 15, and below AX1 draws as on main', () => {
    expect(settingsSize(AX5, 5000, IPAD_LINE)).toBe(SETTINGS_LINK);
    expect(settingsSize(SEVENTH, 5000, IPAD_LINE)).toBeCloseTo(SETTINGS_LINK * SEVENTH);
  });
});
