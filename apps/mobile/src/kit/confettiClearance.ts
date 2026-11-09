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

export type Tone = 'sun' | 'white' | 'rose' | 'sky';

export type Piece = readonly [
  x: number,
  y: number,
  shape: Shape,
  size: number,
  turn: number,
  tone: Tone,
];

/** The Settings card's pieces, by share of a Confetti card: they keep to its right side, clear of the words. */
export const CARD_PIECES: readonly Piece[] = [
  [0.67, 0.05, 'half', 22, -18, 'sun'],
  [0.83, 0.11, 'bar', 26, 24, 'white'],
  [0.96, 0.2, 'half', 14, 200, 'rose'],
  [0.81, 0.73, 'half', 20, 32, 'rose'],
  [0.92, 0.84, 'bar', 24, -40, 'sun'],
  [0.58, 0.9, 'bar', 16, 62, 'white'],
];

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

/** The pieces a cover of a size keeps at a scale: those clear of the words. */
export function piecesClearOf(
  pieces: readonly Piece[],
  cover: Size,
  scale: number,
  words: Box,
): readonly Piece[] {
  return pieces.filter(([x, y, shape, size, turn]) =>
    clearOfWords(pieceBounds({ x, y, shape, size, turn }, cover, scale), words),
  );
}
