/** Next on epic 35's tray model (sc-1361): the next tray, its route, the check, the table, the held guests after it, requests, pause and kept taps, on sample data. */

import { OFFLINE_ACTION } from '../service/RequestsModel.ts';

export const WAITER = 'Bisi Lawal';
export const SECTION = 'Section B';
export const LEAD = 'Tomi Bello';
export const LEAD_FIRST = 'Tomi';
export const NOW = '20:24';
export const AS_OF = '20:22';

export type StationId = 'pass' | 'jollof' | 'grill';

export interface Station {
  id: StationId;
  name: string;
  who: string;
}

export const WALK: readonly Station[] = [
  { id: 'pass', name: 'Pass', who: 'Ronke Alade' },
  { id: 'jollof', name: 'Rice · Jollof', who: 'Kemi Okon' },
  { id: 'grill', name: 'Grill', who: 'Tayo Bamidele' },
];

export const DISHED_AT: Readonly<Record<string, StationId>> = {
  Plantain: 'pass',
  'Jollof rice': 'jollof',
  Chicken: 'grill',
  Beef: 'grill',
  'Grilled fish': 'grill',
};

export interface Guest {
  id: string;
  name: string;
  table: string;
  seat: number;
  flags: readonly string[];
}

export const GUESTS: readonly Guest[] = [
  { id: 'ao', name: 'Ada Obi', table: 'Table 4', seat: 1, flags: ['Fish allergy'] },
  { id: 'ka', name: 'Kunle Ade', table: 'Table 4', seat: 2, flags: [] },
  { id: 'hs', name: 'Hauwa Sani', table: 'Table 4', seat: 3, flags: ['Halal meal'] },
  { id: 'do', name: 'Dapo Ojo', table: 'Table 4', seat: 4, flags: [] },
  { id: 'fa', name: 'Funke Adeyemi', table: 'Table 4', seat: 5, flags: [] },
  { id: 'eo', name: 'Emeka Obi', table: 'Table 4', seat: 6, flags: [] },
  { id: 'ya', name: 'Yemi Alabi', table: 'Table 4', seat: 7, flags: [] },
  { id: 'mi', name: 'Musa Ibrahim', table: 'Table 4', seat: 8, flags: [] },
  { id: 'sm', name: 'Sola Martins', table: 'Table 2', seat: 1, flags: [] },
  { id: 'ne', name: 'Ngozi Eze', table: 'Table 2', seat: 2, flags: [] },
  { id: 'bo', name: 'Bayo Ojo', table: 'Table 10', seat: 1, flags: [] },
];

export function guestOf(id: string): Guest {
  const g = GUESTS.find((x) => x.id === id);
  if (g == null) throw new Error(`No guest ${id}`);
  return g;
}

const COLLATOR = new Intl.Collator('en', { numeric: true });

export function tableOrder(names: readonly string[]): readonly string[] {
  return [...names].sort((a, b) => COLLATOR.compare(a, b));
}

export type Mark = 'none' | 'on' | 'notOn' | 'bringAfter';

export interface Item {
  name: string;
  mark: Mark;
  follow: boolean;
}

export type Stage = 'toServe' | 'tray' | 'checked' | 'onItsWay' | 'served' | 'elsewhere';

export interface Owed {
  why: 'Bring after' | 'Sent back';
  reason: string;
  since: string;
  course: string | null;
}

export interface Held {
  items: readonly string[];
  readyIn: number | null;
  anyReady: boolean;
  since: string;
  choice: 'wait' | null;
}

export interface Plate {
  id: string;
  guest: string;
  items: readonly Item[];
  stage: Stage;
  owed: Owed | null;
  held: Held | null;
}

export interface Tray {
  table: string;
  plates: readonly string[];
  check: 'open' | 'failed' | 'passed';
  paused: { at: string; by: string } | null;
}

export interface Request {
  id: string;
  table: string;
  seat: number | null;
  words: string;
  opened: string;
  mine: boolean;
  declining: boolean;
  reason: string;
  reasonWrong: boolean;
}

export interface Kept {
  what: string;
  plate: string | null;
}

export interface NextState {
  online: boolean;
  onSection: boolean;
  perTrip: number;
  plates: readonly Plate[];
  tray: Tray | null;
  requests: readonly Request[];
  kept: readonly Kept[];
  waiting: readonly string[];
  refused: string;
  notSent: readonly string[];
  say: string;
  undo: { what: string; before: NextState } | null;
  sendingBack: string | null;
  afterTray: string | null;
  servedLine: string;
  leadTookOff: string | null;
}

export const TRAY_STATES = [
  'nextTray',
  'route',
  'notOn',
  'checkLeft',
  'checked',
  'atTable',
  'sendBack',
  'heldAfter',
  'paused',
  'nothing',
  'noTables',
  'offline',
  'offlineAtTable',
  'notSent',
] as const;

export type TrayStateName = (typeof TRAY_STATES)[number];

export const TRAY_STATE_WHAT: Readonly<Record<TrayStateName, readonly [string, string]>> = {
  nextTray: [
    'The next tray',
    'A request, then Table 4’s next tray with Kunle’s owed plate first and the plates per trip stepper, then Waiting on the kitchen',
  ],
  route: [
    'A started tray, its stops',
    'The Pass, Rice · Jollof and the Grill, each plate’s items with On and Not on, in any order',
  ],
  notOn: [
    'Not on: Bring after, or take it off',
    'Chicken Not on for Ada Obi offers Bring after and Take off the tray; Hauwa Sani’s plate reads Nothing else on the plate',
  ],
  checkLeft: [
    'Check the tray, something left',
    'Pressed with Ada Obi’s Chicken Not on and Hauwa Sani’s Beef unmarked: each marked, focus on the first',
  ],
  checked: ['Check the tray passes', 'Every item On or Bring after: Take to the table is drawn'],
  atTable: ['At the table', 'Each plate by seat with a tick by name, All served and its line'],
  sendBack: [
    'Send back on the way',
    'A plate On its way sent back: one reason chosen before anything is sent',
  ],
  heldAfter: [
    'The held guests, straight after',
    'Funke Adeyemi held at Table 4 once its tray is done, with What’s ready, now, Wait for all and Next tray',
  ],
  paused: ['Paused', 'The tray in hand paused: its marks read only, and Carry on'],
  nothing: [
    'Nothing to serve',
    'No tray to offer and no request: Nothing to serve above Waiting on the kitchen',
  ],
  noTables: [
    'No tables yet',
    'On no section: the line naming the lead, no tray, and the requests they own',
  ],
  offline: [
    'No connection, the next tray',
    'Plates per trip kept and Waiting to send; Start the tray and the request refused, nothing kept',
  ],
  offlineAtTable: [
    'No connection, at the table',
    'All served kept and Waiting to send; a flagged guest’s tick refused, nothing kept',
  ],
  notSent: [
    'Not sent, on reconnecting',
    'Ada Obi’s mark and the check kept offline; the lead took her off meanwhile: one Not sent line',
  ],
};

export function trayStateOf(raw: string | undefined): TrayStateName {
  return (TRAY_STATES as readonly string[]).includes(raw ?? '')
    ? (raw as TrayStateName)
    : 'nextTray';
}

export const START_OFFLINE = 'Starting a tray needs a connection.';
export const REQUEST_OFFLINE = OFFLINE_ACTION;
export const DECLINE_BLANK = 'Say why it can’t be done';
export const NOTHING_TO_SERVE = 'Nothing to serve at your tables right now.';
export const NOT_SENT_HEADING = 'Not sent · the floor changed while you were offline';
export const NOTHING_ELSE = 'Nothing else on the plate';
export const REASONS = ['Wrong dish', 'Not right', 'Dropped', 'Allergy concern'] as const;
export type Reason = (typeof REASONS)[number];

export function flaggedOffline(name: string): string {
  return `Needs a connection: check ${name} at the table.`;
}

export function noTablesLine(lead: string): string {
  return `No tables yet. ${lead} will put you on a section.`;
}

export function countWords(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function stripLine(s: NextState): string {
  if (s.online) return `Connected · up to date at ${NOW}`;
  const n = s.kept.length;
  return n === 0
    ? `No connection · as of ${AS_OF}`
    : `No connection · as of ${AS_OF} · ${countWords(n, 'tap waiting', 'taps waiting')}`;
}

const item = (name: string, mark: Mark = 'none'): Item => ({ name, mark, follow: false });

function plate(
  id: string,
  guest: string,
  items: readonly Item[],
  more: Partial<Plate> = {},
): Plate {
  return { id, guest, items, stage: 'toServe', owed: null, held: null, ...more };
}

function base(): NextState {
  return {
    online: true,
    onSection: true,
    perTrip: 3,
    plates: [
      plate('ka.owed', 'ka', [item('Chicken')], {
        owed: { why: 'Bring after', reason: '', since: '20:09', course: null },
      }),
      plate('ao', 'ao', [item('Plantain'), item('Jollof rice'), item('Chicken')]),
      plate('hs', 'hs', [item('Jollof rice'), item('Beef'), { ...item('Plantain'), follow: true }]),
      plate('do', 'do', [item('Jollof rice'), item('Chicken')]),
      plate('fa', 'fa', [item('Jollof rice'), item('Grilled fish')], {
        held: { items: ['Grilled fish'], readyIn: 6, anyReady: true, since: '20:12', choice: null },
      }),
      plate('eo', 'eo', [item('Plantain'), item('Jollof rice'), item('Beef')]),
      plate('ya', 'ya', [item('Jollof rice'), item('Chicken')]),
      plate('mi', 'mi', [item('Jollof rice'), item('Chicken')], { stage: 'elsewhere' }),
      plate('sm', 'sm', [item('Jollof rice'), item('Beef')], {
        held: { items: ['Beef'], readyIn: null, anyReady: false, since: '20:15', choice: null },
      }),
      plate('ne', 'ne', [item('Jollof rice'), item('Chicken')]),
      plate('bo', 'bo', [item('Plantain'), item('Jollof rice'), item('Grilled fish')]),
    ],
    tray: null,
    requests: [
      {
        id: 'water',
        table: 'Table 10',
        seat: 1,
        words: 'Still water for seat 1.',
        opened: '20:18',
        mine: false,
        declining: false,
        reason: '',
        reasonWrong: false,
      },
    ],
    kept: [],
    waiting: [],
    refused: '',
    notSent: [],
    say: '',
    undo: null,
    sendingBack: null,
    afterTray: null,
    servedLine: '',
    leadTookOff: null,
  };
}

export function plateOf(s: NextState, id: string): Plate {
  const p = s.plates.find((x) => x.id === id);
  if (p == null) throw new Error(`No plate ${id}`);
  return p;
}

function update(s: NextState, id: string, change: (p: Plate) => Plate): NextState {
  return { ...s, plates: s.plates.map((p) => (p.id === id ? change(p) : p)) };
}

function setMark(s: NextState, id: string, name: string, mark: Mark): NextState {
  return update(s, id, (p) => ({
    ...p,
    items: p.items.map((i) => (i.name === name ? { ...i, mark } : i)),
  }));
}

function markAll(s: NextState, ids: readonly string[], mark: Mark): NextState {
  return ids.reduce(
    (x, id) =>
      update(x, id, (p) => ({
        ...p,
        items: p.items.map((i) => (i.follow ? i : { ...i, mark })),
      })),
    s,
  );
}

export function seed(name: TrayStateName): NextState {
  const s = base();
  switch (name) {
    case 'nextTray':
      return s;
    case 'route':
      return startTray(s);
    case 'notOn': {
      let t = startTray(s);
      t = markAll(t, ['ka.owed', 'do'], 'on');
      t = setMark(t, 'ao', 'Plantain', 'on');
      t = setMark(t, 'ao', 'Jollof rice', 'on');
      t = setMark(t, 'ao', 'Chicken', 'notOn');
      t = setMark(t, 'hs', 'Jollof rice', 'notOn');
      t = setMark(t, 'hs', 'Beef', 'notOn');
      return { ...t, undo: null };
    }
    case 'checkLeft': {
      let t = startTray(s);
      t = markAll(t, ['ka.owed', 'ao'], 'on');
      t = setMark(t, 'ao', 'Chicken', 'notOn');
      t = setMark(t, 'hs', 'Jollof rice', 'on');
      return { ...check(t), undo: null };
    }
    case 'checked': {
      let t = markAll(startTray(s), ['ka.owed', 'hs'], 'on');
      t = setMark(t, 'ao', 'Plantain', 'on');
      t = setMark(t, 'ao', 'Jollof rice', 'on');
      t = setMark(t, 'ao', 'Chicken', 'bringAfter');
      return { ...check(t), undo: null };
    }
    case 'atTable':
      return { ...takeToTable(seed('checked')), undo: null, say: '' };
    case 'sendBack':
      return { ...seed('atTable'), sendingBack: 'ka.owed' };
    case 'heldAfter': {
      const t = allServed(seed('atTable'));
      return { ...tick(tick(t, 'ao'), 'hs'), undo: null };
    }
    case 'paused':
      return { ...pause(setMark(startTray(s), 'ao', 'Plantain', 'on')), undo: null, say: '' };
    case 'nothing':
      return {
        ...s,
        requests: [],
        plates: s.plates.map((p) =>
          p.held != null || p.stage === 'elsewhere' ? p : { ...p, stage: 'served', owed: null },
        ),
      };
    case 'noTables':
      return {
        ...s,
        onSection: false,
        requests: s.requests.map((r) => ({ ...r, mine: true, table: 'Table 12' })),
      };
    case 'offline':
      return { ...setPerTrip({ ...s, online: false }, 4), say: '' };
    case 'offlineAtTable':
      return { ...allServed({ ...seed('atTable'), online: false }), say: '' };
    case 'notSent': {
      let t = markAll(startTray(s), ['ka.owed', 'hs'], 'on');
      t = setMark(t, 'ao', 'Plantain', 'on');
      t = setMark(t, 'ao', 'Jollof rice', 'on');
      t = check(mark({ ...t, online: false }, 'ao', 'Chicken', 'on'));
      return { ...t, say: '', leadTookOff: 'ao' };
    }
  }
}

const bySeat = (a: Plate, b: Plate) => guestOf(a.guest).seat - guestOf(b.guest).seat;

export function isHeld(p: Plate): boolean {
  return p.held != null;
}

function canOffer(p: Plate): boolean {
  return p.stage === 'toServe' && !isHeld(p);
}

export function myTables(s: NextState): readonly string[] {
  if (!s.onSection) return [];
  return tableOrder([...new Set(GUESTS.map((g) => g.table))]);
}

export interface Offer {
  table: string;
  plates: readonly Plate[];
}

/** The next tray: the table with the oldest owed plate, else the first table in table order with a guest to serve; owed plates first, then seat order, up to plates per trip. */
export function nextTray(s: NextState): Offer | null {
  if (s.tray != null || s.afterTray != null) return null;
  const tables = myTables(s);
  const open = s.plates.filter((p) => canOffer(p) && tables.includes(guestOf(p.guest).table));
  const owed = open
    .filter((p) => p.owed != null)
    .sort((a, b) => sinceOf(a).localeCompare(sinceOf(b)));
  const table =
    owed[0] != null
      ? guestOf(owed[0].guest).table
      : tables.find((t) => open.some((p) => guestOf(p.guest).table === t));
  if (table == null) return null;
  const here = open.filter((p) => guestOf(p.guest).table === table);
  const first = here
    .filter((p) => p.owed != null)
    .sort((a, b) => sinceOf(a).localeCompare(sinceOf(b)));
  const rest = here.filter((p) => p.owed == null).sort(bySeat);
  return { table, plates: [...first, ...rest].slice(0, s.perTrip) };
}

function sinceOf(p: Plate): string {
  return p.owed?.since ?? '';
}

export function trayPlates(s: NextState): readonly Plate[] {
  const t = s.tray;
  if (t == null) return [];
  return t.plates.map((id) => plateOf(s, id)).sort(bySeat);
}

function step(s: NextState, what: string, next: NextState): NextState {
  return { ...next, undo: { what, before: { ...s, undo: null } } };
}

function keep(s: NextState, what: string, ids: readonly string[], next: NextState): NextState {
  if (s.online) return step(s, what, { ...next, refused: '' });
  return {
    ...next,
    refused: '',
    kept: [...s.kept, { what, plate: ids[0] ?? null }],
    waiting: [...new Set([...s.waiting, ...ids])],
    undo: { what, before: { ...s, undo: null } },
  };
}

export function startTray(s: NextState): NextState {
  const offer = nextTray(s);
  if (offer == null) return s;
  if (!s.online) return { ...s, refused: START_OFFLINE };
  const ids = offer.plates.map((p) => p.id);
  const started: NextState = {
    ...s,
    tray: { table: offer.table, plates: ids, check: 'open', paused: null },
    plates: s.plates.map((p) => (ids.includes(p.id) ? { ...p, stage: 'tray' } : p)),
    say: `${offer.table}’s tray is started.`,
  };
  return step(s, 'Start the tray', started);
}

export interface Stop {
  station: Station;
  rows: readonly { plate: Plate; items: readonly Item[] }[];
}

export function route(s: NextState): readonly Stop[] {
  const plates = trayPlates(s);
  return WALK.map((station) => ({
    station,
    rows: plates
      .map((p) => ({ plate: p, items: p.items.filter((i) => DISHED_AT[i.name] === station.id) }))
      .filter((r) => r.items.length > 0),
  })).filter((st) => st.station.id === 'pass' || st.rows.length > 0);
}

function readOnly(s: NextState): boolean {
  return s.tray == null || s.tray.paused != null || s.tray.check === 'passed';
}

export function mark(s: NextState, id: string, name: string, to: 'on' | 'notOn'): NextState {
  if (readOnly(s)) return s;
  const i = plateOf(s, id).items.find((x) => x.name === name);
  if (i == null || i.follow) return s;
  const g = guestOf(plateOf(s, id).guest);
  const what = `${name} ${to === 'on' ? 'On' : 'Not on'}, Seat ${g.seat}`;
  return keep(s, what, [`${id}.${name}`], setMark(s, id, name, to));
}

export function canBringAfter(p: Plate, name: string): boolean {
  return p.items.some((i) => i.name !== name && !i.follow && i.mark === 'on');
}

export function bringAfter(s: NextState, id: string, name: string): NextState {
  const p = plateOf(s, id);
  if (readOnly(s) || !canBringAfter(p, name)) return s;
  const g = guestOf(p.guest);
  return keep(
    s,
    `Bring ${name} after, Seat ${g.seat}`,
    [`${id}.${name}`],
    setMark(s, id, name, 'bringAfter'),
  );
}

/** An order's plate goes back to To serve; an owed plate stays owed. */
export function takeOff(s: NextState, id: string): NextState {
  const t = s.tray;
  if (t == null || t.paused != null || !t.plates.includes(id)) return s;
  const p = plateOf(s, id);
  if (p.stage === 'onItsWay' || p.stage === 'served') return s;
  const g = guestOf(p.guest);
  const off: NextState = update(
    { ...s, tray: { ...t, plates: t.plates.filter((x) => x !== id) } },
    id,
    (x) => ({
      ...x,
      stage: 'toServe',
      items: x.items.map((i) => ({ ...i, mark: 'none' as Mark })),
    }),
  );
  const done = finishIfDone({ ...off, say: `Seat ${g.seat} is off the tray.` });
  return keep(s, `Take Seat ${g.seat} off the tray`, [id], done);
}

export interface Unsettled {
  plate: Plate;
  item: string;
}

export function unsettled(s: NextState): readonly Unsettled[] {
  return trayPlates(s).flatMap((p) =>
    p.items
      .filter((i) => !i.follow && (i.mark === 'none' || i.mark === 'notOn'))
      .map((i) => ({ plate: p, item: i.name })),
  );
}

export function check(s: NextState): NextState {
  const t = s.tray;
  if (t == null || t.paused != null || t.plates.length === 0 || t.check === 'passed') return s;
  const left = unsettled(s);
  if (left.length > 0) {
    return {
      ...s,
      refused: '',
      tray: { ...t, check: 'failed' },
      say: `${countWords(left.length, 'item', 'items')} still to settle.`,
    };
  }
  const passed: NextState = {
    ...s,
    tray: { ...t, check: 'passed' },
    plates: s.plates.map((p) => (t.plates.includes(p.id) ? { ...p, stage: 'checked' } : p)),
    say: 'The tray is checked.',
  };
  return keep(s, 'Check the tray', ['check'], passed);
}

export function takeToTable(s: NextState): NextState {
  const t = s.tray;
  if (t == null || t.check !== 'passed' || t.paused != null) return s;
  const owed: Plate[] = trayPlates(s).flatMap((p) =>
    p.items
      .filter((i) => i.mark === 'bringAfter')
      .map((i) =>
        plate(`${p.id}.${i.name}`, p.guest, [item(i.name)], {
          owed: { why: 'Bring after', reason: '', since: NOW, course: null },
        }),
      ),
  );
  const gone: NextState = {
    ...s,
    plates: [
      ...s.plates.map((p) => (t.plates.includes(p.id) ? { ...p, stage: 'onItsWay' as Stage } : p)),
      ...owed,
    ],
    say: `${t.table}’s tray is on its way.`,
  };
  return keep(s, `Take to ${t.table}`, ['take'], gone);
}

export function onItsWay(s: NextState): boolean {
  return trayPlates(s).some((p) => p.stage === 'onItsWay' || p.stage === 'served');
}

function finishIfDone(s: NextState): NextState {
  const t = s.tray;
  if (t == null) return s;
  const left = t.plates.some((id) => plateOf(s, id).stage !== 'served');
  if (left) return s;
  const held = heldAt(s, t.table).length > 0;
  return { ...s, tray: null, afterTray: held ? t.table : null, servedLine: '', sendingBack: null };
}

export function tick(s: NextState, id: string): NextState {
  const p = plateOf(s, id);
  if (p.stage !== 'onItsWay') return s;
  const g = guestOf(p.guest);
  if (!s.online && g.flags.length > 0) return { ...s, refused: flaggedOffline(g.name) };
  const served = update(s, id, (x) => ({ ...x, stage: 'served' }));
  return keep(
    s,
    `${g.name} served`,
    [id],
    finishIfDone({ ...served, say: `${g.name} is served.` }),
  );
}

/** All served ticks every plate on the tray except a flagged guest's, who is ticked by name. */
export function allServed(s: NextState): NextState {
  const ways = trayPlates(s).filter((p) => p.stage === 'onItsWay');
  const plain = ways.filter((p) => guestOf(p.guest).flags.length === 0);
  if (plain.length === 0) return s;
  const left = ways.length - plain.length;
  const ids = plain.map((p) => p.id);
  const doneCount = trayPlates(s).filter((p) => p.stage === 'served').length + plain.length;
  const line = `${countWords(doneCount, 'served', 'served')} · ${left} to tick by name`;
  const next: NextState = {
    ...s,
    plates: s.plates.map((p) => (ids.includes(p.id) ? { ...p, stage: 'served' } : p)),
    servedLine: left > 0 ? line : '',
    say: left > 0 ? line : `${countWords(doneCount, 'served', 'served')}`,
  };
  return keep(s, 'All served', ids, finishIfDone(next));
}

export function openSendBack(s: NextState, id: string | null): NextState {
  return { ...s, sendingBack: id };
}

/** Sends nothing until a reason is chosen; the plate goes back owed, First on the next tray to its table. */
export function sendBack(s: NextState, id: string, reason: Reason): NextState {
  const t = s.tray;
  const p = plateOf(s, id);
  if (t == null || p.stage !== 'onItsWay') return s;
  const g = guestOf(p.guest);
  const back: NextState = update(
    { ...s, tray: { ...t, plates: t.plates.filter((x) => x !== id) }, sendingBack: null },
    id,
    (x) => ({
      ...x,
      stage: 'toServe',
      owed: { why: 'Sent back', reason, since: NOW, course: null },
      items: x.items.map((i) => ({ ...i, mark: 'none' as Mark })),
    }),
  );
  const said =
    reason === 'Allergy concern'
      ? `Seat ${g.seat} is sent back, first on your next tray. ${LEAD}, the floor lead, is told.`
      : `Seat ${g.seat} is sent back, first on your next tray.`;
  return keep(s, `Send back Seat ${g.seat}: ${reason}`, [id], finishIfDone({ ...back, say: said }));
}

export function heldAt(s: NextState, table: string): readonly Plate[] {
  return s.plates
    .filter((p) => p.stage === 'toServe' && isHeld(p) && guestOf(p.guest).table === table)
    .sort(bySeat);
}

export function waitingOnKitchen(s: NextState): readonly Plate[] {
  const tables = myTables(s);
  return s.plates
    .filter((p) => p.stage === 'toServe' && isHeld(p) && tables.includes(guestOf(p.guest).table))
    .sort((a, b) => (a.held?.since ?? '').localeCompare(b.held?.since ?? ''));
}

export function readyLine(p: Plate): string {
  const h = p.held;
  if (h == null) return '';
  return h.readyIn == null ? '' : `Ready in about ${h.readyIn} min`;
}

export function chooseHeld(s: NextState, id: string, choice: 'now' | 'wait'): NextState {
  const p = plateOf(s, id);
  const h = p.held;
  if (h == null) return s;
  if (choice === 'now' && !h.anyReady) return s;
  const g = guestOf(p.guest);
  const chosen =
    choice === 'wait'
      ? update(s, id, (x) => ({ ...x, held: { ...h, choice: 'wait' } }))
      : update(s, id, (x) => ({
          ...x,
          held: null,
          items: x.items.map((i) => (h.items.includes(i.name) ? { ...i, follow: true } : i)),
        }));
  const words =
    choice === 'wait'
      ? `${g.name} waits for the whole plate.`
      : `What’s ready for ${g.name} goes on your next tray.`;
  const what = choice === 'wait' ? `Wait for all, ${g.name}` : `What’s ready, now, ${g.name}`;
  const left =
    chosen.afterTray == null
      ? []
      : heldAt(chosen, chosen.afterTray).filter((x) => x.held?.choice == null);
  const after = left.length === 0 ? { ...chosen, afterTray: null } : chosen;
  return keep(s, what, [id], { ...after, say: words });
}

export function goNext(s: NextState): NextState {
  return { ...s, afterTray: null, say: '' };
}

export function pause(s: NextState): NextState {
  const t = s.tray;
  if (t == null || t.paused != null) return s;
  return keep(s, 'Pause the tray', ['pause'], {
    ...s,
    tray: { ...t, paused: { at: NOW, by: WAITER } },
    say: 'The tray is paused.',
  });
}

export function carryOn(s: NextState): NextState {
  const t = s.tray;
  if (t == null || t.paused == null) return s;
  return keep(s, 'Carry on', ['pause'], {
    ...s,
    tray: { ...t, paused: null },
    say: 'Carrying on.',
  });
}

export function setPerTrip(s: NextState, n: number): NextState {
  if (n < 1 || n > 8 || n === s.perTrip) return s;
  return keep(s, `Plates per trip: ${n}`, ['perTrip'], {
    ...s,
    perTrip: n,
    say: `Plates per trip, ${n}`,
  });
}

function request(s: NextState, id: string, change: (r: Request) => Request | null): NextState {
  if (!s.online) return { ...s, refused: REQUEST_OFFLINE };
  return {
    ...s,
    refused: '',
    requests: s.requests.flatMap((r) => {
      if (r.id !== id) return [r];
      const c = change(r);
      return c == null ? [] : [c];
    }),
  };
}

export function takeRequest(s: NextState, id: string): NextState {
  return {
    ...request(s, id, (r) => ({ ...r, mine: true })),
    say: s.online ? 'The request is yours.' : '',
  };
}

export function doneRequest(s: NextState, id: string): NextState {
  return { ...request(s, id, () => null), say: s.online ? 'The request is done.' : '' };
}

export function startDecline(s: NextState, id: string): NextState {
  return request(s, id, (r) => ({ ...r, declining: true }));
}

export function keepRequest(s: NextState, id: string): NextState {
  return {
    ...s,
    requests: s.requests.map((r) =>
      r.id === id ? { ...r, declining: false, reason: '', reasonWrong: false } : r,
    ),
  };
}

export function reasonFor(s: NextState, id: string, reason: string): NextState {
  return {
    ...s,
    requests: s.requests.map((r) => (r.id === id ? { ...r, reason, reasonWrong: false } : r)),
  };
}

export function sendDecline(s: NextState, id: string): NextState {
  const r = s.requests.find((x) => x.id === id);
  if (r == null) return s;
  if (r.reason.trim() === '')
    return {
      ...s,
      requests: s.requests.map((x) => (x.id === id ? { ...x, reasonWrong: true } : x)),
    };
  return { ...request(s, id, () => null), say: s.online ? 'The request is declined.' : '' };
}

export function undo(s: NextState): NextState {
  const u = s.undo;
  if (u == null) return s;
  const back = { ...u.before, say: `Undone: ${u.what}.`, undo: null };
  return s.online
    ? { ...back, online: true }
    : {
        ...back,
        online: false,
        kept: [...s.kept, { what: `Undo ${u.what}`, plate: null }],
        waiting: s.waiting,
      };
}

/** Back online: each kept tap is sent in order; one the server refuses is a Not sent line, and a kept tap that rests on it is dropped with it (sc-97571). */
export function reconnect(s: NextState): NextState {
  const off = s.leadTookOff;
  if (off == null)
    return {
      ...s,
      online: true,
      kept: [],
      waiting: [],
      refused: '',
      say: stripLine({ ...s, online: true }),
    };
  const g = guestOf(plateOf(s, off).guest);
  const t = s.tray;
  const plates = s.plates.map((p) =>
    p.id === off
      ? {
          ...p,
          stage: 'toServe' as Stage,
          items: p.items.map((i) => ({ ...i, mark: 'none' as Mark })),
        }
      : p,
  );
  const restored: NextState = {
    ...s,
    online: true,
    plates,
    tray: t == null ? null : { ...t, plates: t.plates.filter((x) => x !== off), check: 'open' },
    kept: [],
    waiting: [],
    refused: '',
    undo: null,
    leadTookOff: null,
    notSent: [`${LEAD_FIRST} took ${g.name} off this tray.`],
  };
  return { ...restored, say: restored.notSent.join(' ') };
}

export function goOffline(s: NextState): NextState {
  return { ...s, online: false, refused: '', say: '' };
}

export function leadTakesOff(s: NextState, id: string): NextState {
  return { ...s, leadTookOff: id };
}

export function trayTitle(s: NextState): string {
  const t = s.tray;
  if (t == null) return '';
  return `${t.table} · ${countWords(t.plates.length, 'plate', 'plates')}`;
}

export function stageWord(p: Plate): string {
  switch (p.stage) {
    case 'toServe':
      return 'To serve';
    case 'tray':
      return 'Dishing';
    case 'checked':
      return 'Checked';
    case 'onItsWay':
      return 'On its way';
    case 'served':
      return 'Served';
    case 'elsewhere':
      return 'On another tray';
  }
}

export function owedLine(p: Plate): string {
  const o = p.owed;
  if (o == null) return '';
  const why = o.why === 'Sent back' ? `Sent back: ${o.reason}` : o.why;
  return o.course == null ? `First · ${why}` : `First · ${why} · ${o.course}`;
}

export function dish(p: Plate): string {
  return p.items.map((i) => (i.follow ? `${i.name} to follow` : i.name)).join(', ');
}
