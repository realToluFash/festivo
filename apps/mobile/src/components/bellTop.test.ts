import { describe, expect, it } from 'vitest';

import {
  BELL_BESIDE_GAP,
  BELL_MARK_ALL,
  EMPTY_GAP,
  EMPTY_SENTENCE,
  EMPTY_TILE,
  emptySentenceSize,
  emptyTileAbove,
  markAllSize,
  markAllUnder,
  SETTINGS_LINK,
  settingsSize,
} from './bellTop.ts';

const SEVENTH = 1.353;
const AX2 = 2.143;
const AX5 = 3.571;
const ROOM = 346;

describe('the tablet bell panel’s top (sc-92580)', () => {
  it('grows Mark all read with the text size and steps it down only for its widest word, never under 15', () => {
    expect(markAllSize(AX5, 170, ROOM)).toBeCloseTo(BELL_MARK_ALL * AX5);
    expect(markAllSize(AX5, 5000, ROOM)).toBe(BELL_MARK_ALL);
  });

  it('never steps Mark all read below AX1, where main draws it', () => {
    expect(markAllSize(SEVENTH, 5000, ROOM)).toBeCloseTo(BELL_MARK_ALL * SEVENTH);
  });

  it('keeps Mark all read beside the heading only where both fit whole on one row', () => {
    const beside = ROOM - 200 - BELL_BESIDE_GAP;

    expect(markAllUnder({ room: ROOM, heading: 200, markAll: beside })).toBe(false);
    expect(markAllUnder({ room: ROOM, heading: 200, markAll: beside + 1 })).toBe(true);
  });

  it('decides nothing until all three are measured', () => {
    expect(markAllUnder({ room: 0, heading: 300, markAll: 300 })).toBe(false);
    expect(markAllUnder({ room: ROOM, heading: 0, markAll: 300 })).toBe(false);
    expect(markAllUnder({ room: ROOM, heading: 300, markAll: 0 })).toBe(false);
  });
});

describe('the bell’s empty sentence at the accessibility sizes (sc-94028)', () => {
  const BESIDE = ROOM - EMPTY_TILE - EMPTY_GAP;

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
