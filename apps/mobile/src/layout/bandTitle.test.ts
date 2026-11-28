import { describe, expect, it } from 'vitest';

import {
  BAND_TALLEST,
  BAND_TITLE,
  bandLine,
  bandLiveRoom,
  bandLiveSize,
  bandRoom,
  bandStart,
  bandTitle,
} from './bandTitle.ts';
import { LIVE_FOOT, LIVE_LINE, liveLineHeight } from './bandLive.ts';

// An iPhone 17 Pro upright: 402 wide, 16 either side, the 40 tile, then Search and the bell, 40 each with 8 between.
const PRO = { width: 402, tileEnd: 56, searchStart: 298 };
// iOS's seventh, eighth and twelfth steps of Larger Text: the last standard size, AX1 and AX5.
const AX1 = 1.786;
const AX5 = 3.571;
const SEVENTH = 1.353;

// Semibold, about 0.55 of its size a letter.
function wide(word: string, size: number): number {
  return word.length * size * 0.55;
}

describe('the band’s title at the standard sizes', () => {
  it('is main’s: the default × the scale, centred on the screen, whatever its width', () => {
    for (const scale of [1, SEVENTH]) {
      expect(bandTitle(scale, 400, PRO)).toEqual({
        size: BAND_TITLE * scale,
        centred: 'screen',
      });
    }
  });
});

describe('the band’s title at the accessibility sizes', () => {
  it('stays centred on the screen at its chosen size while it clears the tile and Search by 8', () => {
    const start = bandStart(AX1);

    expect(bandTitle(AX1, wide('Today', start), PRO)).toEqual({ size: start, centred: 'screen' });
  });

  it('moves to the middle of the room when centred on the screen it would come within 8 of Search', () => {
    const start = bandStart(AX1);
    const at = wide('Aujourd’hui', start);

    expect(at).toBeGreaterThan(PRO.width - 2 * (PRO.width - PRO.searchStart + 8));
    expect(at).toBeLessThanOrEqual(bandRoom(PRO));
    expect(bandTitle(AX1, at, PRO)).toEqual({ size: start, centred: 'room' });
  });

  it('steps down to the largest size whose width fits the room with 8 either side', () => {
    const start = bandStart(AX5);
    const at = wide('Aujourd’hui', start);
    const { size, centred } = bandTitle(AX5, at, PRO);

    expect(centred).toBe('room');
    expect((at * size) / start).toBeLessThanOrEqual(bandRoom(PRO));
    expect((at * (size + 1)) / start).toBeGreaterThan(bandRoom(PRO));
  });

  it('never draws a line taller than the row holds, so a short word never runs into the status bar', () => {
    const { size } = bandTitle(AX5, wide('Today', bandStart(AX5)), PRO);

    expect(bandLine(size)).toBeLessThanOrEqual(BAND_TALLEST);
    expect(bandLine(size + 1)).toBeGreaterThan(BAND_TALLEST);
  });

  it('never goes under its default size, however narrow the room', () => {
    const narrow = { width: 320, tileEnd: 56, searchStart: 216 };

    expect(bandTitle(AX5, 2000, narrow).size).toBe(BAND_TITLE);
  });

  it('is never larger than its chosen size', () => {
    const start = bandStart(AX1);

    expect(bandTitle(AX1, 10, PRO).size).toBe(start);
  });
});

describe('the phone’s live line under the band’s title', () => {
  // An iPhone 17 Pro's band on an event's day: 62 of status bar, 84 of body, the 40 row 4 under its top.
  const room = bandLiveRoom(62 + 4 + 20, 62 + 84, LIVE_FOOT);

  it('is main’s at the standard sizes', () => {
    for (const scale of [1, SEVENTH]) expect(bandLiveSize(scale, room)).toBe(LIVE_LINE * scale);
  });

  it('keeps its line under the title’s tallest line from AX1, so the two never meet', () => {
    for (const scale of [AX1, AX5]) {
      const size = bandLiveSize(scale, room);

      expect(liveLineHeight(size)).toBeLessThanOrEqual(room);
      expect(size).toBeLessThanOrEqual(LIVE_LINE * scale);
    }
    expect(bandLiveSize(AX5, room)).toBeLessThan(LIVE_LINE * AX5);
  });

  it('never draws under its default size', () => {
    expect(bandLiveSize(AX5, 0)).toBe(LIVE_LINE);
  });
});
