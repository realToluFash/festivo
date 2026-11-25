import { describe, expect, it } from 'vitest';

import {
  BELL_LANGUAGES,
  BESIDE_GAP,
  MARK_ALL,
  markAllSize,
  markAllStart,
  markAllUnder,
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
