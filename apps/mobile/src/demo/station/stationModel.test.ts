import { describe, expect, it } from 'vitest';

import {
  CONFIRM_LEAD,
  EMPTY,
  ROSTER,
  RUN_OUT,
  STATIONS,
  STATION_STATES,
  type StationState,
  armRunOutRival,
  askRunOut,
  at,
  canUndo,
  cancelRunOut,
  confirmRunOut,
  faced,
  flaggedCount,
  fresh,
  giveTray,
  goOnline,
  headingTrays,
  hereLine,
  hereSince,
  hereTrays,
  leadServes,
  leftToDish,
  markAvailable,
  markPreparing,
  markReady,
  movedTo,
  notSentLine,
  offers,
  pick,
  pickedLine,
  route,
  runOutQuestion,
  runOutWorld,
  seed,
  stateLine,
  stillNeed,
  stillNeedLine,
  strip,
  takeToTable,
  takenLine,
  trayCounts,
  undo,
  undoLine,
  wait,
  waiterMarks,
  waitingLine,
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

  it('says how long Undo lasts beside it', () => {
    expect(undoLine('Preparing', at(19, 42))).toBe('Marked Preparing at 19:42 · for 2 minutes');
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

  it('reads each tray with its arrival, the first here on top', () => {
    const s = seed('twoHere');
    const [first, second] = hereTrays(s);
    if (first == null || second == null) throw new Error('two trays here');
    expect(hereLine(first, 'fryer')).toBe('Kunle Ajayi · 3 plates · here since 19:36');
    expect(hereLine(second, 'fryer')).toBe('Funmi Bakare · 3 plates · here since 19:40');
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
    expect(faced(fresh(), t7).map((r) => r.marked)).toEqual([
      {},
      { Plantain: 'off' },
      { Plantain: 'on' },
    ]);
    const s = markPreparing(fresh(), 'Plantain', 10);
    expect(faced(s, t7).map((r) => r.preparing)).toEqual([
      ['Plantain'],
      ['Plantain'],
      ['Plantain'],
    ]);
  });

  it('marks each item on a plate by itself, so an unmarked one still shows Preparing', () => {
    const tray = {
      id: 'tg',
      label: 'Table 5',
      waiter: 'Kunle Ajayi',
      startedAt: at(19, 40),
      paused: false,
      taken: false,
      plates: [
        {
          seat: 'Seat 1',
          dish: 'Mixed grill',
          flags: [],
          stage: 'Dishing' as const,
          marks: { Chicken: { v: 'on' as const, at: at(19, 41) } },
        },
      ],
    };
    const s = markPreparing({ ...fresh(), station: 'grill', trays: [tray] }, 'Grilled fish', 10);
    const [row] = faced(s, tray);
    expect(row?.marked).toEqual({ Chicken: 'on' });
    expect(row?.preparing).toEqual(['Grilled fish']);
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

  it('says once that the station is open here and nobody’s station changed', () => {
    const s = pick(seed('pick'), 'grill');
    expect(s.moved).toBe('Grill is open on this tablet. Nobody’s station changed.');
    expect(pickedLine('pass')).toBe('Pass is open on this tablet. Nobody’s station changed.');
  });

  it('follows a move by Team with one line', () => {
    expect(movedTo(fresh(), 'grill').moved).toBe('You’re on Grill now.');
  });
});

describe('the states the boards draw', () => {
  it('seeds every one', () => {
    for (const name of STATION_STATES) {
      const grill = name.startsWith('runOut') && name !== 'runOutEarlier';
      expect(seed(name).now).toBe(grill ? RUN_OUT.at : at(19, 42));
    }
  });
});

describe('run out, at the station that dishes it (sc-59384)', () => {
  const chicken = RUN_OUT.item;
  const fish = RUN_OUT.substitute;
  const out = () => confirmRunOut(askRunOut(runOutWorld(), chicken));
  const line = (s: StationState, item: string) => leftToDish(s).find((l) => l.item === item)?.n;

  it('is offered only on this station’s own items', () => {
    const s = runOutWorld();
    expect(leftToDish(s).map((l) => l.item)).toEqual([chicken, fish]);
    expect(offers(s, chicken).runOut).toBe(true);
    expect(offers(s, fish).runOut).toBe(true);
    expect(offers(s, 'Jollof rice').runOut).toBe(false);
    expect(askRunOut(s, 'Jollof rice')).toBe(s);
    expect(offers({ ...s, station: 'fryer' }, chicken).runOut).toBe(false);
  });

  it('asks first, counting the guests whose plate or owed item still needs it', () => {
    const s = askRunOut(runOutWorld(), chicken);
    expect(s.confirming).toBe(chicken);
    expect(runOutQuestion(chicken)).toBe('Run out of Chicken for the rest of the event?');
    expect(stillNeedLine(stillNeed(s, chicken))).toBe('11 guests still need it.');
    expect(stillNeedLine(1)).toBe('1 guest still needs it.');
    expect(CONFIRM_LEAD).toBe('The floor lead chooses what they get instead.');
  });

  it('counts an owed plate, and never one marked On before it ran out', () => {
    const s = runOutWorld();
    const [t9] = s.trays;
    const [kept] = s.waiting;
    if (t9 == null || kept == null) throw new Error('the Grill’s sample');
    const owed = { ...kept, flags: [], stage: 'Served' as const, owed: true };
    expect(stillNeed({ ...s, waiting: [...s.waiting, owed] }, chicken)).toBe(12);
    expect(faced(out(), t9).find((r) => r.seat === 'Seat 3')).toMatchObject({
      marked: { Chicken: 'on' },
    });
  });

  it('changes nothing on Cancel', () => {
    const s = cancelRunOut(askRunOut(runOutWorld(), chicken));
    expect(s.confirming).toBeNull();
    expect(s.items).toEqual({});
  });

  it('is stored with its time and who marked it, and reads its line in place of the count to dish', () => {
    const s = out();
    expect(s.items[chicken]).toEqual({ kind: 'runOut', at: RUN_OUT.at, by: RUN_OUT.by });
    expect(stateLine(s, chicken)).toEqual({
      word: 'Run out',
      line: 'Run out · 20:06',
      waiting: '11 waiting for a choice',
    });
    expect(waitingLine(1)).toBe('1 waiting for a choice');
  });

  it('offers neither Ready nor Preparing while run out, and refuses both', () => {
    const s = out();
    expect(offers(s, chicken)).toEqual({
      ready: false,
      preparing: false,
      runOut: false,
      available: true,
    });
    expect(markReady(s, chicken)).toBe(s);
    expect(markPreparing(s, chicken, 10)).toBe(s);
    expect(stateLine(s, chicken).word).toBe('Run out');
  });

  it('refuses Run out twice, naming who marked it and when, and changes nothing', () => {
    const s = seed('runOutTaken');
    expect(s.you).toBe(RUN_OUT.other);
    expect(s.items[chicken]).toEqual({ kind: 'runOut', at: RUN_OUT.at, by: RUN_OUT.by });
    expect(s.notice?.line).toBe(
      'Chicken was already marked run out by Tayo Bamidele at 20:06. Nothing changed.',
    );
    const again = { ...out(), confirming: chicken };
    expect(confirmRunOut(again).items[chicken]).toEqual(out().items[chicken]);
    expect(takenLine(chicken, RUN_OUT.by, RUN_OUT.at)).toBe(confirmRunOut(again).notice?.line);
  });

  it('meets the 409 when another disher marks it first', () => {
    const s = armRunOutRival(wait(askRunOut(runOutWorld(), chicken), 1), chicken);
    const done = confirmRunOut(s);
    expect(done.items[chicken]).toEqual({ kind: 'runOut', at: at(20, 7), by: RUN_OUT.other });
    expect(done.notice?.line).toBe(
      'Chicken was already marked run out by Segun Afolabi at 20:07. Nothing changed.',
    );
  });

  it('counts the guests waiting for a choice', () => {
    expect(line(out(), chicken)).toBe(11);
    const s = waiterMarks(out(), 'off');
    expect(line(s, chicken)).toBe(11);
  });

  it('gives it back as Ready with Mark available again, no confirmation', () => {
    const s = markAvailable(out(), chicken);
    expect(stateLine(s, chicken).word).toBe('Ready');
    expect(offers(s, chicken).runOut).toBe(true);
    const ready = runOutWorld();
    expect(markAvailable(ready, chicken)).toBe(ready);
  });

  it('refuses offline, on the device, and keeps nothing', () => {
    const s = seed('runOutOffline');
    expect(s.confirming).toBeNull();
    expect(s.items).toEqual({});
    expect(s.kept).toEqual([]);
    expect(s.notice?.line).toBe(
      'Needs a connection to mark Chicken run out. Nothing is kept to send later.',
    );
    const lost = confirmRunOut({ ...askRunOut(runOutWorld(), chicken), online: false });
    expect(lost.items).toEqual({});
    expect(lost.kept).toEqual([]);
    const back = markAvailable({ ...out(), online: false }, chicken);
    expect(back.items[chicken]?.kind).toBe('runOut');
    expect(back.kept).toEqual([]);
    expect(back.notice?.line).toBe(
      'Needs a connection to mark Chicken available again. Nothing is kept to send later.',
    );
  });

  it('keeps Ready and Preparing’s own offline behaviour', () => {
    const s = markPreparing({ ...runOutWorld(), online: false }, fish, 10);
    expect(s.kept.map((k) => k.item)).toEqual([fish]);
  });

  it('reads Run out on a plate as you face it, seats and flags only', () => {
    const s = seed('runOutFaced');
    const [tray] = hereTrays(s);
    if (tray == null) throw new Error('Table 9');
    const rows = faced(s, tray);
    expect(rows.map((r) => [r.seat, r.runOut, r.marked])).toEqual([
      ['Seat 6', [chicken], { Chicken: 'off' }],
      ['Seat 4', [chicken], {}],
      ['Seat 3', [chicken], { Chicken: 'on' }],
      ['Seat 2', [chicken], {}],
      ['Seat 1', [chicken], {}],
    ]);
    for (const row of rows) expect(Object.keys(row)).not.toContain('name');
  });

  it('counts a replacement dished here in its own item’s to dish as soon as it is chosen', () => {
    const s = out();
    expect(line(s, fish)).toBe(4);
    const served = leadServes(s, chicken, fish, RUN_OUT.served);
    expect(line(served, fish)).toBe(7);
    expect(line(served, chicken)).toBe(8);
    const [tray] = hereTrays(served);
    if (tray == null) throw new Error('Table 9');
    expect(faced(served, tray).map((r) => r.items)).toEqual([
      [fish],
      [fish],
      [chicken],
      [chicken],
      [chicken],
    ]);
  });

  it('never chooses for a flagged guest, and changed guests keep theirs once it is available again', () => {
    const served = leadServes(out(), chicken, fish, 20);
    expect(line(served, chicken)).toBe(4);
    const back = markAvailable(served, chicken);
    expect(line(back, chicken)).toBe(4);
    expect(line(back, fish)).toBe(11);
    expect(leadServes(runOutWorld(), chicken, fish, 3)).toEqual(runOutWorld());
  });

  it('keeps the line with no count once nobody waits, until Mark available again (pm, 17 Nov)', () => {
    const none = { ...out(), trays: [], waiting: [] };
    expect(leftToDish(none).map((l) => l.item)).toContain(chicken);
    expect(stateLine(none, chicken)).toEqual({
      word: 'Run out',
      line: 'Run out · 20:06',
      waiting: '',
    });
    expect(offers(none, chicken).available).toBe(true);
  });

  it('is offered on an earlier course’s item while Left to dish lists it (pm, 17 Nov)', () => {
    const s = fresh();
    expect(leftToDish(s).find((l) => l.item === 'Small chops')?.label).toBe(
      'Starter · Small chops',
    );
    expect(offers(s, 'Small chops').runOut).toBe(true);
    const marked = seed('runOutEarlier');
    expect(stateLine(marked, 'Small chops')).toEqual({
      word: 'Run out',
      line: 'Run out · 19:42',
      waiting: '1 waiting for a choice',
    });
    expect(offers(marked, 'Plantain')).toMatchObject({ ready: true, runOut: true });
  });
});
