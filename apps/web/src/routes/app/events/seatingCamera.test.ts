import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fitOf, intoView, planFitOf, useCamera } from './seatingCamera.ts';
import { percentOf } from './seatingDraw.ts';

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

  it('slides a box out from under a floating bar by the shorter way that stays in view', () => {
    const smallMap = { x0: 534, y0: 499, x1: 706, y1: 639 };

    expect(intoView({ x0: 600, y0: 550, x1: 650, y1: 600 }, 718, 719, [smallMap])).toEqual([
      0, -109,
    ]);
    expect(intoView({ x0: 300, y0: 550, x1: 350, y1: 600 }, 718, 719, [smallMap])).toEqual([0, 0]);
  });
});

describe('a box larger than the view on one axis only (sc-57361)', () => {
  it('slides a row wider than the view up from under the small map, keeping its left edge', () => {
    const smallMap = { x0: 534, y0: 499, x1: 706, y1: 639 };

    expect(intoView({ x0: -900, y0: 550, x1: 900, y1: 600 }, 718, 719, [smallMap])).toEqual([
      924, -109,
    ]);
  });

  it('slides a box taller than the view sideways clear of a bar, keeping its top edge', () => {
    const bar = { x0: 24, y0: 200, x1: 80, y1: 500 };

    expect(intoView({ x0: 50, y0: 500, x1: 100, y1: 1400 }, 718, 719, [bar])).toEqual([38, -408]);
  });

  it('lines the box up with its top edge too when no pan up or down clears the bar', () => {
    const bar = { x0: 534, y0: 100, x1: 706, y1: 600 };

    expect(intoView({ x0: -900, y0: 300, x1: 900, y1: 400 }, 718, 719, [bar])).toEqual([924, -208]);
  });
});

describe('Fit the room, held to the zoom bar’s range (sc-57678)', () => {
  it('fits a 100 × 80 m room at 25%, its centre at the centre of the floor', () => {
    const fit = planFitOf(718, 719, { w: 10000, l: 8000 });

    expect(percentOf(fit.s)).toBe(25);
    expect(fit.ox + (10000 * fit.s) / 2).toBe(359);
    expect(fit.oy + (8000 * fit.s) / 2).toBe(359.5);
  });

  it('fits a 2 × 2 m room at 400%, whole and centred', () => {
    const fit = planFitOf(718, 719, { w: 200, l: 200 });

    expect(percentOf(fit.s)).toBe(400);
    expect(fit.ox + (200 * fit.s) / 2).toBe(359);
    expect(fit.oy + (200 * fit.s) / 2).toBe(359.5);
  });

  it('fits a room between 25% and 400% exactly as before', () => {
    expect(planFitOf(718, 719, { w: 2400, l: 1800 })).toEqual(
      fitOf(718, 719, { w: 2400, l: 1800 }),
    );
  });

  it('opens the plan on a 100 × 80 m room at 25%, and Fit the room comes back there', () => {
    const { result } = renderHook(() =>
      useCamera('sc-57678', { w: 10000, l: 8000 }, { w: 718, h: 719 }),
    );

    expect(percentOf(result.current.s)).toBe(25);
    expect(result.current.atSmallest).toBe(true);

    act(() => result.current.step(1));
    expect(percentOf(result.current.s)).toBeGreaterThan(25);

    act(() => result.current.fitRoom());
    expect(percentOf(result.current.s)).toBe(25);
    expect(result.current.atSmallest).toBe(true);
  });
});
