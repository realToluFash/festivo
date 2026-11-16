import { type SeatingPlan, type SeatingTable } from '@soirely/api-client';
import { tableExtent } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { type FloorItem, floorItems } from './seatingItems.ts';
import {
  aligned,
  gridOf,
  inReadingOrder,
  kindLines,
  outsider,
  readGap,
  readWhole,
  rectOf,
  renumbered,
  restoredOf,
  spaced,
  touchedBy,
} from './seatingSelection.ts';

function table(id: string, xCm: number, yCm: number, more: Partial<SeatingTable> = {}) {
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
    ...more,
  } as SeatingTable;
}

function planOf(tables: SeatingTable[], more: Partial<SeatingPlan> = {}): SeatingPlan {
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
    ...more,
  } as unknown as SeatingPlan;
}

const R = tableExtent(table('t0', 0, 0))[0];

function items(plan: SeatingPlan): FloorItem[] {
  return floorItems(plan);
}

function xs(moved: { id: string; xCm: number }[]): Record<string, number> {
  return Object.fromEntries(moved.map((one) => [one.id, one.xCm]));
}

describe('Choosing many (sc-4717)', () => {
  it('chooses every item a box touches, however it was drawn', () => {
    const plan = planOf([table('t1', 600, 600), table('t2', 1500, 600), table('t3', 600, 1500)]);

    expect(touchedBy(items(plan), rectOf([700, 700], [1450, 500]))).toEqual(['t1', 't2']);
    expect(touchedBy(items(plan), rectOf([0, 0], [10, 10]))).toEqual([]);
  });

  it('reads top to bottom, then left to right, keeping tables a little out of line on one line', () => {
    const plan = planOf([
      table('t1', 1500, 610),
      table('t2', 600, 600),
      table('t3', 600, 1500),
      table('t4', 1000, 590),
    ]);

    expect(inReadingOrder(items(plan)).map((item) => item.one.id)).toEqual([
      't2',
      't4',
      't1',
      't3',
    ]);
  });

  it('aligns on the group’s left edge and centre, sending every chosen item', () => {
    const plan = planOf([table('t1', 1200, 900), table('t2', 600, 500)]);

    expect(xs(aligned(items(plan), 'left'))).toEqual({ t1: 600, t2: 600 });
    expect(xs(aligned(items(plan), 'centre'))).toEqual({ t1: 900, t2: 900 });
    expect(aligned(items(plan), 'top').map((one) => one.yCm)).toEqual([500, 500]);
  });

  it('spaces evenly between the outer two, which stay', () => {
    const plan = planOf([table('t1', 400, 900), table('t2', 2000, 900), table('t3', 700, 900)]);

    expect(xs(spaced(items(plan), 'across'))).toEqual({ t1: 400, t3: 1200, t2: 2000 });
  });

  it('sets a grid from the group’s top-left corner in reading order, and measures it', () => {
    const plan = planOf([
      table('t1', 500, 500),
      table('t2', 900, 520),
      table('t3', 1400, 480),
      table('t4', 700, 1200),
    ]);
    const { moved, w, l } = gridOf(items(plan), 2, 100);
    const step = 2 * R + 100;
    const top = Math.min(500, 520, 480);

    expect(moved.map((one) => [one.id, one.xCm, one.yCm])).toEqual([
      ['t1', 500, top],
      ['t2', Math.round(500 + step), top],
      ['t3', 500, Math.round(top + step)],
      ['t4', Math.round(500 + step), Math.round(top + step)],
    ]);
    expect(w).toBeCloseTo(4 * R + 100);
    expect(l).toBeCloseTo(4 * R + 100);
  });

  it('names the first item that would cross the wall', () => {
    const plan = planOf([table('t1', 300, 900), table('t2', 2200, 900)]);
    const moved = aligned(items(plan), 'right');

    expect(outsider(plan, items(plan), moved)).toBeNull();
    expect(
      outsider(plan, items(plan), [{ kind: 'table', id: 't1', version: 1, xCm: 10, yCm: 900 }])?.one
        .id,
    ).toBe('t1');
  });

  it('renumbers in reading order, and names a clash with a table outside the choice', () => {
    const plan = planOf([table('t1', 1200, 900), table('t2', 600, 900), table('t3', 600, 300)]);
    const chosen = items(plan).filter((item) => item.one.id !== 't3');
    const named = (n: number) => `Table ${n}`;

    expect(renumbered(plan, chosen, 2, named).clash).toBe('Table 3');
    expect(renumbered(plan, chosen, 1, named)).toEqual({
      names: [
        { id: 't2', version: 1, name: 'Table 1' },
        { id: 't1', version: 1, name: 'Table 2' },
      ],
      clash: null,
    });
  });

  it('lists each table shape in use, then rows, single seats and room features, then sections', () => {
    const plan = planOf([table('t1', 600, 600), table('t2', 900, 600, { sectionId: 's1' })], {
      sections: [{ id: 's1', name: 'Terrace' }] as SeatingPlan['sections'],
    });
    const { kinds, sections } = kindLines(plan);

    expect(kinds.map((line) => [line.key, line.ids.length])).toEqual([
      ['round', 2],
      ['row', 0],
      ['seat', 0],
      ['feature', 0],
    ]);
    expect(sections.map((line) => [line.word, line.ids])).toEqual([[{ name: 'Terrace' }, ['t2']]]);
  });

  it('reads columns from 1 to 20, and a gap from 0 to 10 m or 0 to 32 ft', () => {
    expect(readWhole('4', 20)).toBe(4);
    expect(readWhole('0', 20)).toBeNull();
    expect(readWhole('21', 20)).toBeNull();
    expect(readGap('1,5', 'metric', 'en')).toBe(150);
    expect(readGap('0', 'metric', 'en')).toBe(0);
    expect(readGap('12', 'metric', 'en')).toBeNull();
    expect(readGap('2', 'us', 'en')).toBeCloseTo(60.96);
    expect(readGap('40', 'us', 'en')).toBeNull();
  });

  it('keeps all of a deleted table but its id, for Undo', () => {
    const plan = planOf([table('t1', 600, 600, { sectionId: 's1', unusableSeats: [3] })]);

    expect(restoredOf(items(plan)[0]!)).toEqual({
      kind: 'table',
      name: 'Table 1',
      sectionId: 's1',
      xCm: 600,
      yCm: 600,
      shape: 'round',
      seats: 10,
      widthCm: 180,
      lengthCm: 180,
      endSeats: 0,
      rotation: 0,
      unusableSeats: [3],
    });
  });
});
