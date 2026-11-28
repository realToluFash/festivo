import { describe, expect, it } from 'vitest';

import {
  NOTHING_ELSE,
  REQUEST_OFFLINE,
  START_OFFLINE,
  TRAY_STATES,
  allServed,
  bringAfter,
  canBringAfter,
  carryOn,
  check,
  chooseHeld,
  flaggedOffline,
  goNext,
  goOffline,
  guestOf,
  heldAt,
  mark,
  nextTray,
  pause,
  plateOf,
  reasonFor,
  reconnect,
  route,
  seed,
  sendBack,
  setPerTrip,
  startDecline,
  sendDecline,
  startTray,
  stripLine,
  tableOrder,
  takeOff,
  takeRequest,
  takeToTable,
  tick,
  trayPlates,
  trayStateOf,
  undo,
  unsettled,
  waitingOnKitchen,
} from './nextTrayModel.ts';

const names = (plates: readonly { guest: string }[]) => plates.map((p) => guestOf(p.guest).name);

describe('the next tray', () => {
  it('puts Table 2 before Table 10', () => {
    expect(tableOrder(['Table 10', 'Table 4', 'Table 2'])).toEqual([
      'Table 2',
      'Table 4',
      'Table 10',
    ]);
  });

  it('goes to the table with the oldest owed plate, owed first, then seat order, up to plates per trip', () => {
    const offer = nextTray(seed('nextTray'));
    expect(offer?.table).toBe('Table 4');
    expect(names(offer?.plates ?? [])).toEqual(['Kunle Ade', 'Ada Obi', 'Hauwa Sani']);
  });

  it('leaves held guests and a guest on another waiter’s tray off it', () => {
    const offer = nextTray(setPerTrip(seed('nextTray'), 8));
    expect(names(offer?.plates ?? [])).toEqual([
      'Kunle Ade',
      'Ada Obi',
      'Hauwa Sani',
      'Dapo Ojo',
      'Emeka Obi',
      'Yemi Alabi',
    ]);
  });

  it('makes the offered tray again at once for a new number, from 1 to 8 only', () => {
    const s = seed('nextTray');
    expect(nextTray(setPerTrip(s, 1))?.plates).toHaveLength(1);
    expect(setPerTrip(setPerTrip(s, 1), 0).perTrip).toBe(1);
    expect(setPerTrip(setPerTrip(s, 8), 9).perTrip).toBe(8);
  });

  it('applies a new number to the next tray only', () => {
    const s = setPerTrip(startTray(seed('nextTray')), 1);
    expect(trayPlates(s)).toHaveLength(3);
  });

  it('goes to the first table in table order once nothing is owed', () => {
    const s = seed('nextTray');
    const none = {
      ...s,
      plates: s.plates.filter((p) => p.owed == null && guestOf(p.guest).table !== 'Table 4'),
    };
    expect(nextTray(none)?.table).toBe('Table 2');
  });

  it('offers no tray while one is in hand', () => {
    expect(nextTray(seed('route'))).toBeNull();
  });
});

describe('the route', () => {
  it('starts at the Pass, then each station in walking order', () => {
    expect(route(seed('route')).map((st) => st.station.name)).toEqual([
      'Pass',
      'Rice · Jollof',
      'Grill',
    ]);
  });

  it('leaves an item to follow with no mark, and never unsettled', () => {
    const s = seed('route');
    const hs = plateOf(s, 'hs');
    expect(hs.items.find((i) => i.name === 'Plantain')?.follow).toBe(true);
    expect(unsettled(s).some((u) => u.plate.id === 'hs' && u.item === 'Plantain')).toBe(false);
  });

  it('marks in any order and changes a mark before the check', () => {
    let s = seed('route');
    s = mark(s, 'ao', 'Chicken', 'notOn');
    s = mark(s, 'ao', 'Chicken', 'on');
    expect(plateOf(s, 'ao').items.find((i) => i.name === 'Chicken')?.mark).toBe('on');
  });

  it('draws no Bring after where nothing else on the plate is On', () => {
    const s = seed('notOn');
    expect(canBringAfter(plateOf(s, 'ao'), 'Chicken')).toBe(true);
    expect(canBringAfter(plateOf(s, 'hs'), 'Beef')).toBe(false);
    expect(bringAfter(s, 'hs', 'Beef')).toBe(s);
    expect(NOTHING_ELSE).toBe('Nothing else on the plate');
  });

  it('puts an order’s plate taken off back to To serve, and leaves an owed plate owed', () => {
    let s = takeOff(seed('notOn'), 'hs');
    expect(plateOf(s, 'hs').stage).toBe('toServe');
    s = takeOff(s, 'ka.owed');
    expect(plateOf(s, 'ka.owed').owed?.why).toBe('Bring after');
  });
});

describe('the check', () => {
  it('changes nothing with something left, and names each item still to settle', () => {
    const s = seed('checkLeft');
    expect(s.tray?.check).toBe('failed');
    expect(trayPlates(s).every((p) => p.stage === 'tray')).toBe(true);
    expect(unsettled(s).map((u) => `${u.plate.id}.${u.item}`)).toEqual(['ao.Chicken', 'hs.Beef']);
  });

  it('passes with every item On or Bring after, and every plate goes to Checked', () => {
    const s = seed('checked');
    expect(s.tray?.check).toBe('passed');
    expect(trayPlates(s).every((p) => p.stage === 'checked')).toBe(true);
  });

  it('draws Take to the table only after the check', () => {
    const route = seed('route');
    expect(takeToTable(route)).toBe(route);
    expect(trayPlates(takeToTable(seed('checked'))).every((p) => p.stage === 'onItsWay')).toBe(
      true,
    );
  });

  it('owes a brought-after item, First on the next tray', () => {
    const s = takeToTable(seed('checked'));
    expect(plateOf(s, 'ao.Chicken').owed?.why).toBe('Bring after');
  });
});

describe('at the table', () => {
  it('All served leaves flagged guests to tick by name, with its line', () => {
    const s = allServed(seed('atTable'));
    expect(s.servedLine).toBe('1 served · 2 to tick by name');
    expect(plateOf(s, 'ao').stage).toBe('onItsWay');
    expect(plateOf(s, 'ka.owed').stage).toBe('served');
  });

  it('ticks a flagged guest by name', () => {
    expect(plateOf(tick(seed('atTable'), 'ao'), 'ao').stage).toBe('served');
  });

  it('sends a plate back owed, First, with its reason', () => {
    const s = sendBack(seed('atTable'), 'ka.owed', 'Dropped');
    const p = plateOf(s, 'ka.owed');
    expect(p.owed).toMatchObject({ why: 'Sent back', reason: 'Dropped' });
    expect(nextTray({ ...s, tray: null })?.plates[0]?.id).toBe('ka.owed');
  });

  it('tells the floor lead about an allergy concern', () => {
    expect(sendBack(seed('atTable'), 'ao', 'Allergy concern').say).toContain('floor lead');
  });
});

describe('the held guests after the tray', () => {
  it('lists the held guests at that table once the tray is done', () => {
    const s = seed('heldAfter');
    expect(s.tray).toBeNull();
    expect(s.afterTray).toBe('Table 4');
    expect(names(heldAt(s, 'Table 4'))).toEqual(['Funke Adeyemi']);
  });

  it('puts what is ready on the next tray, with the rest to follow', () => {
    const s = chooseHeld(seed('heldAfter'), 'fa', 'now');
    expect(plateOf(s, 'fa').held).toBeNull();
    expect(nextTray(s)?.plates.map((p) => p.id)).toContain('fa');
  });

  it('draws no What’s ready, now with nothing ready', () => {
    const s = seed('nextTray');
    expect(chooseHeld(s, 'sm', 'now')).toBe(s);
  });

  it('lists Waiting on the kitchen oldest held first', () => {
    expect(names(waitingOnKitchen(seed('nothing')))).toEqual(['Funke Adeyemi', 'Sola Martins']);
  });
});

describe('pause', () => {
  it('reads only while paused, and Carry on clears it', () => {
    const s = seed('paused');
    expect(s.tray?.paused).toEqual({ at: '20:24', by: 'Bisi Lawal' });
    expect(mark(s, 'ao', 'Chicken', 'on')).toBe(s);
    expect(carryOn(s).tray?.paused).toBeNull();
    expect(pause(carryOn(s)).tray?.paused).not.toBeNull();
  });
});

describe('undo', () => {
  it('undoes a step that moved the whole tray as one', () => {
    const s = undo(takeToTable(seed('checked')));
    expect(trayPlates(s).every((p) => p.stage === 'checked')).toBe(true);
  });

  it('offers the step until two minutes on', () => {
    expect(startTray(seed('nextTray')).undo?.until).toBe('20:26');
  });

  it('ends the step’s Undo at a request action, so the request survives', () => {
    const started = startTray(seed('nextTray'));
    const s = undo(takeRequest(started, 'water'));
    expect(s.undo).toBeNull();
    expect(s.tray).toEqual(started.tray);
    expect(s.requests.find((r) => r.id === 'water')?.mine).toBe(true);
  });

  it('leaves a decline reason typed after the step as it is', () => {
    let s = startDecline(seed('route'), 'water');
    s = mark(s, 'ao', 'Plantain', 'on');
    s = reasonFor(s, 'water', 'Out of still water');
    s = undo(s);
    expect(s.undo).toBeNull();
    expect(
      s.plates.find((p) => p.id === 'ao')?.items.find((i) => i.name === 'Plantain')?.mark,
    ).toBe('none');
    expect(s.requests.find((r) => r.id === 'water')).toMatchObject({
      declining: true,
      reason: 'Out of still water',
    });
  });

  it('ends the step’s Undo at Next tray', () => {
    expect(goNext(startTray(seed('nextTray'))).undo).toBeNull();
  });

  it('ends the Undo once back online, leaving no tap waiting', () => {
    const off = mark(goOffline(seed('route')), 'ao', 'Plantain', 'on');
    const s = undo(reconnect(off));
    expect(s.undo).toBeNull();
    expect(s.kept).toHaveLength(0);
    expect(s.waiting).toHaveLength(0);
  });
});

describe('no connection', () => {
  it('reads the AC’s line while connected', () => {
    expect(stripLine(seed('route'))).toBe('Connected · up to date 20:24');
  });

  it('keeps plates per trip, with the count in the strip', () => {
    const s = seed('offline');
    expect(s.perTrip).toBe(4);
    expect(s.waiting).toContain('perTrip');
    expect(stripLine(s)).toBe('No connection · as of 20:22 · 1 tap waiting');
  });

  it('refuses Start the tray and request actions, keeping nothing', () => {
    const s = seed('offline');
    const started = startTray(s);
    expect(started.refused).toBe(START_OFFLINE);
    expect(started.kept).toEqual(s.kept);
    const asked = takeRequest(s, 'water');
    expect(asked.refused).toBe(REQUEST_OFFLINE);
    expect(asked.requests).toEqual(s.requests);
  });

  it('refuses a flagged guest’s tick, keeping nothing', () => {
    const s = seed('offlineAtTable');
    const ticked = tick(s, 'ao');
    expect(ticked.refused).toBe(flaggedOffline('Ada Obi'));
    expect(ticked.kept).toEqual(s.kept);
    expect(plateOf(ticked, 'ao').stage).toBe('onItsWay');
  });

  it('keeps a tick for a guest with no flag', () => {
    const s = seed('offlineAtTable');
    expect(s.kept).toHaveLength(1);
    expect(stripLine(s)).toBe('No connection · as of 20:22 · 1 tap waiting');
  });

  it('keeps taking a plate off the tray, as sc-4028 does', () => {
    const s = takeOff({ ...seed('notOn'), online: false }, 'hs');
    expect(s.refused).toBe('');
    expect(s.kept).toHaveLength(1);
  });

  it('drops the check with the refused mark, in one Not sent line (sc-97571)', () => {
    const s = seed('notSent');
    expect(s.kept.map((k) => k.what)).toEqual(['Chicken On, Seat 1', 'Check the tray']);
    const back = reconnect(s);
    expect(back.notSent).toEqual(['Tomi took Ada Obi off this tray.']);
    expect(back.kept).toHaveLength(0);
    expect(back.undo).toBeNull();
    expect(back.tray?.check).toBe('open');
    expect(names(trayPlates(back))).toEqual(['Kunle Ade', 'Hauwa Sani']);
  });
});

describe('requests', () => {
  it('asks for a reason before declining', () => {
    let s = startDecline(seed('nextTray'), 'water');
    s = sendDecline(s, 'water');
    expect(s.requests[0]?.reasonWrong).toBe(true);
  });
});

describe('states', () => {
  it('seeds every state, and falls back to the next tray', () => {
    for (const name of TRAY_STATES) expect(seed(name)).toBeTruthy();
    expect(trayStateOf('nope')).toBe('nextTray');
  });

  it('checks nothing while the tray has no plate', () => {
    const s = seed('route');
    const empty = { ...s, tray: s.tray == null ? null : { ...s.tray, plates: [] } };
    expect(check(empty)).toBe(empty);
  });
});
