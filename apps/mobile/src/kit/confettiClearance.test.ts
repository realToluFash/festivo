import { describe, expect, it } from 'vitest';

import { clearOfWords, pieceBounds, pieceSize } from './confettiClearance.ts';

const COVER = { width: 377, height: 500 };
const WORDS = { x: 16, y: 200, width: 345, height: 120 };

describe('confetti keeps clear of the words (sc-29078, 8 Nov)', () => {
  it('sizes a half disc half as tall as wide, and a bar never under 8', () => {
    expect(pieceSize('half', 40, 1)).toEqual({ width: 40, height: 20 });
    expect(pieceSize('bar', 26, 0.76)).toEqual({ width: 20, height: 8 });
    expect(pieceSize('bar', 50, 1.5)).toEqual({ width: 75, height: 18 });
  });

  it('bounds an unturned piece from the middle of its top edge', () => {
    expect(pieceBounds({ x: 0.5, y: 0.1, shape: 'half', size: 40, turn: 0 }, COVER, 1)).toEqual({
      x: 168.5,
      y: 50,
      width: 40,
      height: 20,
    });
  });

  it('bounds a piece turned a quarter as standing on its end, about the same centre', () => {
    const box = pieceBounds({ x: 0.5, y: 0.1, shape: 'half', size: 40, turn: 90 }, COVER, 1);

    expect(box.width).toBeCloseTo(20);
    expect(box.height).toBeCloseTo(40);
    expect(box.x + box.width / 2).toBeCloseTo(188.5);
    expect(box.y + box.height / 2).toBeCloseTo(60);
  });

  it('keeps a piece exactly 8 away and leaves out one 7 away, on every side', () => {
    const at = (x: number, y: number) => ({ x, y, width: 10, height: 10 });

    expect(clearOfWords(at(WORDS.x + WORDS.width + 8, 250), WORDS)).toBe(true);
    expect(clearOfWords(at(WORDS.x + WORDS.width + 7, 250), WORDS)).toBe(false);
    expect(clearOfWords(at(WORDS.x - 18, 250), WORDS)).toBe(true);
    expect(clearOfWords(at(WORDS.x - 17, 250), WORDS)).toBe(false);
    expect(clearOfWords(at(100, WORDS.y - 18), WORDS)).toBe(true);
    expect(clearOfWords(at(100, WORDS.y - 17), WORDS)).toBe(false);
    expect(clearOfWords(at(100, WORDS.y + WORDS.height + 8), WORDS)).toBe(true);
    expect(clearOfWords(at(100, WORDS.y + WORDS.height + 7), WORDS)).toBe(false);
  });

  it('keeps a piece beside the words that is clear above them', () => {
    expect(clearOfWords({ x: 0, y: 0, width: 30, height: 30 }, WORDS)).toBe(true);
  });
});
