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

export interface Placement {
  left: `${number}%`;
  top: `${number}%`;
  marginLeft: number;
}

/** Where Confetti puts a piece of a size, unturned: its left edge at its share of the width less half its width, its top at its share of the height. */
export function piecePlacement(piece: { x: number; y: number }, size: Size): Placement {
  return { left: `${piece.x * 100}%`, top: `${piece.y * 100}%`, marginLeft: -size.width / 2 };
}

/** The box a piece covers on a cover, from the same placement Confetti draws it at, turned about its centre. */
export function pieceBounds(
  piece: { x: number; y: number; shape: Shape; size: number; turn: number },
  cover: Size,
  scale: number,
): Box {
  const size = pieceSize(piece.shape, piece.size, scale);
  const { width, height } = size;
  const placement = piecePlacement(piece, size);
  const left = (parseFloat(placement.left) / 100) * cover.width + placement.marginLeft;
  const top = (parseFloat(placement.top) / 100) * cover.height;
  const centreX = left + width / 2;
  const centreY = top + height / 2;
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
