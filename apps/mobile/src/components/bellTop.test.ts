import { describe, expect, it } from 'vitest';

import { BELL_BESIDE_GAP, BELL_MARK_ALL, markAllSize, markAllUnder } from './bellTop.ts';

const SEVENTH = 1.353;
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
