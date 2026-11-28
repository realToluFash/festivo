import { describe, expect, it } from 'vitest';

import {
  floorBox,
  insideRoom,
  keyStep,
  overlapping,
  shiftWithin,
  snapToGrid,
  type Footprint,
} from './seatingFloor.ts';

const room = { widthCm: 1000, lengthCm: 800 };
const round = (xCm: number, yCm: number, r = 140): Footprint => ({
  xCm,
  yCm,
  rotation: 0,
  round: true,
  half: [r, r],
});
const long = (xCm: number, yCm: number, rotation = 0): Footprint => ({
  xCm,
  yCm,
  rotation,
  round: false,
  half: [90, 88],
});

describe('the floor', () => {
  it('snaps to 10 cm in metric and 6 in in US customary, or to the centimetre when Snap to grid is off', () => {
    expect(snapToGrid(434, 'metric', true)).toBe(430);
    expect(snapToGrid(436, 'metric', true)).toBe(440);
    expect(snapToGrid(436, 'metric', false)).toBe(436);
    expect(snapToGrid(40, 'us', true)).toBe(46);
    expect(snapToGrid(37, 'us', true)).toBe(30);
  });

  it('steps 10 cm or 1 m in metric, 3 in or 1 ft in US customary', () => {
    expect([keyStep('metric', false), keyStep('metric', true)]).toEqual([10, 100]);
    expect([keyStep('us', false), keyStep('us', true)]).toEqual([7.62, 30.48]);
  });

  it('turns a long table’s box with it', () => {
    expect(floorBox(long(500, 400))).toEqual({ x0: 410, y0: 312, x1: 590, y1: 488 });
    const quarter = floorBox(long(500, 400, 90));

    expect([quarter.x1 - quarter.x0, quarter.y1 - quarter.y0].map(Math.round)).toEqual([176, 180]);
  });

  it('keeps an item inside the room, its chairs included', () => {
    expect(insideRoom(round(140, 140), room)).toBe(true);
    expect(insideRoom(round(139, 140), room)).toBe(false);
    expect(insideRoom(round(860, 660), room)).toBe(true);
  });

  it('stops a step of several items at the edge the first of them meets', () => {
    expect(shiftWithin([round(300, 300), round(800, 300)], room, [100, 0])).toEqual([60, 0]);
    expect(shiftWithin([round(300, 300)], room, [0, -500])).toEqual([0, -160]);
    expect(shiftWithin([round(300, 300)], room, [20, 30])).toEqual([20, 30]);
  });

  it('finds an overlap between circles, a circle and a turned table, and two turned tables', () => {
    expect(overlapping(round(300, 300), round(500, 300))).toBe(true);
    expect(overlapping(round(300, 300), round(581, 300))).toBe(false);
    expect(overlapping(round(300, 300), long(500, 300))).toBe(true);
    expect(overlapping(round(300, 300), long(600, 300))).toBe(false);
    expect(overlapping(long(300, 300, 45), long(470, 300, 45))).toBe(true);
    expect(overlapping(long(300, 300), long(481, 300))).toBe(false);
  });
});
