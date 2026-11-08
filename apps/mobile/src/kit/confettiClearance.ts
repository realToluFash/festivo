import { tokens } from '../theme/tokens.ts';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Shape = 'half' | 'bar';

/** A piece's drawn width and height at a scale: a half disc is half as tall as wide, a bar a quarter and never under 8. */
export function pieceSize(shape: Shape, size: number, scale: number): Size {
  const n = Math.round(size * scale);

  return shape === 'half'
    ? { width: n, height: n / 2 }
    : { width: n, height: Math.max(8, Math.round(n * 0.24)) };
}

/** Where a piece lands on a cover, turned as drawn: its left edge's middle at its share of the width, its top at its share of the height. */
export function pieceBounds(
  piece: { x: number; y: number; shape: Shape; size: number; turn: number },
  cover: Size,
  scale: number,
): Box {
  const { width, height } = pieceSize(piece.shape, piece.size, scale);
  const centreX = piece.x * cover.width;
  const centreY = piece.y * cover.height + height / 2;
  const turn = (piece.turn * Math.PI) / 180;
  const cos = Math.abs(Math.cos(turn));
  const sin = Math.abs(Math.sin(turn));
  const across = cos * width + sin * height;
  const down = sin * width + cos * height;

  return { x: centreX - across / 2, y: centreY - down / 2, width: across, height: down };
}

/** Whether a piece keeps spaceSm or more outside the words' box (sc-29078, 8 Nov). */
export function clearOfWords(piece: Box, words: Box): boolean {
  const gap = tokens.spaceSm;

  return (
    piece.x + piece.width <= words.x - gap ||
    piece.x >= words.x + words.width + gap ||
    piece.y + piece.height <= words.y - gap ||
    piece.y >= words.y + words.height + gap
  );
}
