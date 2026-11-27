import { describe, expect, it } from 'vitest';

import {
  type Notes,
  NO_NOTES,
  NO_PROPOSAL,
  SAMPLE_NOTES,
  accepted,
  changedTables,
  changedWords,
  propose,
  proposedGuests,
  proposedTables,
  readyWords,
  stampOf,
  tidied,
  timeOf,
} from './autoSeat.ts';
import { acceptUi, discardUi } from './autoSeatUi.ts';
import {
  type Item,
  type Party,
  type Plan,
  emptyChairs,
  samplePlan,
  sampleTray,
} from './seating.ts';
import { freshUi, proposedUi } from './seatingSeed.ts';
import { PRIYA, YOU } from './seating.ts';

function round(
  id: string,
  x: number,
  y: number,
  seats: number,
  taken: readonly string[] = [],
): Item {
  return {
    id,
    kind: 'round',
    name: id,
    x,
    y,
    d: 180,
    rot: 0,
    sec: null,
    chairs: emptyChairs(seats).map((chair, k) =>
      taken[k] == null ? chair : { state: 'taken', who: taken[k] },
    ),
  };
}

function plan(items: Item[]): Plan {
  return { room: { name: 'Hall', w: 3000, l: 3000 }, items, sections: [] };
}

function party(id: string, n: number, group: string | null = null): Party {
  return {
    id,
    name: id,
    companions: Array.from({ length: n - 1 }, (_, k) => `${id}+${k + 1}`),
    group,
    reply: 'coming',
  };
}

function where(result: Plan): Record<string, string> {
  return Object.fromEntries(
    result.items.flatMap((item) =>
      item.chairs.flatMap((chair) =>
        chair.proposed == null ? [] : [[chair.proposed, item.id] as [string, string]],
      ),
    ),
  );
}

describe('Auto-seat by group’s rules (sc-4019, Decided 19 Oct)', () => {
  it('never moves anyone seated: only empty chairs are proposed', () => {
    const start = plan([round('a', 0, 0, 4, ['Ada', 'Ben'])]);
    const { plan: next } = propose(start, [party('c', 2)]);

    expect(next.items[0]!.chairs.slice(0, 2)).toEqual(start.items[0]!.chairs.slice(0, 2));
    expect(next.items[0]!.chairs.filter((chair) => chair.proposed != null)).toHaveLength(2);
  });

  it('never splits a party, and says so when no table has its seats together', () => {
    const start = plan([round('a', 0, 0, 4, ['x', undefined!, 'y']), round('b', 400, 0, 2)]);
    const { plan: next, left } = propose(start, [party('trio', 3)]);

    expect(proposedGuests(next)).toBe(0);
    expect(left).toEqual([{ party: 'trio', reason: 'together' }]);
  });

  it('keeps an Apart note and an access need, with each reason', () => {
    const start = plan([round('a', 0, 0, 4, ['Ada']), round('b', 400, 0, 4)]);
    const notes: Notes = {
      apart: { p: ['Ada', 'q'] },
      together: {},
      exit: ['r'],
      nearExit: ['a'],
    };
    const { plan: next, left } = propose(
      {
        ...start,
        items: [
          start.items[0]!,
          { ...start.items[1]!, chairs: [{ state: 'taken', who: 'q' }, ...emptyChairs(3)] },
        ],
      },
      [party('p', 1), party('r', 1)],
      notes,
    );

    expect(where(next)).toEqual({ r: 'a' });
    expect(left).toEqual([{ party: 'p', reason: 'apart' }]);

    const full = propose(
      plan([round('a', 0, 0, 1, ['Ada']), round('b', 400, 0, 2)]),
      [party('r', 1)],
      notes,
    );

    expect(full.left).toEqual([{ party: 'r', reason: 'exit' }]);
  });

  it('keeps a group at the fewest tables, and honours Together notes where they fit', () => {
    const start = plan([round('a', 0, 0, 3), round('b', 400, 0, 6), round('c', 800, 0, 6)]);
    const { plan: next } = propose(start, [party('f1', 2, 'Friends'), party('f2', 2, 'Friends')]);

    expect(where(next)).toMatchObject({ f1: 'b', f2: 'b' });

    const notes: Notes = { ...NO_NOTES, together: { solo: ['Ada'] } };
    const withAda = plan([round('a', 0, 0, 4), round('b', 400, 0, 4, ['Ada'])]);

    expect(where(propose(withAda, [party('solo', 1)], notes).plan)).toEqual({ solo: 'b' });
  });

  it('fills tables in reading order: top to bottom, then left to right', () => {
    const start = plan([
      round('low', 0, 900, 2),
      round('right', 900, 0, 2),
      round('left', 0, 0, 2),
    ]);
    const { plan: next } = propose(start, [party('a', 2), party('b', 2), party('c', 2)]);

    expect(where(next)).toMatchObject({ a: 'left', b: 'right', c: 'low' });
  });

  it('gives the same proposal twice on the same plan and guest list', () => {
    const one = propose(samplePlan(), sampleTray(), SAMPLE_NOTES);
    const two = propose(samplePlan(), sampleTray(), SAMPLE_NOTES);

    expect(two).toEqual(one);
  });

  it('proposes 500 guests at 60 tables in under 3 seconds', () => {
    const tables = Array.from({ length: 60 }, (_, k) =>
      round(`t${k}`, (k % 10) * 300, Math.floor(k / 10) * 300, 10),
    );
    const guests = Array.from({ length: 200 }, (_, k) =>
      party(`p${k}`, [2, 3, 2, 3, 3][k % 5]!, ['A', 'B', 'C', null][k % 4]),
    );
    const started = performance.now();
    const { plan: next } = propose(plan(tables), guests);

    expect(performance.now() - started).toBeLessThan(3000);
    expect(guests.reduce((sum, one) => sum + one.companions.length + 1, 0)).toBe(520);
    expect(proposedGuests(next)).toBeGreaterThan(450);
  });
});

describe('the wedding’s proposal', () => {
  it('places 11 guests at Tables 8 and 10 and leaves Marta Silva over for the exit', () => {
    const { plan: next, left } = propose(samplePlan(), sampleTray(), SAMPLE_NOTES);

    expect(proposedTables(next).map((item) => item.name)).toEqual(['Table 8', 'Table 10']);
    expect(proposedGuests(next)).toBe(11);
    expect(left).toEqual([{ party: 'marta', reason: 'exit' }]);
  });

  it('counts proposed seats as free and keeps the guests in Without a seat', () => {
    const ui = proposedUi(freshUi(), YOU, '2026-11-03T20:14:00Z');
    const t8 = ui.plan.items.find((item) => item.id === 't8')!;

    expect(t8.chairs.filter((chair) => chair.state === 'empty')).toHaveLength(5);
    expect(ui.tray).toEqual(freshUi().tray);
    expect(ui.spoken).toBe('Proposal ready: 11 guests at 2 tables. 1 guest is left over.');
  });

  it('says the time in 24 hours, in the event’s time zone', () => {
    expect(timeOf('2026-11-03T20:14:00Z')).toBe('20:14');
  });
});

describe('accepting and discarding', () => {
  const start = () => proposedUi(freshUi(), YOU, '2026-11-03T20:14:00Z');

  it('seats a table exactly as proposed, with Undo', () => {
    const next = acceptUi(start(), ['t8']);
    const t8 = next.plan.items.find((item) => item.id === 't8')!;

    expect(t8.chairs.slice(5, 8).map((chair) => [chair.state, chair.who])).toEqual([
      ['taken', 'Amaka Eze'],
      ['taken', 'Guest of Amaka Eze'],
      ['taken', 'Guest of Amaka Eze'],
    ]);
    expect(next.tray.some((party) => party.id === 'amaka')).toBe(false);
    expect(next.bar).toEqual({ kind: 'undo', words: '3 guests seated at 1 table.', does: 'undo' });
    expect(next.undo?.auto).toEqual(start().auto);
  });

  it('refuses a table changed since, and Accept all seats only the rest', () => {
    const was = start();
    const changed = {
      ...was,
      plan: {
        ...was.plan,
        items: was.plan.items.map((item) =>
          item.id === 't8'
            ? {
                ...item,
                chairs: item.chairs.map((chair, k) =>
                  k === 9 ? { state: 'taken' as const, who: 'Hugo Lambert' } : chair,
                ),
              }
            : item,
        ),
      },
    };

    expect(changedTables(changed.plan, changed.auto).map((item) => item.id)).toEqual(['t8']);
    const one = acceptUi(changed, ['t8']);

    expect(one.plan).toBe(changed.plan);
    expect(one.bar?.words).toBe(
      'Table 8 has changed since this was proposed. Run Auto-seat again.',
    );

    const all = acceptUi(changed, null);

    expect(all.bar?.words).toBe(
      '8 guests seated at 1 table. Table 8 has changed since this was proposed. Run Auto-seat again.',
    );
    expect(proposedTables(all.plan).map((item) => item.id)).toEqual(['t8']);
  });

  it('names several changed tables in reading order, joined as a list', () => {
    const items = samplePlan().items.filter((item) => ['t10', 't4'].includes(item.id));

    expect(changedWords(readyOrder(items))).toBe(
      'Table 4 and Table 10 have changed since this was proposed. Run Auto-seat again.',
    );
  });

  it('discards a table or the whole proposal, with no Undo', () => {
    const one = discardUi(start(), 't10');

    expect(proposedTables(one.plan).map((item) => item.id)).toEqual(['t8']);
    expect(one.undo).toBeNull();
    const all = discardUi(one, null);

    expect(proposedGuests(all.plan)).toBe(0);
    expect(all.auto).toEqual(NO_PROPOSAL);
  });

  it('drops a guest seated by hand from the proposal, and a proposal with nothing left', () => {
    const was = start();
    const tray = was.tray.filter((party) => party.id !== 'amaka');
    const next = tidied(was.plan, tray, was.auto);

    expect(proposedTables(next.plan).map((item) => item.id)).toEqual(['t10']);
    const none = tidied(next.plan, [], next.auto);

    expect(none.auto.by).toBeNull();
  });

  it('accepts by the stamp: a table only proposed on is unchanged', () => {
    const was = start();
    const t10 = was.plan.items.find((item) => item.id === 't10')!;

    expect(was.auto.stamps.t10).toBe(stampOf(t10));
    expect(accepted(was.plan, was.tray, ['t10']).guests).toBe(8);
  });

  it('replaces another editor’s proposal', () => {
    const theirs = proposedUi(freshUi(), PRIYA, '2026-11-03T19:52:00Z');
    const mine = proposedUi(theirs, YOU, '2026-11-03T20:14:00Z');

    expect(mine.auto.by).toBe(YOU.name);
    expect(mine.plan).toEqual(start().plan);
    expect(readyWords(1, 1, 0)).toBe('Proposal ready: 1 guest at 1 table.');
  });
});

function readyOrder(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}
