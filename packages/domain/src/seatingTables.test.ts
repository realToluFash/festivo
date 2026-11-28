import { describe, expect, it } from 'vitest';

import { type TableLayout, chairsOf, sidesOf, squeezed } from './seatingTables.ts';

const round = (seats: number, widthCm = 180): TableLayout => ({
  shape: 'round',
  seats,
  widthCm,
  lengthCm: widthCm,
  endSeats: 0,
});
const long = (shape: 'rectangular' | 'head', seats: number, endSeats: number): TableLayout => ({
  shape,
  seats,
  widthCm: shape === 'head' ? 240 : 180,
  lengthCm: 76,
  endSeats,
});

function sidesSeen(table: TableLayout): Record<string, number> {
  return chairsOf(table).reduce<Record<string, number>>(
    (seen, chair) => ({ ...seen, [chair.side]: (seen[chair.side] ?? 0) + 1 }),
    {},
  );
}

describe('chairsOf', () => {
  it.each([1, 4, 10, 30])('puts all %i chairs of a round table round it', (seats) => {
    const chairs = chairsOf(round(seats));

    expect(chairs).toHaveLength(seats);
    expect(chairs.every((chair) => chair.side === 'round')).toBe(true);
    for (const chair of chairs) expect(Math.hypot(chair.x, chair.y)).toBeCloseTo(118);
    expect(chairs[0]).toMatchObject({ seat: 1, x: expect.closeTo(0) as number, y: -118 });
  });

  it('stands a cocktail table’s places round it, closer in', () => {
    const chairs = chairsOf({
      shape: 'cocktail',
      seats: 4,
      widthCm: 60,
      lengthCm: 60,
      endSeats: 0,
    });

    expect(chairs.map((chair) => Math.hypot(chair.x, chair.y))).toEqual([54, 54, 54, 54]);
  });

  it.each([
    [6, 0, { top: 3, bottom: 3 }],
    [7, 0, { top: 4, bottom: 3 }],
    [8, 2, { top: 3, bottom: 3, left: 1, right: 1 }],
    [9, 3, { top: 3, bottom: 3, left: 2, right: 1 }],
    [10, 1, { top: 5, bottom: 4, left: 1 }],
    [2, 2, { left: 1, right: 1 }],
  ])('seats a rectangular table of %i with %i on the ends by side', (seats, ends, sides) => {
    const table = long('rectangular', seats, ends);

    expect(sidesSeen(table)).toEqual(sides);
    for (const chair of chairsOf(table)) {
      if (chair.side === 'top') expect(chair.y).toBeLessThan(-38);
      if (chair.side === 'bottom') expect(chair.y).toBeGreaterThan(38);
      if (chair.side === 'left') expect(chair.x).toBeLessThan(-90);
      if (chair.side === 'right') expect(chair.x).toBeGreaterThan(90);
    }
  });

  it.each([
    [4, 0, { bottom: 4 }],
    [6, 2, { bottom: 4, left: 1, right: 1 }],
    [5, 1, { bottom: 4, left: 1 }],
  ])('seats a head table of %i with %i on the ends facing the room only', (seats, ends, sides) => {
    expect(sidesSeen(long('head', seats, ends))).toEqual(sides);
  });

  it('numbers a long table clockwise from the top left', () => {
    const chairs = chairsOf(long('rectangular', 8, 2));

    expect(chairs.map((chair) => chair.side)).toEqual([
      'top',
      'top',
      'top',
      'right',
      'bottom',
      'bottom',
      'bottom',
      'left',
    ]);
    expect(chairs[0]!.x).toBeLessThan(chairs[1]!.x);
    expect(chairs[4]!.x).toBeGreaterThan(chairs[5]!.x);
  });

  it('never puts more on the ends than the table has seats', () => {
    expect(sidesOf(long('rectangular', 3, 9))).toEqual({ top: 0, right: 1, bottom: 0, left: 2 });
  });
});

describe('squeezed', () => {
  it('passes every shape at its defaults', () => {
    expect(squeezed(round(10))).toBe(false);
    expect(squeezed(long('rectangular', 6, 0))).toBe(false);
    expect(squeezed(long('head', 4, 0))).toBe(false);
    expect(squeezed({ shape: 'cocktail', seats: 4, widthCm: 60, lengthCm: 60, endSeats: 0 })).toBe(
      false,
    );
  });

  it('warns on ten seats at a 150 cm round table', () => {
    expect(squeezed(round(10, 150))).toBe(true);
  });

  it('checks a long table’s ends on their own', () => {
    expect(squeezed(long('rectangular', 6, 4))).toBe(true);
  });

  it('never checks a cocktail table, whose guests stand', () => {
    expect(squeezed({ shape: 'cocktail', seats: 30, widthCm: 40, lengthCm: 40, endSeats: 0 })).toBe(
      false,
    );
  });
});
