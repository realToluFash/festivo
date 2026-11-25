import { describe, expect, it } from 'vitest';

import { filterScale } from '../filterSize/filterSizeRules.ts';
import {
  BAND_TITLE,
  bandLine,
  bandRoom,
  bandStart,
  bandTitle,
  BAND_TALLEST,
  bandMomentOf,
} from './bandTitleRules.ts';

// An iPhone 17 Pro upright: 402 wide, 16 either side, the 40 tile, then Search and the bell, 40 each with 8 between.
const PRO = { width: 402, tileEnd: 56, searchStart: 298 };
const AX1 = filterScale('ax1', 1);
const AX5 = filterScale('ax5', 1);

// Semibold, about 0.55 of its size a letter.
function wide(word: string, size: number): number {
  return word.length * size * 0.55;
}

describe('the band’s title at the standard sizes', () => {
  it('is main’s: the default × the scale, centred on the screen, whatever its width', () => {
    for (const size of ['default', 'seventh'] as const) {
      const scale = filterScale(size, 1);

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

describe('the board’s choices', () => {
  it('falls back to a day with no event', () => {
    expect(bandMomentOf('day')).toBe('day');
    expect(bandMomentOf(undefined)).toBe('quiet');
    expect(bandMomentOf('now')).toBe('quiet');
  });
});
