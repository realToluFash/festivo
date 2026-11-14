export const NOW = '20:24';
export const AS_OF = '20:22';
export const EVENT = 'Adaeze & Tunde’s wedding';
export const LEAD = 'Ifeoma Nduka';
export const WAITER = 'Bisi Lawal';
export const OTHER = 'Grace Udo';
export const COURSE = 'Mains';
export const BEHIND_AFTER = 20;

export type Word = 'behind' | 'serve' | 'tray' | 'kitchen' | 'notHere' | 'notFired' | 'served';

export const WORD_ORDER: readonly Word[] = [
  'behind',
  'serve',
  'tray',
  'kitchen',
  'notHere',
  'notFired',
  'served',
];

export const WORD: Record<Word, string> = {
  behind: 'Behind',
  serve: 'To serve',
  tray: 'On a tray',
  kitchen: 'Waiting on the kitchen',
  notHere: 'Not here yet',
  notFired: 'Not fired yet',
  served: 'Served',
};

export const KEY: readonly { word: Word; label: string }[] = WORD_ORDER.map((w) => ({
  word: w,
  label: w === 'behind' ? 'Behind · {n} min' : WORD[w],
}));

export type Stage = 'To serve' | 'Dishing' | 'Checked' | 'On its way' | 'Served';
export type SeatState =
  | Stage
  | 'Waiting on the kitchen'
  | 'Not here yet'
  | 'Nothing for this course'
  | 'Not fired yet'
  | 'Left';

export interface Owed {
  items: string;
  reason: string;
  course?: string;
}

export interface Held {
  items: string;
  ready: number;
  choice: 'What’s ready, now' | 'Wait for all';
}

export interface Seat {
  n: number;
  name: string | null;
  flags: string[];
  dish: string | null;
  state: SeatState;
  held?: Held;
  owed: Owed[];
}

export interface Tray {
  waiter: string;
  plates: number;
  stage: 'Dishing' | 'Checked' | 'On its way';
  paused: boolean;
}

export type Kind = 'table' | 'plate' | 'moment' | 'other';

export const KIND_WORD: Record<Kind, string> = {
  table: 'Something for the table',
  plate: 'Change a plate',
  moment: 'A moment',
  other: 'Other',
};

export interface Request {
  id: string;
  kind: Kind;
  seat: number | null;
  words: string;
  opened: string;
  owner: string | null;
  plate?: { now: string; next: string };
  closed?: { outcome: 'Done' | 'Declined'; by: string; at: string; reason?: string };
}

export interface RoomTable {
  n: number;
  section: string;
  covers: number;
  has: Partial<Record<Exclude<Word, 'behind'>, boolean>>;
  earlier?: string | undefined;
  wait: number | null;
  seats: Seat[];
  trays: Tray[];
  requests: Request[];
}

export interface Section {
  id: string;
  people: string[];
}

export const SECTIONS: readonly Section[] = [
  { id: 'A', people: ['Mei Chen'] },
  { id: 'B', people: ['Funmi Bakare', OTHER] },
  { id: 'C', people: [] },
  { id: 'D', people: [WAITER] },
];

export function sectionName(id: string): string {
  return `Section ${id}`;
}

export function onItLine(sec: Section): string {
  return sec.people.length === 0 ? 'Nobody on it' : sec.people.join(', ');
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function openFor(r: Request, now = NOW): number {
  return minutes(now) - minutes(r.opened);
}

function flagged(seat: Seat): boolean {
  return (
    seat.flags.length > 0 &&
    (seat.state !== 'Served' || seat.owed.length > 0) &&
    seat.state !== 'Left'
  );
}

export function flaggedSeats(t: RoomTable): Seat[] {
  return t.seats.filter(flagged);
}

export function openRequests(t: RoomTable): Request[] {
  return t.requests.filter((r) => r.closed == null);
}

export function closedRequests(t: RoomTable): Request[] {
  return t.requests.filter((r) => r.closed != null);
}

export function isBehind(t: RoomTable): boolean {
  const onItsWay = t.trays.some((tr) => tr.stage === 'On its way' && !tr.paused);
  return t.wait != null && t.wait >= BEHIND_AFTER && !onItsWay;
}

export function wordOf(t: RoomTable): Word {
  if (isBehind(t)) return 'behind';
  return WORD_ORDER.find((w) => w !== 'behind' && t.has[w] === true) ?? 'served';
}

export function stateWord(t: RoomTable): string {
  const w = wordOf(t);
  const word = w === 'behind' ? `Behind · ${t.wait ?? 0} min` : WORD[w];
  return t.earlier == null ? word : `${t.earlier} · ${word}`;
}

export function waitWord(t: RoomTable): string {
  return t.wait == null ? 'Nothing waiting' : `${t.wait} min`;
}

export function flaggedWord(n: number): string {
  return `${n} flagged`;
}

export function flaggedSaid(n: number): string {
  return n === 1 ? '1 flagged guest still to serve' : `${n} flagged guests still to serve`;
}

export function coversSaid(n: number): string {
  return n === 1 ? '1 cover' : `${n} covers`;
}

export function tableLabel(t: RoomTable): string {
  const w = wordOf(t);
  const parts = [`Table ${t.n}`];
  if (t.earlier != null) parts.push(t.earlier);
  parts.push(WORD[w]);
  if (w === 'behind') parts.push(`${t.wait ?? 0} minutes`);
  if (openRequests(t).length > 0) parts.push('request open');
  parts.push(coversSaid(t.covers));
  const f = flaggedSeats(t).length;
  if (f > 0) parts.push(flaggedSaid(f));
  return parts.join(', ');
}

export type SortKey = 'table' | 'section' | 'wait';
export interface Sort {
  key: SortKey;
  reversed: boolean;
}

const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function byTable(a: RoomTable, b: RoomTable): number {
  return COLLATOR.compare(`Table ${a.n}`, `Table ${b.n}`);
}

function bySection(a: RoomTable, b: RoomTable): number {
  return COLLATOR.compare(a.section, b.section) || byTable(a, b);
}

function byWait(a: RoomTable, b: RoomTable): number {
  if (a.wait == null && b.wait == null) return byTable(a, b);
  if (a.wait == null) return 1;
  if (b.wait == null) return -1;
  return b.wait - a.wait || byTable(a, b);
}

const SORTS: Record<SortKey, (a: RoomTable, b: RoomTable) => number> = {
  table: byTable,
  section: bySection,
  wait: byWait,
};

export function sorted(tables: readonly RoomTable[], sort: Sort): RoomTable[] {
  const out = [...tables].sort(SORTS[sort.key]);
  return sort.reversed ? out.reverse() : out;
}

export function pressSort(sort: Sort, key: SortKey): Sort {
  return sort.key === key ? { key, reversed: !sort.reversed } : { key, reversed: false };
}

export function ariaSort(sort: Sort, key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none';
  const first = key === 'wait' ? 'descending' : 'ascending';
  if (!sort.reversed) return first;
  return first === 'ascending' ? 'descending' : 'ascending';
}

export function sectionTables(tables: readonly RoomTable[], id: string): RoomTable[] {
  return tables.filter((t) => t.section === id);
}

export function sectionBehind(tables: readonly RoomTable[], id: string): boolean {
  return sectionTables(tables, id).some(isBehind);
}

export function tablesWord(n: number): string {
  return n === 1 ? '1 table' : `${n} tables`;
}

export function trayLine(tr: Tray): string {
  return `${tr.waiter} · ${tr.plates === 1 ? '1 plate' : `${tr.plates} plates`} · ${tr.stage}`;
}

export function seatWho(seat: Seat): string {
  return seat.name ?? `Seat ${seat.n}`;
}

export function owedLine(o: Owed): string {
  return o.course == null ? `${o.reason} · ${o.items}` : `${o.course} · ${o.reason} · ${o.items}`;
}

export function heldLine(h: Held): string {
  return `${h.items} · Ready in about ${h.ready} min`;
}

export function kindLine(r: Request): string {
  return r.seat == null ? KIND_WORD[r.kind] : `${KIND_WORD[r.kind]} · seat ${r.seat}`;
}

export function ownerLine(r: Request, viewer: string, now = NOW): string {
  const open = `open ${openFor(r, now)} min`;
  if (r.kind === 'moment') return `With ${LEAD}, floor lead · ${open}`;
  if (r.owner == null) return `Nobody on it · ${open}`;
  if (r.owner === viewer) return `You’re on it · ${open}`;
  return `${r.owner} is on it · ${open}`;
}

export function closedLine(r: Request): string {
  return r.closed == null ? '' : `${r.closed.outcome} · ${r.closed.by} · ${r.closed.at}`;
}

export type Action = 'take' | 'done' | 'decline';

export const ACTION_WORD: Record<Action, string> = {
  take: 'I’ll do it',
  done: 'Done',
  decline: 'Decline',
};

export function actions(r: Request, manage: boolean): Action[] {
  if (!manage || r.closed != null) return [];
  if (r.kind !== 'moment' && r.owner == null) return ['take', 'decline'];
  return ['done', 'decline'];
}

export type Refusal = 'closedFirst' | 'plate_stage_invalid' | 'dish_not_for_guest';

export const OFFLINE_ACTION =
  'Taking, finishing and declining a request need a connection. Nothing is kept to send later.';
export const DECLINE_BLANK = 'Say why it can’t be done';
export const NO_MANAGE = 'Handling requests on any table needs Run the service.';
export const CLOSED_FIRST_AT = '20:23';

export function refusalLine(r: Request, why: Refusal): string {
  const seat = r.seat ?? 0;
  switch (why) {
    case 'closedFirst':
      return `Not closed. ${r.owner ?? OTHER} closed this request at ${CLOSED_FIRST_AT}.`;
    case 'plate_stage_invalid':
      return `Not changed. Seat ${seat}’s ${COURSE} became Dishing before Done, so it can’t change now. The request is still open.`;
    case 'dish_not_for_guest':
      return `Not changed. A flag added since rules out ${r.plate?.next ?? 'that dish'} for seat ${seat}. The request is still open.`;
  }
}

export type AlertKind = 'request' | 'behind' | 'allergy';

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  sub: string;
  flag: string;
  table: number;
  request?: string;
}

function seat(
  n: number,
  name: string | null,
  dish: string | null,
  state: SeatState,
  extra: Partial<Seat> = {},
): Seat {
  return { n, name, flags: [], dish, state, owed: [], ...extra };
}

const DISHES = [
  'Jollof rice · chicken',
  'Grilled fish · pepper sauce',
  'Vegetable stew',
  'Goat curry',
];

function seats(covers: number, state: SeatState): Seat[] {
  return Array.from({ length: covers }, (_, i) =>
    seat(i + 1, null, DISHES[i % DISHES.length] ?? null, state, {
      ...(state === 'Waiting on the kitchen'
        ? { held: { items: 'Jollof rice', ready: 4, choice: 'Wait for all' as const } }
        : {}),
    }),
  );
}

function table(
  n: number,
  section: string,
  covers: number,
  has: RoomTable['has'],
  wait: number | null,
  state: SeatState,
  extra: Partial<RoomTable> = {},
): RoomTable {
  return {
    n,
    section,
    covers,
    has,
    wait,
    seats: seats(covers, state),
    trays: [],
    requests: [],
    ...extra,
  };
}

function table9(): RoomTable {
  return {
    n: 9,
    section: 'B',
    covers: 10,
    has: { serve: true },
    wait: 22,
    seats: [
      seat(1, 'Funke Adeyemi', 'Grilled fish · pepper sauce', 'To serve', {
        flags: ['Peanut allergy'],
      }),
      seat(2, 'Hauwa Sani', 'Chicken', 'Dishing', { flags: ['Halal'] }),
      seat(3, null, 'Chicken', 'To serve'),
      seat(4, 'Adaora Eze', 'Vegetable stew', 'To serve'),
      seat(5, 'Musa Bello', 'Jollof rice · chicken', 'Dishing'),
      seat(6, null, 'Jollof rice · chicken', 'To serve'),
      seat(7, 'Chioma Nwosu', 'Goat curry', 'To serve'),
      seat(8, 'Femi Ade', 'Goat curry', 'Dishing'),
      seat(9, 'Lola Ojo', null, 'Not here yet'),
      seat(10, null, null, 'Nothing for this course'),
    ],
    trays: [{ waiter: 'Funmi Bakare', plates: 3, stage: 'Dishing', paused: false }],
    requests: [
      {
        id: 'song',
        kind: 'moment',
        seat: null,
        words: 'Sing happy birthday to Adaora when dessert comes out.',
        opened: '20:08',
        owner: LEAD,
      },
      {
        id: 'blind',
        kind: 'table',
        seat: null,
        words: 'Could the blind behind them come down a little?',
        opened: '20:18',
        owner: OTHER,
      },
      {
        id: 'chair',
        kind: 'table',
        seat: 6,
        words: 'A high chair for seat 6, please.',
        opened: '20:21',
        owner: null,
      },
      {
        id: 'stew',
        kind: 'plate',
        seat: 1,
        words: 'Vegetable stew instead of the fish.',
        opened: '20:22',
        owner: 'Funmi Bakare',
        plate: { now: 'Grilled fish · pepper sauce', next: 'Vegetable stew' },
      },
      {
        id: 'bread',
        kind: 'table',
        seat: null,
        words: 'More bread for the table.',
        opened: '20:01',
        owner: OTHER,
        closed: { outcome: 'Done', by: OTHER, at: '20:09' },
      },
      {
        id: 'music',
        kind: 'other',
        seat: null,
        words: 'Could the music be a little quieter?',
        opened: '20:05',
        owner: 'Funmi Bakare',
        closed: {
          outcome: 'Declined',
          by: 'Funmi Bakare',
          at: '20:11',
          reason: 'The band’s level is set by the couple.',
        },
      },
    ],
  };
}

function table6(): RoomTable {
  return {
    n: 6,
    section: 'B',
    covers: 10,
    has: { serve: true, kitchen: true },
    wait: 14,
    seats: [
      seat(1, 'Yemi Cole', 'Goat curry', 'To serve'),
      seat(2, 'Tari Briggs', 'Jollof rice · chicken', 'Served', {
        owed: [{ items: 'Plantain', reason: 'To follow' }],
        held: { items: 'Plantain', ready: 3, choice: 'What’s ready, now' },
      }),
      seat(3, 'Adaeze O-W', 'Grilled fish · pepper sauce', 'To serve', {
        flags: ['Nut allergy'],
        owed: [{ items: 'Grilled fish', reason: 'Sent back · Allergy concern' }],
      }),
      seat(4, null, 'Jollof rice · chicken', 'Dishing'),
      seat(5, 'Ngozi Obi', 'Grilled fish · pepper sauce', 'Waiting on the kitchen', {
        held: { items: 'Grilled fish', ready: 5, choice: 'Wait for all' },
      }),
      seat(6, null, 'Vegetable stew', 'Dishing'),
      seat(7, 'Seyi Adebayo', null, 'Left'),
      seat(8, 'Kemi Oke', 'Goat curry', 'To serve', {
        owed: [{ items: 'Small chops', reason: 'Bring after', course: 'Starter' }],
      }),
      seat(9, null, 'Goat curry', 'To serve'),
      seat(10, null, 'Jollof rice · chicken', 'Served'),
    ],
    trays: [{ waiter: OTHER, plates: 2, stage: 'Dishing', paused: false }],
    requests: [],
  };
}

export function room(): RoomTable[] {
  return [
    table(1, 'A', 8, { served: true }, null, 'Served'),
    table(2, 'A', 8, { tray: true }, 21, 'On its way', {
      trays: [{ waiter: 'Mei Chen', plates: 8, stage: 'On its way', paused: false }],
    }),
    table(3, 'A', 6, { serve: true }, 12, 'To serve', {
      requests: [
        {
          id: 'napkins',
          kind: 'table',
          seat: null,
          words: 'More napkins, please.',
          opened: '20:20',
          owner: null,
        },
      ],
    }),
    table(4, 'A', 10, { kitchen: true }, null, 'Waiting on the kitchen'),
    table(5, 'A', 8, { served: true }, null, 'Served', { earlier: 'Starter' }),
    table6(),
    table(7, 'B', 10, { served: true }, null, 'Served'),
    table(8, 'B', 8, { serve: true }, 20, 'To serve'),
    table9(),
    table(10, 'B', 8, { tray: true }, 9, 'Checked', {
      trays: [{ waiter: 'Funmi Bakare', plates: 4, stage: 'Checked', paused: false }],
    }),
    table(11, 'B', 6, { notHere: true }, null, 'Not here yet'),
    table(12, 'C', 10, { serve: true }, 15, 'To serve'),
    table(14, 'C', 8, { notFired: true }, null, 'Not fired yet'),
    table(15, 'D', 8, { served: true }, null, 'Served'),
    table(16, 'D', 10, { kitchen: true }, null, 'Waiting on the kitchen'),
    table(17, 'D', 8, { serve: true }, 6, 'To serve', {
      seats: seats(8, 'To serve').map((s) =>
        s.n === 4 ? { ...s, name: 'Kola Ige', flags: ['Vegetarian'], dish: 'Vegetable stew' } : s,
      ),
    }),
    table(18, 'D', 10, { tray: true }, 3, 'Dishing', {
      trays: [{ waiter: WAITER, plates: 5, stage: 'Dishing', paused: false }],
    }),
  ];
}

export function notStartedRoom(): RoomTable[] {
  return room().map((t) => ({
    ...t,
    has: t.n === 11 ? { notHere: true } : { notFired: true },
    earlier: undefined,
    wait: null,
    seats: seats(t.covers, t.n === 11 ? 'Not here yet' : 'Not fired yet'),
    trays: [],
    requests: [],
  }));
}

export function alertsOf(tables: readonly RoomTable[]): Alert[] {
  const out: Alert[] = [];
  for (const t of tables)
    for (const r of openRequests(t))
      if (r.kind !== 'moment' && openFor(r) >= 5)
        out.push({
          id: `request-${r.id}`,
          kind: 'request',
          title: 'A request open 5 min',
          sub: `Table ${t.n} · “${r.words}”`,
          flag: '',
          table: t.n,
          request: r.id,
        });
  for (const sec of SECTIONS) {
    const behind = sectionTables(tables, sec.id).filter(isBehind);
    const longest = [...behind].sort(byWait)[0];
    if (longest != null)
      out.push({
        id: `behind-${sec.id}`,
        kind: 'behind',
        title: `${sectionName(sec.id)} is Behind`,
        sub: `Table ${longest.n} has waited longest · ${longest.wait ?? 0} min`,
        flag: '',
        table: longest.n,
      });
  }
  for (const t of tables)
    for (const s of t.seats)
      if (s.owed.some((o) => o.reason === 'Sent back · Allergy concern'))
        out.push({
          id: `allergy-${t.n}-${s.n}`,
          kind: 'allergy',
          title: 'A plate sent back · Allergy concern',
          sub: `Table ${t.n} · ${seatWho(s)}`,
          flag: s.flags.join(', '),
          table: t.n,
        });
  return out;
}

export type View = 'going' | 'plan' | 'list';
export type Strip = 'connected' | 'offline' | 'notStarted' | 'refreshing' | 'unreachable';

export function stripLine(strip: Strip): string {
  switch (strip) {
    case 'connected':
      return `Connected · up to date ${NOW}`;
    case 'offline':
      return `No connection · as of ${AS_OF}`;
    case 'notStarted':
      return 'Not started yet';
    case 'refreshing':
      return 'Refreshing';
    case 'unreachable':
      return `As of ${AS_OF} · couldn’t refresh, trying again`;
  }
}

export const ROOM_STATES = [
  'populated',
  'list',
  'listWait',
  'panel',
  'panelHeld',
  'panelPaused',
  'reqNobody',
  'reqYours',
  'reqOther',
  'reqMoment',
  'declineBlank',
  'refusedStage',
  'refusedDish',
  'closedFirst',
  'noManage',
  'alertBehind',
  'alertRequest',
  'alertAllergy',
  'alertsEmpty',
  'earlier',
  'noPlan',
  'notStarted',
  'offline',
  'loading',
  'refreshing',
  'unreachable',
] as const;

export type RoomStateName = (typeof ROOM_STATES)[number];

export function roomStateOf(raw: string | null | undefined): RoomStateName {
  return (ROOM_STATES as readonly string[]).includes(raw ?? '')
    ? (raw as RoomStateName)
    : 'populated';
}

export const ROOM_STATE_WHAT: Record<RoomStateName, string> = {
  populated: 'The whole room as a plan, with sections and alerts',
  list: 'The room as a list, by table',
  listWait: 'The list sorted by Wait, longest first',
  panel: 'Table 9’s panel: flagged guests, requests, trays, seats, closed',
  panelHeld: 'Table 6’s panel: a held guest and owed plates',
  panelPaused: 'Table 9’s panel with its tray paused, still Behind',
  reqNobody: 'A request nobody has: I’ll do it, Decline',
  reqYours: 'A request that is yours: Done, Decline',
  reqOther: 'A request somebody else has: Done, Decline',
  reqMoment: 'A moment: Done, Decline',
  declineBlank: 'Decline pressed with no reason',
  refusedStage: 'Change a plate refused: plate_stage_invalid',
  refusedDish: 'Change a plate refused: dish_not_for_guest',
  closedFirst: 'Closed first by somebody else',
  noManage: 'Without service.manage: no buttons, no Alerts',
  alertBehind: 'Go to table from Section B is Behind',
  alertRequest: 'Go to table from A request open 5 min',
  alertAllergy: 'Go to table from Allergy concern',
  alertsEmpty: 'Alerts with nothing in them',
  earlier: 'A table on an earlier course',
  noPlan: 'No floor plan for this venue',
  notStarted: 'Before service starts',
  offline: 'No connection: request buttons refused',
  loading: 'Loading',
  refreshing: 'Refreshing',
  unreachable: 'Couldn’t refresh, trying again',
};

export interface Room {
  name: RoomStateName;
  view: View;
  tables: RoomTable[];
  manage: boolean;
  viewer: string;
  strip: Strip;
  started: boolean;
  hasPlan: boolean;
  loading: boolean;
  sort: Sort;
  open: number | null;
  first: string | null;
  pending: Refusal | null;
  declining: string | null;
  reason: string;
  reasonWrong: boolean;
  notice: Record<string, string>;
  noDone: string[];
  refused: string;
  say: string;
}

function withTable(tables: RoomTable[], n: number, f: (t: RoomTable) => RoomTable): RoomTable[] {
  return tables.map((t) => (t.n === n ? f(t) : t));
}

function withRequest(tables: RoomTable[], id: string, f: (r: Request) => Request): RoomTable[] {
  return tables.map((t) => ({ ...t, requests: t.requests.map((r) => (r.id === id ? f(r) : r)) }));
}

export function roomSeed(name: RoomStateName): Room {
  const base: Room = {
    name,
    view: 'plan',
    tables: room(),
    manage: true,
    viewer: LEAD,
    strip: 'connected',
    started: true,
    hasPlan: true,
    loading: false,
    sort: { key: 'table', reversed: false },
    open: null,
    first: null,
    pending: null,
    declining: null,
    reason: '',
    reasonWrong: false,
    notice: {},
    noDone: [],
    refused: '',
    say: '',
  };
  const t9 = { ...base, open: 9 };
  switch (name) {
    case 'populated':
      return base;
    case 'list':
      return { ...base, view: 'list' };
    case 'listWait':
      return { ...base, view: 'list', sort: { key: 'wait', reversed: false } };
    case 'panel':
      return t9;
    case 'panelHeld':
      return { ...base, open: 6 };
    case 'panelPaused':
      return {
        ...t9,
        tables: withTable(base.tables, 9, (t) => ({
          ...t,
          trays: [{ waiter: 'Funmi Bakare', plates: 3, stage: 'On its way', paused: true }],
        })),
      };
    case 'reqNobody':
      return { ...t9, first: 'chair' };
    case 'reqYours':
      return {
        ...t9,
        first: 'chair',
        tables: withRequest(base.tables, 'chair', (r) => ({ ...r, owner: LEAD })),
      };
    case 'reqOther':
      return { ...t9, first: 'blind' };
    case 'reqMoment':
      return { ...t9, first: 'song' };
    case 'declineBlank':
      return { ...t9, first: 'chair', declining: 'chair', reasonWrong: true };
    case 'refusedStage':
      return done({ ...t9, first: 'stew', pending: 'plate_stage_invalid' }, 'stew');
    case 'refusedDish':
      return done({ ...t9, first: 'stew', pending: 'dish_not_for_guest' }, 'stew');
    case 'closedFirst':
      return done({ ...t9, first: 'blind', pending: 'closedFirst' }, 'blind');
    case 'noManage':
      return { ...t9, manage: false, viewer: WAITER };
    case 'alertBehind':
      return goToTable(base, 'behind-B');
    case 'alertRequest':
      return goToTable(base, 'request-blind');
    case 'alertAllergy':
      return goToTable(base, 'allergy-6-3');
    case 'alertsEmpty':
      return {
        ...base,
        tables: base.tables.map((t) => ({
          ...t,
          wait: t.wait != null && t.wait >= BEHIND_AFTER ? 12 : t.wait,
          requests: t.requests.filter((r) => r.closed != null || r.kind === 'moment'),
          seats: t.seats.map((s) => ({
            ...s,
            owed: s.owed.filter((o) => !o.reason.startsWith('Sent back')),
          })),
        })),
      };
    case 'earlier':
      return { ...base, open: 5 };
    case 'noPlan':
      return { ...base, view: 'list', hasPlan: false };
    case 'notStarted':
      return { ...base, tables: notStartedRoom(), strip: 'notStarted', started: false };
    case 'offline':
      return { ...t9, strip: 'offline' };
    case 'loading':
      return { ...base, loading: true };
    case 'refreshing':
      return { ...base, strip: 'refreshing' };
    case 'unreachable':
      return { ...base, strip: 'unreachable' };
  }
}

export function tableOf(r: Room, n: number | null): RoomTable | undefined {
  return r.tables.find((t) => t.n === n);
}

export function requestsInOrder(r: Room, t: RoomTable): Request[] {
  const open = [...openRequests(t)].sort((a, b) => openFor(b) - openFor(a));
  const first = open.find((q) => q.id === r.first);
  return first == null ? open : [first, ...open.filter((q) => q !== first)];
}

export function offered(r: Room, q: Request): Action[] {
  return actions(q, r.manage).filter((a) => !(a === 'done' && r.noDone.includes(q.id)));
}

export function openPanel(r: Room, n: number): Room {
  return { ...r, open: n, first: null, declining: null, reasonWrong: false, refused: '' };
}

export function closePanel(r: Room): Room {
  return { ...r, open: null, first: null, declining: null, reasonWrong: false, refused: '' };
}

export function goToTable(r: Room, alertId: string): Room {
  const a = alertsOf(r.tables).find((x) => x.id === alertId);
  if (a == null) return r;
  return { ...openPanel(r, a.table), first: a.request ?? null };
}

function offline(r: Room): Room {
  return { ...r, refused: OFFLINE_ACTION, say: OFFLINE_ACTION };
}

function findRequest(r: Room, id: string): Request | undefined {
  return r.tables.flatMap((t) => t.requests).find((q) => q.id === id);
}

export function take(r: Room, id: string): Room {
  if (r.strip === 'offline') return offline(r);
  const q = findRequest(r, id);
  return {
    ...r,
    tables: withRequest(r.tables, id, (x) => ({ ...x, owner: r.viewer })),
    say: `You’re on it. ${q?.words ?? ''}`,
  };
}

export function done(r: Room, id: string): Room {
  if (r.strip === 'offline') return offline(r);
  const q = findRequest(r, id);
  if (q == null) return r;
  if (r.pending === 'closedFirst') {
    const line = refusalLine(q, 'closedFirst');
    return {
      ...r,
      pending: null,
      tables: withRequest(r.tables, id, (x) => ({
        ...x,
        closed: { outcome: 'Done', by: x.owner ?? OTHER, at: CLOSED_FIRST_AT },
      })),
      notice: { ...r.notice, [id]: line },
      say: line,
    };
  }
  if (q.kind === 'plate' && r.pending != null) {
    const line = refusalLine(q, r.pending);
    return {
      ...r,
      pending: null,
      notice: { ...r.notice, [id]: line },
      noDone: [...r.noDone, id],
      say: line,
    };
  }
  let tables = withRequest(r.tables, id, (x) => ({
    ...x,
    closed: { outcome: 'Done', by: r.viewer, at: NOW },
  }));
  if (q.kind === 'plate' && q.plate != null && q.seat != null) {
    const { seat: n, plate } = q;
    tables = tables.map((t) =>
      t.requests.some((x) => x.id === id)
        ? { ...t, seats: t.seats.map((s) => (s.n === n ? { ...s, dish: plate.next } : s)) }
        : t,
    );
  }
  return { ...r, tables, say: `Done. ${q.words}` };
}

export function openDecline(r: Room, id: string): Room {
  if (r.strip === 'offline') return offline(r);
  return { ...r, declining: id, reason: '', reasonWrong: false };
}

export function decline(r: Room): Room {
  if (r.strip === 'offline') return offline(r);
  const id = r.declining;
  const q = id == null ? undefined : findRequest(r, id);
  if (id == null || q == null) return r;
  if (r.reason.trim() === '') return { ...r, reasonWrong: true, say: DECLINE_BLANK };
  return {
    ...r,
    declining: null,
    tables: withRequest(r.tables, id, (x) => ({
      ...x,
      closed: { outcome: 'Declined', by: r.viewer, at: NOW, reason: r.reason.trim() },
    })),
    say: `Declined. ${q.words}`,
  };
}
