import { describe, expect, it } from 'vitest';

import {
  DECLINE_BLANK,
  OFFLINE_ACTION,
  alertsOf,
  ariaSort,
  decline,
  done,
  flaggedSeats,
  goToTable,
  offered,
  openDecline,
  pressSort,
  requestsInOrder,
  room,
  roomSeed,
  sectionBehind,
  sorted,
  stateWord,
  tableLabel,
  tableOf,
  take,
  waitWord,
  wordOf,
} from './ServiceRoomModel.ts';

const t = (n: number) => {
  const found = room().find((x) => x.n === n);
  if (found == null) throw new Error(`no table ${n}`);
  return found;
};

describe('the room (sc-4026)', () => {
  it('gives each table the first word that applies', () => {
    expect(stateWord(t(9))).toBe('Behind · 22 min');
    expect(stateWord(t(2))).toBe('On a tray');
    expect(stateWord(t(6))).toBe('To serve');
    expect(stateWord(t(4))).toBe('Waiting on the kitchen');
    expect(stateWord(t(11))).toBe('Not here yet');
    expect(stateWord(t(14))).toBe('Not fired yet');
    expect(stateWord(t(5))).toBe('Starter · Served');
    expect(wordOf(t(8))).toBe('behind');
  });

  it('keeps a Behind table Behind while its tray is paused', () => {
    const nine = tableOf(roomSeed('panelPaused'), 9);
    expect(nine == null ? '' : stateWord(nine)).toBe('Behind · 22 min');
  });

  it('reads a tile aloud with the long flagged phrase', () => {
    expect(tableLabel(t(9))).toBe(
      'Table 9, Behind, 22 minutes, request open, 10 covers, 2 flagged guests still to serve',
    );
    expect(tableLabel(t(17))).toBe('Table 17, To serve, 8 covers, 1 flagged guest still to serve');
    expect(tableLabel(t(5))).toBe('Table 5, Starter, Served, 8 covers');
  });

  it('counts a flagged guest until their order and owed plates are served', () => {
    expect(flaggedSeats(t(9)).map((s) => s.n)).toEqual([1, 2]);
    expect(flaggedSeats(t(6)).map((s) => s.n)).toEqual([3]);
    expect(flaggedSeats(t(1))).toEqual([]);
  });

  it('sorts tables numerically, sections then table, and Wait longest first with none last', () => {
    const tables = room();
    const byTable = sorted(tables, { key: 'table', reversed: false });
    expect(byTable.slice(0, 3).map((x) => x.n)).toEqual([1, 2, 3]);
    expect(byTable.at(-1)?.n).toBe(18);
    const wait = sorted(tables, { key: 'wait', reversed: false });
    expect(wait.slice(0, 3).map((x) => x.n)).toEqual([9, 2, 8]);
    expect(wait.at(-1)?.wait).toBeNull();
    expect(waitWord(t(1))).toBe('Nothing waiting');
    expect(sorted(tables, { key: 'section', reversed: true })[0]?.section).toBe('D');
  });

  it('reverses on a second press and says so in aria-sort', () => {
    const once = pressSort({ key: 'table', reversed: false }, 'wait');
    expect(ariaSort(once, 'wait')).toBe('descending');
    const twice = pressSort(once, 'wait');
    expect(ariaSort(twice, 'wait')).toBe('ascending');
    expect(ariaSort(twice, 'table')).toBe('none');
  });

  it('calls a section Behind while any of its tables is', () => {
    expect(sectionBehind(room(), 'B')).toBe(true);
    expect(sectionBehind(room(), 'A')).toBe(false);
  });

  it('raises the three alerts, newest first, with no time', () => {
    const alerts = alertsOf(room());
    expect(alerts.map((a) => a.title)).toEqual([
      'A request open 5 min',
      'Section B is Behind',
      'A plate sent back · Allergy concern',
    ]);
    expect(alerts[0]?.sub).toBe('Table 9 · “Could the blind behind them come down a little?”');
    expect(alerts[1]?.sub).toBe('Table 9 has waited longest · 22 min');
    expect(alerts[2]?.flag).toBe('Nut allergy');
    expect(alertsOf(roomSeed('alertsEmpty').tables)).toEqual([]);
  });

  it('opens the request first from its alert', () => {
    const r = goToTable(roomSeed('populated'), 'request-blind');
    const nine = tableOf(r, 9);
    expect(nine == null ? '' : requestsInOrder(r, nine)[0]?.id).toBe('blind');
  });
});

describe('requests in the panel (sc-4026)', () => {
  const offeredOn = (name: Parameters<typeof roomSeed>[0], id: string) => {
    const r = roomSeed(name);
    const q = tableOf(r, 9)?.requests.find((x) => x.id === id);
    return q == null ? [] : offered(r, q);
  };

  it('offers I’ll do it and Decline on a request nobody has, Done and Decline otherwise', () => {
    expect(offeredOn('reqNobody', 'chair')).toEqual(['take', 'decline']);
    expect(offeredOn('reqYours', 'chair')).toEqual(['done', 'decline']);
    expect(offeredOn('reqOther', 'blind')).toEqual(['done', 'decline']);
    expect(offeredOn('reqMoment', 'song')).toEqual(['done', 'decline']);
    expect(offeredOn('noManage', 'chair')).toEqual([]);
  });

  it('takes a request', () => {
    const r = take(roomSeed('reqNobody'), 'chair');
    expect(tableOf(r, 9)?.requests.find((q) => q.id === 'chair')?.owner).toBe('Ifeoma Nduka');
  });

  it('changes the plate to the dish already chosen on Done', () => {
    const r = done(roomSeed('panel'), 'stew');
    expect(tableOf(r, 9)?.seats[0]?.dish).toBe('Vegetable stew');
  });

  it('refuses a plate change, keeps it open and takes Done away', () => {
    const r = roomSeed('refusedStage');
    const stew = tableOf(r, 9)?.requests.find((q) => q.id === 'stew');
    expect(stew?.closed).toBeUndefined();
    expect(r.notice.stew).toMatch(/^Not changed\. Seat 1’s Mains became Dishing/);
    expect(stew == null ? [] : offered(r, stew)).toEqual(['decline']);
    expect(tableOf(r, 9)?.seats[0]?.dish).toBe('Grilled fish · pepper sauce');
    expect(roomSeed('refusedDish').notice.stew).toMatch(/rules out Vegetable stew for seat 1/);
  });

  it('moves a request somebody else closed first to Closed', () => {
    const r = roomSeed('closedFirst');
    expect(tableOf(r, 9)?.requests.find((q) => q.id === 'blind')?.closed?.by).toBe('Grace Udo');
    expect(r.notice.blind).toBe('Not closed. Grace Udo closed this request at 20:23.');
  });

  it('sends nothing on a blank decline', () => {
    const r = decline(openDecline(roomSeed('reqNobody'), 'chair'));
    expect(r.reasonWrong).toBe(true);
    expect(r.say).toBe(DECLINE_BLANK);
    expect(tableOf(r, 9)?.requests.find((q) => q.id === 'chair')?.closed).toBeUndefined();
  });

  it('refuses every request button offline', () => {
    const r = roomSeed('offline');
    expect(take(r, 'chair').refused).toBe(OFFLINE_ACTION);
    expect(done(r, 'blind').refused).toBe(OFFLINE_ACTION);
    expect(openDecline(r, 'chair').refused).toBe(OFFLINE_ACTION);
  });
});
