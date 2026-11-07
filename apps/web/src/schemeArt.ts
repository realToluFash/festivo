import { type Scheme, confetti } from './scheme.ts';

type Piece = readonly [number, number, 'half' | 'bar', number, number, 0 | 1 | 2 | 3];

export interface Art {
  width: number;
  height: number;
  pieces: readonly Piece[];
}

export const PAGE_ART: Art = {
  width: 666,
  height: 201,
  pieces: [
    [484, 16, 'half', 24, -18, 0],
    [574, 30, 'bar', 28, 24, 1],
    [640, 92, 'half', 16, 200, 2],
    [550, 118, 'half', 22, 32, 3],
    [620, 150, 'bar', 22, -40, 0],
    [454, 150, 'bar', 16, 62, 1],
  ],
};

export const PREVIEW_ART: Art = {
  width: 498,
  height: 96,
  pieces: [
    [384, 8, 'half', 22, -18, 0],
    [438, 16, 'bar', 26, 24, 1],
    [484, 30, 'half', 14, 200, 2],
  ],
};

export const SWATCH_ART: Art = {
  width: 158,
  height: 48,
  pieces: [
    [124, 8, 'half', 16, -18, 0],
    [96, 14, 'bar', 18, 24, 1],
    [142, 30, 'half', 12, 200, 2],
    [112, 26, 'half', 14, 32, 3],
    [68, 30, 'bar', 14, -40, 0],
  ],
};

/** Black tie and Sorbet: a light ground, so their words are dark. */
export function isLightGround(scheme: Scheme): boolean {
  return confetti[scheme].wash == null;
}
