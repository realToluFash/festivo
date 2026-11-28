import { describe, expect, it } from 'vitest';

import {
  HELD_LINE,
  OFFLINE_BRING_AFTER,
  OFFLINE_HELD,
  OFFLINE_LEAD,
  RUN_OUT_STATES,
  type RunOutState,
  bringAfter,
  chooseHeld,
  currentStop,
  floorSeats,
  heldRows,
  isWaiting,
  landedLine,
  leadChooses,
  markNotOn,
  moveOn,
  orderOf,
  plateEmptyLine,
  plural,
  runOutStateOf,
  seed,
  stopLines,
  takeOff,
  takeToTable,
  trayCheck,
  trayLine,
} from './runOutTrayModel.ts';

const names = (rows: readonly { guest: { name: string } }[]) => rows.map((r) => r.guest.name);

function trayOnly(s: RunOutState, guest: string): RunOutState {
  return {
    ...s,
    orders: s.orders.map((o) =>
      o.guest === guest
        ? { ...o, where: 'tray' }
        : o.where === 'tray'
          ? { ...o, where: 'toServe' }
          : o,
    ),
  };
}

describe('who is held on Next', () => {
  it('lists every guest at To serve still waiting on Chicken, by table and seat, with no time', () => {
    const rows = heldRows(seed('runOutHeld'));
    expect(names(rows)).toEqual(['Bayo Ojo', 'Yemi Alabi', 'Adaora Eze', 'Emeka Obi']);
    expect(rows.every((r) => r.line === HELD_LINE)).toBe(true);
    expect(HELD_LINE).toBe('Chicken has run out · waiting for the floor lead');
  });

  it('offers What’s ready, now only when something else is on the plate', () => {
    const rows = heldRows(seed('runOutHeld'));
    expect(rows.find((r) => r.guest.name === 'Bayo Ojo')?.canChoose).toBe(false);
    expect(rows.find((r) => r.guest.name === 'Yemi Alabi')?.canChoose).toBe(true);
  });

  it('sends the rest now and leaves Chicken To follow, still waiting for the floor lead', () => {
    const s = chooseHeld(seed('runOutHeld'), 'ya', 'now');
    const o = orderOf(s, 'ya');
    expect(o?.lines.map((l) => l.item)).toEqual(['Jollof rice']);
    expect(o?.follow).toEqual(['Chicken']);
    expect(o != null && isWaiting(o)).toBe(true);
    expect(heldRows(s).find((r) => r.guest.name === 'Yemi Alabi')?.choice).toBe('now');
  });

  it('puts Chicken back on the plate when the guest then waits for all', () => {
    const s = chooseHeld(chooseHeld(seed('runOutHeld'), 'ya', 'now'), 'ya', 'wait');
    expect(orderOf(s, 'ya')?.lines.map((l) => l.item)).toEqual(['Jollof rice', 'Chicken']);
    expect(orderOf(s, 'ya')?.follow).toEqual([]);
  });

  it('refuses a held choice with no connection and keeps nothing', () => {
    const s0 = { ...seed('runOutHeld'), online: false };
    const s = chooseHeld(s0, 'ya', 'now');
    expect(s.refused).toBe(OFFLINE_HELD);
    expect(s.orders).toBe(s0.orders);
  });
});

describe('a plate on a started tray', () => {
  it('reads Run out for Chicken at the Grill, never On', () => {
    const s = seed('runOutAtStop');
    expect(currentStop(s)?.name).toBe('Grill');
    expect(trayLine(s)).toBe('Stop 3 of 3 · the Grill, Tayo Bamidele');
    const chicken = stopLines(s).filter((l) => l.item === 'Chicken');
    expect(names(chicken)).toEqual(['Funke Adeyemi', 'Hauwa Sani', 'Tunde Bakare']);
    expect(chicken.every((l) => l.look === 'runOut' && !l.canResolve)).toBe(true);
  });

  it('offers Bring after once the waiter marks it Not on', () => {
    const s = markNotOn(seed('runOutAtStop'), 'tb');
    const l = stopLines(s).find((x) => x.guest.name === 'Tunde Bakare');
    expect(l?.look).toBe('notOn');
    expect(l?.canResolve).toBe(true);
    expect(bringAfter(seed('runOutAtStop'), 'tb').orders).toEqual(seed('runOutAtStop').orders);
  });

  it('holds the check until every run-out plate is brought after or taken off', () => {
    const s = moveOn(seed('runOutAtStop'));
    const c = trayCheck(s);
    expect(c.passes).toBe(false);
    expect(names(c.runOut)).toEqual(['Funke Adeyemi', 'Hauwa Sani', 'Tunde Bakare']);
    expect(c.missing).toEqual([]);
  });

  it('passes the check with Bring after on it, owing the guest the choice', () => {
    const c = trayCheck(seed('runOutBringAfter'));
    expect(c.passes).toBe(true);
    expect(c.ok.find((r) => r.guest.name === 'Tunde Bakare')?.sub).toBe(
      'Jollof rice · Bring after: Chicken · waiting for the floor lead',
    );
    const gone = takeToTable(seed('runOutBringAfter'));
    expect(orderOf(gone, 'tb')?.where).toBe('onItsWay');
    const tb = orderOf(gone, 'tb');
    expect(tb != null && isWaiting(tb)).toBe(true);
  });

  it('refuses Bring after when Chicken is all that would go, with plate_empty', () => {
    const s0 = { ...seed('runOutPlateEmpty'), refused: '' };
    const s = bringAfter(s0, 'bo');
    expect(s.refused).toBe(plateEmptyLine(4));
    expect(s.refused).toBe(
      'Seat 4 has nothing else on it, so it can’t go without Chicken. Take it off the tray.',
    );
    expect(orderOf(s, 'bo')?.lines[0]?.mark).toBe('notOn');
  });

  it('refuses Bring after when everything else on the plate is Not on too', () => {
    let s = markNotOn(seed('runOutAtStop'), 'tb');
    s = {
      ...s,
      orders: s.orders.map((o) =>
        o.guest === 'tb'
          ? { ...o, lines: o.lines.map((l) => ({ ...l, mark: 'notOn' as const })) }
          : o,
      ),
    };
    expect(bringAfter(s, 'tb').refused).toBe(plateEmptyLine(4));
  });

  it('takes a plate off the tray and holds its guest', () => {
    const s = takeOff(seed('runOutPlateEmpty'), 'bo');
    expect(orderOf(s, 'bo')?.where).toBe('toServe');
    expect(names(heldRows(s))).toContain('Bayo Ojo');
    expect(trayCheck(moveOn(s)).passes).toBe(true);
  });

  it('refuses Bring after with no connection, keeping nothing, and still takes a plate off (sc-4028)', () => {
    const s0 = { ...markNotOn(seed('runOutAtStop'), 'tb'), online: false };
    expect(bringAfter(s0, 'tb').refused).toBe(OFFLINE_BRING_AFTER);
    expect(bringAfter(s0, 'tb').orders).toBe(s0.orders);
    expect(takeOff(s0, 'tb').refused).toBe('');
    expect(orderOf(takeOff(s0, 'tb'), 'tb')?.where).toBe('toServe');
    expect(seed('runOutOffline').refused).toBe(OFFLINE_BRING_AFTER);
  });
});

describe('what a replacement does', () => {
  it('lands at once, unmarked, at its stop, and Next says it once', () => {
    const s = seed('runOutLanded');
    const tb = orderOf(s, 'tb');
    expect(tb?.lines).toEqual([
      { item: 'Jollof rice', mark: 'on', instead: null },
      { item: 'Beef', mark: 'unmarked', instead: 'Chicken' },
    ]);
    expect(s.say).toBe('Seat 4: Beef instead of Chicken');
    expect(s.landed).toEqual(['Seat 4: Beef instead of Chicken']);
    const beef = stopLines({ ...s, screen: 'tray' }).find((l) => l.item === 'Beef');
    expect(beef?.look).toBe('on');
    expect(beef?.instead).toBe('Chicken');
    expect(s.tray?.stops).toEqual(['pass', 'jollof', 'grill']);
  });

  it('says without Chicken when the floor lead serves without it', () => {
    const s = leadChooses(markNotOn(seed('runOutAtStop'), 'tb'), 'tb', null);
    expect(orderOf(s, 'tb')?.lines.map((l) => l.item)).toEqual(['Jollof rice']);
    expect(s.say).toBe(landedLine(4, null));
    expect(s.say).toBe('Seat 4: without Chicken');
  });

  it('adds the replacement’s station to the tray’s stops, in walking order', () => {
    let s = trayOnly(seed('runOutAtStop'), 'bo');
    s = { ...s, tray: { table: 3, stops: ['pass', 'grill'], at: 1, check: false } };
    s = leadChooses(markNotOn(s, 'bo'), 'bo', 'Jollof rice');
    expect(s.tray?.stops).toEqual(['pass', 'jollof', 'grill']);
    expect(s.tray?.at).toBe(2);
    expect(currentStop(s)?.name).toBe('Grill');
  });

  it('owes a brought-after plate the replacement once chosen', () => {
    const s = leadChooses(seed('runOutBringAfter'), 'tb', 'Beef');
    expect(orderOf(s, 'tb')?.lines[1]).toEqual({
      item: 'Beef',
      mark: 'bringAfter',
      instead: 'Chicken',
    });
    expect(trayCheck(s).ok.find((r) => r.guest.name === 'Tunde Bakare')?.sub).toBe(
      'Jollof rice · Bring after: Beef',
    );
  });

  it('turns a held guest’s To follow into the replacement', () => {
    const s = leadChooses(chooseHeld(seed('runOutHeld'), 'ya', 'now'), 'ya', 'Beef');
    expect(orderOf(s, 'ya')?.follow).toEqual(['Beef']);
    expect(names(heldRows(s))).not.toContain('Yemi Alabi');
    expect(s.say).toBe('');
  });

  it('leaves a Chicken-only plate waiting when served without, and a plate already dishing alone', () => {
    const s0 = seed('runOutHeld');
    expect(leadChooses(s0, 'bo', null).note).toContain('plate_empty');
    expect(names(heldRows(leadChooses(s0, 'bo', null)))).toContain('Bayo Ojo');
    expect(leadChooses(seed('runOutPlateEmpty'), 'ne', 'Beef').note).toBe(
      'Ngozi Eze isn’t waiting for a choice.',
    );
  });

  it('does not land while this phone is offline', () => {
    const s = leadChooses(seed('runOutOffline'), 'tb', 'Beef');
    expect(s.note).toBe(OFFLINE_LEAD);
    expect(orderOf(s, 'tb')?.lines.map((l) => l.item)).toEqual(['Jollof rice', 'Chicken']);
  });
});

describe('the Floor and the states', () => {
  it('shows each seat at the tray’s table with the waiting line, then the replacement', () => {
    const before = floorSeats(seed('runOutAtStop'));
    expect(before.map((x) => x.guest.seat)).toEqual([1, 2, 3, 4, 6]);
    expect(before.filter((x) => x.waiting).map((x) => x.guest.seat)).toEqual([1, 2, 4, 6]);
    const after = floorSeats(seed('runOutLanded')).find((x) => x.guest.seat === 4);
    expect(after?.now).toBe('Now Beef');
    expect(after?.waiting).toBe(false);
  });

  it('says Without Chicken from the floor lead’s choice, and for nobody else', () => {
    const s = leadChooses(seed('runOutAtStop'), 'tb', null);
    const now = (seat: number) => floorSeats(s).find((x) => x.guest.seat === seat)?.now;
    expect(now(4)).toBe('Without Chicken');
    expect(now(3)).toBe('');
    expect(now(1)).toBe('');
  });

  it('reads every state from the address, and counts with plurals', () => {
    for (const name of RUN_OUT_STATES) expect(runOutStateOf(name)).toBe(name);
    expect(runOutStateOf('nonsense')).toBe('runOutAtStop');
    expect(plural(1, 'plate', 'plates')).toBe('1 plate');
    expect(plural(3, 'plate', 'plates')).toBe('3 plates');
  });
});
