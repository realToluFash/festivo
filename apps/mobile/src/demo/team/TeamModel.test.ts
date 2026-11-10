import { describe, expect, it } from 'vitest';

import { placedOn, trayToFinish, waiterNext } from '../queue/QueueModel.ts';

import {
  CHOOSE_LINE,
  NEED_LINE,
  TEAM_STATES,
  candidates,
  choiceFor,
  choose,
  chooseMode,
  dishTrays,
  fresh,
  goOnline,
  dismiss,
  move,
  onPlace,
  openSheet,
  seed,
  stationsOf,
  tryOffline,
} from './TeamModel.ts';

describe('who the Move sheet offers', () => {
  it('offers a section to the floor and to those who run it, never the pass or the door', () => {
    const names = candidates(fresh(), 'C').map((p) => p.name);
    expect(names).toEqual([
      'Yinka Hassan',
      'Ifeoma Nduka',
      'Kunle Ajayi',
      'Funmi Bakare',
      'Grace Udo',
      'Chidi Okafor',
    ]);
  });

  it('offers a kitchen station to the pass only, and never someone not in Here', () => {
    const names = candidates(fresh(), 'fryer').map((p) => p.name);
    expect(names).not.toContain('Kunle Ajayi');
    expect(names).not.toContain('Tolu Bello');
    expect(names).not.toContain('Emeka Obi');
    expect(names).not.toContain('Gbenga Salami');
    expect(names.slice(0, 3)).toEqual(['Yinka Hassan', 'Ifeoma Nduka', 'Ada Nnaji']);
  });
});

describe('As well and Instead', () => {
  it('starts on As well for someone on one station', () => {
    const choice = choiceFor(choose(openSheet(fresh(), 'C'), 'Kunle Ajayi'));
    expect(choice?.modes).toEqual(['well', 'instead']);
    expect(choice?.mode).toBe('well');
    expect(choice?.leaves).toBe('');
  });

  it('asks nothing of someone on no station', () => {
    expect(choiceFor(choose(openSheet(fresh(), 'C'), 'Yinka Hassan'))).toBeNull();
  });

  it('offers Instead only to someone on two, and says what it leaves', () => {
    const choice = choiceFor(choose(openSheet(fresh(), 'fryer'), 'Bisi Okon'));
    expect(choice?.modes).toEqual(['instead']);
    expect(choice?.leaves).toBe(
      'Leaves Rice · Jollof with nobody. Leaves Rice · Fried with nobody.',
    );
  });

  it('keeps the started tray with its waiter on Instead', () => {
    const s = chooseMode(choose(openSheet(fresh(), 'C'), 'Kunle Ajayi'), 'instead');
    expect(choiceFor(s)?.tray).toBe(
      'Kunle finishes the tray already out to Table 4. Their next tray comes from Section C.',
    );
  });
});

describe('the move', () => {
  it('refuses Put with nobody chosen', () => {
    const s = move(openSheet(fresh(), 'C'));
    expect(s.sheet?.refused).toBe(true);
    expect(s.say).toBe(CHOOSE_LINE);
  });

  it('adds the station on As well', () => {
    const s = seed('movedAsWell');
    expect(stationsOf(s, 'Kunle Ajayi')).toEqual(['A', 'C']);
    expect(s.say).toBe('Kunle Ajayi is on Section C.');
    expect(s.lines['Kunle Ajayi']).toBe('You’re on Section C now, as well as Section A.');
  });

  it('leaves every station on Instead and says which it empties', () => {
    const s = seed('movedInstead');
    expect(stationsOf(s, 'Kunle Ajayi')).toEqual(['C']);
    expect(s.say).toBe('Kunle Ajayi is on Section C. Nobody on Section A.');
    expect(onPlace(s, 'A')).toEqual([]);
  });

  it('is a 409 when another lead moved them first', () => {
    const s = seed('conflict');
    expect(s.notice).toEqual({
      kind: 'conflict',
      who: 'Grace Udo',
      by: 'Tobi Adeyemi',
      to: 'D',
      place: 'C',
    });
    expect(onPlace(s, 'D')).toContain('Grace Udo');
    expect(onPlace(s, 'C')).toEqual([]);
  });

  it('sends focus back to the place being moved to on Got it', () => {
    const s = dismiss(seed('conflict'));
    expect(s.notice).toBeNull();
    expect(s.focus).toBe('row|C');
  });

  it('makes nothing offline and queues nothing', () => {
    const s = tryOffline(goOnline(fresh(), false), 'C');
    expect(s.say).toBe(NEED_LINE);
    expect(s.on).toEqual(fresh().on);
  });
});

describe('the moved person’s screens', () => {
  it('takes the waiter’s Next from the Queue’s own rule, owed first across both', () => {
    const s = seed('movedAsWell');
    const q = placedOn(['A', 'C'], s.lines['Kunle Ajayi'] ?? '');
    expect(q.line).toBe('You’re on Section C now, as well as Section A.');
    expect(waiterNext(q)).toEqual({ place: 'Table 10', section: 'A', owed: true });
    expect(trayToFinish(q)).toBeNull();
  });

  it('keeps the started tray after Instead', () => {
    const q = placedOn(['C'], seed('movedInstead').lines['Kunle Ajayi'] ?? '');
    expect(q.line).toBe('You’re on Section C now.');
    expect(waiterNext(q)?.place).toBe('Table 12');
    expect(trayToFinish(q)?.place.name).toBe('Table 4');
    expect(trayToFinish(q)?.section).toBe('A');
  });

  it('names each tray’s station for a disher on two', () => {
    const { stations, trays } = dishTrays(seed('movedKitchen'), 'Tayo Bamidele');
    expect(stations).toEqual(['grill', 'fryer']);
    expect(trays.map((t) => t.station)).toEqual(['grill', 'fryer', 'grill', 'fryer']);
  });
});

describe('Team from an alert', () => {
  it('opens on the place left with nobody', () => {
    const s = seed('fromAlert');
    expect(onPlace(s, 'A')).toEqual([]);
    expect(s.opened).toBe('A');
    expect(s.focus).toBe('row|A');
  });
});

describe('every state', () => {
  it('seeds without throwing', () => {
    for (const name of TEAM_STATES) expect(seed(name).say).toBeTypeOf('string');
  });
});
