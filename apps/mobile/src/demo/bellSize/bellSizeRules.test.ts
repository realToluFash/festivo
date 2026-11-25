import { describe, expect, it } from 'vitest';

import {
  BELL_LANGUAGES,
  BESIDE_GAP,
  HEADING,
  MARK_ALL,
  headingSize,
  headingStart,
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
  it('grows both as main does, with no cap', () => {
    expect(headingStart(DEFAULT)).toBe(HEADING);
    expect(headingStart(AX5)).toBeCloseTo(HEADING * AX5);
    expect(markAllStart(AX2)).toBeCloseTo(MARK_ALL * AX2);
  });

  it('keeps the heading at its full size while its word fits', () => {
    expect(headingSize(AX2, 300, ROOM)).toBeCloseTo(HEADING * AX2);
  });

  it('steps the heading down to the largest size at which its word fits, never under 18', () => {
    const start = headingStart(AX5);

    expect(headingSize(AX5, 480, ROOM)).toBe(Math.floor((start * ROOM) / 480));
    expect(headingSize(AX5, 480, ROOM)).toBeLessThan(start);
    expect(headingSize(AX5, 5000, ROOM)).toBe(HEADING);
  });

  it('never steps below AX1, where main draws it', () => {
    expect(headingSize(SEVENTH, 480, ROOM)).toBeCloseTo(HEADING * SEVENTH);
  });

  it('steps Mark all read down only for its widest word, never under 15', () => {
    expect(markAllSize(AX5, 170, ROOM)).toBeCloseTo(MARK_ALL * AX5);
    expect(markAllSize(AX5, 5000, ROOM)).toBe(MARK_ALL);
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
