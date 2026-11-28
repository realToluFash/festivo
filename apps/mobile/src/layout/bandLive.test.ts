import { describe, expect, it } from 'vitest';

import { LIVE_LINE, liveLine, liveRoom } from './bandLive.ts';

// An iPad Pro 13-inch upright is 1032 wide.
const ROOM = liveRoom(1032);
// iOS's text size scales at the default, the seventh step, AX1 and AX5.
const DEFAULT = 1;
const SEVENTH = 1.353;
const AX1 = 1.786;
const AX5 = 3.571;

// Widths in the app's Instrument Sans SemiBold at AX5's start, measured with kerning.
const AT_AX5 = { cours: 126.5, word: 1055.2, w: 52.4 };

describe('the live line at the standard sizes', () => {
  it('is main’s: 13.5 × the scale, whatever its width', () => {
    for (const scale of [DEFAULT, SEVENTH])
      expect(liveLine(scale, 5000, ROOM)).toBe(LIVE_LINE * scale);
  });
});

describe('the live line at the accessibility sizes', () => {
  it('keeps its chosen size while its widest word fits the room', () => {
    expect(liveLine(AX5, AT_AX5.cours, ROOM)).toBe(LIVE_LINE * AX5);
    expect(liveLine(AX1, 60, ROOM)).toBe(LIVE_LINE * AX1);
  });

  it('steps the whole line down to the largest size at which its widest word fits whole', () => {
    const start = LIVE_LINE * AX5;
    const size = liveLine(AX5, AT_AX5.word, ROOM);

    expect((AT_AX5.word * size) / start).toBeLessThanOrEqual(ROOM);
    expect((AT_AX5.word * (size + 1)) / start).toBeGreaterThan(ROOM);
  });

  it('never goes under 13.5, even for a word wider than the room at 13.5', () => {
    expect(liveLine(AX5, AT_AX5.w * 120, ROOM)).toBe(LIVE_LINE);
  });
});

describe('the band', () => {
  it('has the room of an iPad Pro 13-inch upright less 16 either side, the dot and its gap', () => {
    expect(ROOM).toBe(986);
  });
});
