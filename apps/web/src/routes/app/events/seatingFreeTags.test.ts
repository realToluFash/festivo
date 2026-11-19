import { type SeatingPlan, type SeatingTable } from '@soirely/api-client';
import { tableExtent } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { chairTipBox, freeTags } from './seatingFreeTags.ts';
import { floorItems } from './seatingItems.ts';

function table(id: string, xCm: number, yCm: number) {
  return {
    id,
    name: `Table ${id.slice(1)}`,
    sectionId: null,
    shape: 'round',
    seats: 10,
    widthCm: 180,
    lengthCm: 180,
    endSeats: 0,
    rotation: 0,
    xCm,
    yCm,
    unusableSeats: [],
    version: 1,
    changedBy: null,
  } as unknown as SeatingTable;
}

function planOf(tables: SeatingTable[]): SeatingPlan {
  return {
    id: 'plan_1',
    roomName: null,
    widthCm: 2400,
    lengthCm: 1800,
    version: 1,
    changedBy: null,
    sections: [],
    tables,
    rows: [],
    singleSeats: [],
    guests: [],
  } as unknown as SeatingPlan;
}

const R = tableExtent(table('t0', 0, 0))[1];
const AT_100 = 0.5;
const words = (n: number) => `${n} free`;

function tagsAt(tables: SeatingTable[], s: number): Record<string, number> {
  const plan = planOf(tables);

  return Object.fromEntries(
    freeTags(plan, floorItems(plan), s, 0, 0, words).map((tag) => [tag.id, tag.y]),
  );
}

describe('Where a free tag goes while a guest is picked (sc-5030)', () => {
  const under = (yCm: number) => (yCm + R) * AT_100 + 6 + 26;
  const over = (yCm: number) => (yCm - R) * AT_100 - 6 - 26;

  it('goes under its table when nothing is there', () => {
    expect(tagsAt([table('t1', 600, 600)], AT_100)).toEqual({ t1: under(600) });
  });

  it('goes over its table when another item is under it and nothing is over it', () => {
    const below = 600 + 2 * R + 30;

    expect(tagsAt([table('t1', 600, 600), table('t2', 600, below)], AT_100).t1).toBe(over(600));
  });

  it('stays under its table when another item is both under it and over it', () => {
    const gap = 2 * R + 30;

    expect(
      tagsAt(
        [table('t0', 600, 600 - gap), table('t1', 600, 600), table('t2', 600, 600 + gap)],
        AT_100,
      ).t1,
    ).toBe(under(600));
  });

  it('below 50%, goes a line lower when it would cross a tag placed before it in reading order', () => {
    const s = 0.2 * AT_100;
    const tags = tagsAt([table('t2', 800, 600), table('t1', 600, 600)], s);

    expect(tags.t2! - tags.t1!).toBe(24);
    expect(tagsAt([table('t1', 600, 600), table('t2', 1600, 600)], s).t2).toBe(tags.t1);
  });
});

describe("Where a chair's label goes (sc-5030)", () => {
  const chair = { x: 300, y: 200, r: 10 };
  const top = (at: typeof chair, cover: Parameters<typeof chairTipBox>[3]) =>
    chairTipBox(at, 120, 1000, cover).top;

  it('goes above the chair when nothing covers it there', () => {
    expect(top(chair, null)).toBe(150);
    expect(top(chair, { x0: 0, y0: 0, x1: 600, y1: 140 })).toBe(150);
  });

  it('goes under the chair where above would be under the bar over the room', () => {
    expect(top(chair, { x0: 0, y0: 0, x1: 600, y1: 160 })).toBe(222);
  });

  it("goes under the chair where above would be past the room's top", () => {
    expect(top({ ...chair, y: 30 }, null)).toBe(52);
  });

  it('is centred on the chair when the room is wide enough', () => {
    expect(chairTipBox(chair, 120, 1000, null).left).toBe(240);
  });

  it("slides 8 px inside the room's left and right edges", () => {
    expect(chairTipBox({ ...chair, x: 10 }, 120, 1000, null).left).toBe(8);
    expect(chairTipBox({ ...chair, x: 990 }, 120, 1000, null).left).toBe(872);
  });

  it('goes under the chair when the slid label, not the centred one, would sit under the bar', () => {
    const cover = { x0: 0, y0: 0, x1: 60, y1: 160 };

    expect(chairTipBox({ ...chair, x: 10 }, 120, 1000, cover).top).toBe(222);
  });
});
