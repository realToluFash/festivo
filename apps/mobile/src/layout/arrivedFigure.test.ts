import { describe, expect, it } from 'vitest';

import {
  FIGURE_LABEL,
  FIGURE_NUMBERS,
  FIGURE_RING,
  figureRing,
  figureRoom,
  figureStroke,
} from './arrivedFigure.ts';

const AX1 = 1.7;
const AX5 = 3.1;

describe('the arrived figure’s ring (sc-94022)', () => {
  it('is main’s 44 with its 4 stroke at the default size and below AX1', () => {
    expect(figureRing(FIGURE_NUMBERS, FIGURE_LABEL)).toBe(FIGURE_RING);
    expect(figureStroke(FIGURE_RING)).toBe(4);
  });

  it('is as tall as the two lines beside it at AX1 and AX5, never under 44', () => {
    for (const scale of [AX1, AX5]) {
      const numbers = FIGURE_NUMBERS * scale;
      const label = FIGURE_LABEL * scale;
      const side = figureRing(numbers, label);

      expect(side).toBe(Math.ceil(numbers * 1.2) + Math.ceil(label * 1.3));
      expect(side).toBeGreaterThan(FIGURE_RING);
    }
  });

  it('follows the sizes drawn, so numbers stepped down give a smaller ring', () => {
    expect(figureRing(30, 20)).toBeLessThan(figureRing(56, 38));
    expect(figureRing(1, 1)).toBe(FIGURE_RING);
  });

  it('keeps its stroke at 1:11 of the side and never under 4', () => {
    expect(figureStroke(44)).toBe(4);
    expect(figureStroke(110)).toBe(10);
    expect(figureStroke(120)).toBe(11);
  });
});

describe('the room beside the ring (sc-94022)', () => {
  it('is the column less the ring and its gap, never negative', () => {
    expect(figureRoom(300, 100, 12)).toBe(188);
    expect(figureRoom(80, 100, 12)).toBe(0);
  });
});
