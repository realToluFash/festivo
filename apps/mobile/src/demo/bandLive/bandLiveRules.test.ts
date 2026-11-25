import { describe, expect, it } from 'vitest';

import { filterScale } from '../filterSize/filterSizeRules.ts';
import {
  EVENT_NAME_MAXIMUM,
  LIVE_LINE,
  liveEventName,
  liveEventOf,
  liveLine,
  liveRoom,
} from './bandLiveRules.ts';

// An iPad Pro 13-inch upright is 1032 wide.
const ROOM = liveRoom(1032);
const AX1 = filterScale('ax1', 1);
const AX5 = filterScale('ax5', 1);

// Widths in the app's Instrument Sans SemiBold at AX5's start, 48.2, measured with kerning.
const AT_AX5 = {
  cours: 126.5,
  word: 1055.2,
  w: 52.4,
};

describe('the live line at the standard sizes', () => {
  it('is main’s: 13.5 × the scale, whatever its width', () => {
    for (const size of ['default', 'seventh'] as const) {
      const scale = filterScale(size, 1);

      expect(liveLine(scale, 5000, ROOM)).toBe(LIVE_LINE * scale);
    }
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

    expect(size).toBe(45);
    expect((AT_AX5.word * size) / start).toBeLessThanOrEqual(ROOM);
    expect((AT_AX5.word * (size + 1)) / start).toBeGreaterThan(ROOM);
  });

  it('never goes under 13.5, even for a word wider than the room at 13.5', () => {
    const wide = AT_AX5.w * EVENT_NAME_MAXIMUM;

    expect(liveLine(AX5, wide, ROOM)).toBe(LIVE_LINE);
  });

  it('is never larger than its chosen size', () => {
    expect(liveLine(AX1, 10, ROOM)).toBe(LIVE_LINE * AX1);
  });
});

describe('the band', () => {
  it('has the room of an iPad Pro 13-inch upright less 16 either side, the dot and its gap', () => {
    expect(ROOM).toBe(986);
  });
});

describe('the board’s choices', () => {
  it('names the longest event 120 capital W with no space', () => {
    expect(liveEventName('wide')).toBe('W'.repeat(120));
    expect(liveEventName('wide')).toHaveLength(EVENT_NAME_MAXIMUM);
  });

  it('falls back to Dîner en direct', () => {
    expect(liveEventOf('none')).toBe('none');
    expect(liveEventOf('word')).toBe('word');
    expect(liveEventOf(undefined)).toBe('diner');
    expect(liveEventOf('other')).toBe('diner');
  });
});
