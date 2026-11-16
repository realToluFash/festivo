import { describe, expect, it } from 'vitest';

import {
  EMPTY,
  ROSTER,
  STATIONS,
  STATION_STATES,
  at,
  canUndo,
  faced,
  flaggedCount,
  fresh,
  giveTray,
  goOnline,
  headingTrays,
  hereSince,
  hereTrays,
  leftToDish,
  markPreparing,
  markReady,
  movedTo,
  notSentLine,
  pick,
  route,
  seed,
  stateLine,
  strip,
  takeToTable,
  trayCounts,
  undo,
  wait,
  waiterMarks,
  walkHere,
  whoLine,
} from './stationModel.ts';

const labels = (trays: readonly { label: string }[]) => trays.map((t) => t.label);

describe('what a station dishes', () => {
  it('lists only its own items, in the menu’s order, then an earlier course’s while a plate needs it', () => {
    expect(leftToDish(fresh())).toEqual([
      { item: 'Plantain', label: 'Plantain', n: 24 },
      { item: 'Small chops', label: 'Starter · Small chops', n: 1 },
    ]);
  });

  it('gives the Pass the items no station dishes, and Chef’s choice', () => {
    expect(leftToDish({ ...fresh(), station: 'pass' }).map((l) => l.item)).toEqual([
      'Moin moin',
      'Chef’s choice',
    ]);
  });

  it('counts plates not yet marked On here: a Not on still counts, an On and a Served plate do not', () => {
    const s = fresh();
    const plantain = (x: typeof s) => leftToDish(x).find((l) => l.item === 'Plantain')?.n;
    expect(plantain(s)).toBe(24);
    expect(plantain(waiterMarks(s, 'on'))).toBe(23);
    expect(plantain(waiterMarks(s, 'off'))).toBe(24);
  });

  it('drops an earlier course’s item once no plate needs it', () => {
    let s = fresh();
    s = waiterMarks(waiterMarks(waiterMarks(s, 'on'), 'on'), 'on');
    expect(leftToDish(s).map((l) => l.label)).toEqual(['Plantain']);
  });
});

describe('Ready or Preparing', () => {
  it('reads Preparing with each time, and with none', () => {
    const s = fresh();
    for (const eta of [5, 10, 15] as const) {
      expect(stateLine(markPreparing(s, 'Plantain', eta), 'Plantain')).toEqual({
        word: 'Preparing',
        line: `ready in about ${eta} min`,
        waiting: '4 waiting',
      });
    }
    expect(stateLine(markPreparing(s, 'Plantain', null), 'Plantain').line).toBe('');
  });

  it('replaces the time with a new one, and Ready puts it back', () => {
    const s = markPreparing(markPreparing(fresh(), 'Plantain', 5), 'Plantain', 15);
    expect(stateLine(s, 'Plantain').line).toBe('ready in about 15 min');
    expect(stateLine(markReady(s, 'Plantain'), 'Plantain').word).toBe('Ready');
  });

  it('is Held up at its disher’s time, not a minute before, counted from the first Preparing', () => {
    const s = markPreparing(fresh(), 'Plantain', 10);
    expect(stateLine(wait(s, 9), 'Plantain').word).toBe('Preparing');
    expect(stateLine(wait(s, 10), 'Plantain')).toEqual({
      word: 'Held up',
      line: '10 min',
      waiting: '4 waiting',
    });
  });

  it('is Held up 15 minutes after a Preparing with no time', () => {
    const s = markPreparing(fresh(), 'Plantain', null);
    expect(stateLine(wait(s, 14), 'Plantain').word).toBe('Preparing');
    expect(stateLine(wait(s, 15), 'Plantain').word).toBe('Held up');
    expect(stateLine(seed('heldUp'), 'Small chops')).toEqual({
      word: 'Held up',
      line: '22 min',
      waiting: '1 waiting',
    });
  });

  it('is never Held up while it holds nobody', () => {
    const s = { ...markPreparing(fresh(), 'Plantain', 5), held: {} };
    expect(stateLine(wait(s, 30), 'Plantain').word).toBe('Preparing');
  });

  it('offers Undo for 2 minutes, then not', () => {
    const s = markPreparing(fresh(), 'Plantain', 10);
    expect(canUndo(wait(s, 1), 'Plantain')).toBe(true);
    expect(stateLine(undo(wait(s, 1), 'Plantain'), 'Plantain').word).toBe('Ready');
    expect(canUndo(wait(s, 2), 'Plantain')).toBe(false);
    expect(stateLine(undo(wait(s, 2), 'Plantain'), 'Plantain').word).toBe('Preparing');
  });
});

describe('Heading here', () => {
  it('lists started trays not here yet, the oldest started first, paused ones kept', () => {
    const s = fresh();
    expect(labels(headingTrays(s))).toEqual(['Table 9', 'Row B', 'Table 12', 'Table 2']);
    expect(headingTrays(s).find((t) => t.label === 'Table 12')?.paused).toBe(true);
  });

  it('counts this station’s items and the flagged plates on each tray', () => {
    const rowB = fresh().trays.find((t) => t.label === 'Row B');
    if (rowB == null) throw new Error('Row B');
    expect(trayCounts(rowB, 'fryer')).toEqual([{ item: 'Plantain', n: 3 }]);
    expect(trayCounts(rowB, 'jollof')).toEqual([{ item: 'Jollof rice', n: 2 }]);
    expect(flaggedCount(rowB)).toBe(2);
  });

  it('shows a given tray’s new waiter', () => {
    const t9 = giveTray(fresh(), 'Table 9', 'Funmi Bakare').trays.find(
      (t) => t.label === 'Table 9',
    );
    expect(t9?.waiter).toBe('Funmi Bakare');
  });
});

describe('when a tray is here', () => {
  it('routes the Pass first, then the walking order', () => {
    const t4 = fresh().trays[0];
    if (t4 == null) throw new Error('Table 4');
    expect(route(t4)).toEqual(['pass', 'jollof', 'fried', 'grill', 'fryer']);
  });

  it('is here once every stop before this one is marked', () => {
    const t4 = fresh().trays[0];
    if (t4 == null) throw new Error('Table 4');
    expect(hereSince(t4, 'fryer')).toBe(at(19, 36));
  });

  it('is here from a mark at this stop, even with an earlier stop unmarked', () => {
    const t7 = fresh().trays[1];
    if (t7 == null) throw new Error('Table 7');
    expect(hereSince(t7, 'grill')).toBeNull();
    expect(hereSince(t7, 'fryer')).toBe(at(19, 40));
  });

  it('is here at the Pass as it starts', () => {
    const s = { ...fresh(), station: 'pass' as const };
    expect(labels(hereTrays(s))).toEqual(['Row B', 'Table 2']);
    expect(headingTrays(s)).toEqual([]);
  });

  it('puts the earlier arrival on top', () => {
    expect(labels(hereTrays(fresh()))).toEqual(['Table 4', 'Table 7']);
  });

  it('arrives once, with one polite line', () => {
    const s = walkHere(seed('here'));
    expect(labels(hereTrays(s))).toEqual(['Table 4', 'Table 9']);
    expect(s.say).toBe('Table 9’s tray is here · 3 plates');
  });
});

describe('As you face it', () => {
  it('reverses the tray, so the owed plate put on first is faced last', () => {
    const t4 = fresh().trays[0];
    if (t4 == null) throw new Error('Table 4');
    const rows = faced(fresh(), t4);
    expect(rows.map((r) => r.seat)).toEqual(['Seat 3', 'Seat 1', 'Seat 6']);
    expect(rows[2]).toMatchObject({ owed: true, course: 'Starter', items: ['Small chops'] });
  });

  it('keeps a flagged plate in its place, with each flag in words', () => {
    const t4 = fresh().trays[0];
    if (t4 == null) throw new Error('Table 4');
    expect(faced(fresh(), t4)[0]).toMatchObject({
      seat: 'Seat 3',
      flags: ['Peanut allergy', 'Halal', 'Other · no onions'],
    });
  });

  it('gives the variant only when it is not one of the dish’s items', () => {
    const t4 = fresh().trays[0];
    if (t4 == null) throw new Error('Table 4');
    expect(faced(fresh(), t4)[1]).toMatchObject({ seat: 'Seat 1', variant: 'Child’s portion' });
  });

  it('shows the waiter’s On and Not on, and Preparing on each plate that needs it', () => {
    const t7 = fresh().trays[1];
    if (t7 == null) throw new Error('Table 7');
    expect(faced(fresh(), t7).map((r) => r.mark)).toEqual(['none', 'off', 'on']);
    const s = markPreparing(fresh(), 'Plantain', 10);
    expect(faced(s, t7).map((r) => r.preparing)).toEqual([
      ['Plantain'],
      ['Plantain'],
      ['Plantain'],
    ]);
  });

  it('never carries a guest’s name: seats and flags only', () => {
    const t4 = fresh().trays[0];
    if (t4 == null) throw new Error('Table 4');
    for (const row of faced(fresh(), t4)) expect(Object.keys(row)).not.toContain('name');
  });
});

describe('a tray leaves As you face it', () => {
  it('once every plate is marked here', () => {
    let s = seed('here');
    s = waiterMarks(waiterMarks(waiterMarks(s, 'on'), 'off'), 'on');
    expect(hereTrays(s)).toEqual([]);
  });

  it('once it is taken to the table', () => {
    expect(labels(hereTrays(takeToTable(fresh())))).toEqual(['Table 7']);
  });

  it('once its last plate needing this station is taken off', () => {
    const s = fresh();
    const t7 = s.trays[1];
    if (t7 == null) throw new Error('Table 7');
    const off = { ...t7, plates: t7.plates.filter((p) => p.seat !== 'Seat 4') };
    const next = { ...s, trays: s.trays.map((t) => (t.id === 't7' ? off : t)) };
    expect(labels(hereTrays(next))).toEqual(['Table 4']);
  });
});

describe('nothing to show is said in words', () => {
  it('before any course is fired', () => {
    const s = seed('noCourse');
    expect(leftToDish(s)).toEqual([]);
    expect(hereTrays(s)).toEqual([]);
    expect(EMPTY.noCourse).toMatch(/fired/);
  });

  it('with no tray heading here, and with nothing of this station fired', () => {
    expect(headingTrays(seed('nothingHeading'))).toEqual([]);
    expect(leftToDish(seed('noItem'))).toEqual([]);
    expect(EMPTY.noItem('grill')).toBe('Nothing on a fired course is dished at Grill.');
  });
});

describe('offline, by sc-4028', () => {
  it('keeps a mark, shown at once, with the strip’s count', () => {
    const s = seed('waitingToSend');
    expect(stateLine(s, 'Plantain').word).toBe('Preparing');
    expect(strip(s)).toBe('No connection · as of 19:40 · 1 tap waiting');
    expect(strip(goOnline(s, true))).toBe('Connected · up to date 19:42');
  });

  it('drops a kept mark another disher beat, with its Not sent line, and holds theirs', () => {
    const s = seed('notSent');
    expect(s.notSent.map((r) => notSentLine(s, r))).toEqual([
      'Plantain is preparing now, by Kemi Adebayo.',
    ]);
    expect(stateLine(s, 'Plantain').line).toBe('ready in about 15 min');
  });
});

describe('picking a station', () => {
  it('lists every kitchen station in the walking order, with who is on it', () => {
    expect(STATIONS.map((s) => whoLine(s.id))).toEqual([
      'Ronke Alade',
      'Bisi Okon',
      'Nobody on Rice · Fried',
      'Tayo Bamidele',
      'Gbenga Salami and Kemi Adebayo',
    ]);
  });

  it('opens the station and changes no roster', () => {
    const before = JSON.stringify(ROSTER);
    const s = pick(seed('noStation'), 'grill');
    expect(s.station).toBe('grill');
    expect(JSON.stringify(ROSTER)).toBe(before);
  });

  it('follows a move by Team with one line', () => {
    expect(movedTo(fresh(), 'grill').moved).toBe('You’re on Grill now.');
  });
});

describe('the states the boards draw', () => {
  it('seeds every one', () => {
    for (const name of STATION_STATES) expect(seed(name).now).toBe(at(19, 42));
  });
});
