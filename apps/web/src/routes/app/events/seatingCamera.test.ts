import { describe, expect, it } from 'vitest';

import { intoView } from './seatingCamera.ts';

describe('the view following keyboard focus (sc-4007)', () => {
  it('slides by the least distance that shows a box whole and clear of the bars, and not at all when it shows', () => {
    expect(intoView({ x0: 200, y0: 300, x1: 300, y1: 400 }, 718, 719)).toEqual([0, 0]);
    expect(intoView({ x0: 800, y0: 300, x1: 900, y1: 400 }, 718, 719)).toEqual([-206, 0]);
    expect(intoView({ x0: -400, y0: -50, x1: -300, y1: 50 }, 718, 719)).toEqual([424, 142]);
    expect(intoView({ x0: 100, y0: 600, x1: 200, y1: 700 }, 718, 719)).toEqual([0, -73]);
  });

  it('lines a box larger than the view up with its top or left edge', () => {
    expect(intoView({ x0: -900, y0: 300, x1: 900, y1: 400 }, 718, 719)).toEqual([924, 0]);
    expect(intoView({ x0: 200, y0: 500, x1: 300, y1: 1400 }, 718, 719)).toEqual([0, -408]);
  });
});
