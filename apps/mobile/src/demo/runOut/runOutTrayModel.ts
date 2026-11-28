export type StationId = 'pass' | 'jollof' | 'grill' | 'fryer';

export interface Station {
  id: StationId;
  name: string;
  to: string;
  who: string;
}

/** The kitchen's walking order (sc-3910), and who dishes at each. */
export const WALK: readonly Station[] = [
  { id: 'pass', name: 'Pass', to: 'the Pass', who: 'Ronke Alade' },
  { id: 'jollof', name: 'Rice · Jollof', to: 'Rice · Jollof', who: 'Bisi Okon' },
  { id: 'grill', name: 'Grill', to: 'the Grill', who: 'Tayo Bamidele' },
  { id: 'fryer', name: 'Fryer', to: 'the Fryer', who: 'Gbenga Salami' },
];

export const COURSE: readonly string[] = ['Jollof rice', 'Chicken', 'Beef', 'Grilled fish'];

export const DISHED_AT: Readonly<Record<string, StationId>> = {
  'Jollof rice': 'jollof',
  Chicken: 'grill',
  Beef: 'grill',
  'Grilled fish': 'grill',
};

export const RUN_OUT = 'Chicken';
export const WAITER = 'Bisi Lawal';
export const SECTION = 'Section B';
export const NOW = '20:24';
export const AS_OF = '20:22';

export type FlagKind = 'allergen' | 'diet' | 'other';

export interface Flag {
  kind: FlagKind;
  words: string;
}

export interface Guest {
  id: string;
  name: string;
  table: number;
  seat: number;
  flags: readonly Flag[];
}

export const GUESTS: readonly Guest[] = [
  {
    id: 'fa',
    name: 'Funke Adeyemi',
    table: 9,
    seat: 1,
    flags: [{ kind: 'allergen', words: 'Fish allergy' }],
  },
  { id: 'hs', name: 'Hauwa Sani', table: 9, seat: 2, flags: [{ kind: 'diet', words: 'Halal' }] },
  { id: 'do', name: 'Dapo Ojo', table: 9, seat: 3, flags: [] },
  { id: 'tb', name: 'Tunde Bakare', table: 9, seat: 4, flags: [] },
  { id: 'ya', name: 'Yemi Alabi', table: 9, seat: 6, flags: [] },
  {
    id: 'ae',
    name: 'Adaora Eze',
    table: 14,
    seat: 2,
    flags: [{ kind: 'other', words: 'Other allergy · kiwi' }],
  },
  { id: 'eo', name: 'Emeka Obi', table: 14, seat: 5, flags: [] },
  { id: 'sm', name: 'Sola Martins', table: 3, seat: 1, flags: [] },
  { id: 'ne', name: 'Ngozi Eze', table: 3, seat: 2, flags: [] },
  { id: 'bo', name: 'Bayo Ojo', table: 3, seat: 4, flags: [] },
];

export function guestOf(id: string): Guest {
  const g = GUESTS.find((x) => x.id === id);
  if (g == null) throw new Error(`No guest ${id}`);
  return g;
}

export type Mark = 'unmarked' | 'on' | 'notOn' | 'bringAfter';

export interface Line {
  item: string;
  mark: Mark;
  /** The run-out item this line replaced, once the floor lead chose. */
  instead: string | null;
}

export type Where = 'toServe' | 'tray' | 'onItsWay';
export type HeldChoice = 'now' | 'wait' | null;

export interface Order {
  guest: string;
  where: Where;
  lines: readonly Line[];
  follow: readonly string[];
  choice: HeldChoice;
  without: string | null;
}

export interface Tray {
  table: number;
  stops: readonly StationId[];
  at: number;
  check: boolean;
}

export type Screen = 'next' | 'floor' | 'tray';

/** A waiter's step taken with no connection, kept to send (sc-4028). */
export type KeptStep = 'notOn' | 'bringAfter' | 'takeOff' | 'held';

export interface Kept {
  guest: string;
  step: KeptStep;
}

/** The floor lead's choice, made on the server while this phone had no connection. */
export interface Elsewhere {
  guest: string;
  to: string | null;
}

export interface RunOutState {
  online: boolean;
  kept: readonly Kept[];
  elsewhere: readonly Elsewhere[];
  notSent: readonly string[];
  orders: readonly Order[];
  tray: Tray | null;
  seatFour: string;
  refused: string;
  landed: readonly string[];
  say: string;
  note: string;
  screen: Screen;
}

export const RUN_OUT_STATES = [
  'runOutHeld',
  'runOutAtStop',
  'runOutBringAfter',
  'runOutPlateEmpty',
  'runOutLanded',
  'runOutOffline',
  'runOutNotSent',
] as const;

export type RunOutStateName = (typeof RUN_OUT_STATES)[number];

export const RUN_OUT_STATE_WHAT: Readonly<Record<RunOutStateName, readonly [string, string]>> = {
  runOutHeld: [
    'Held, waiting for a choice',
    'Next lists four guests held on Chicken, each with What’s ready, now and Wait for all',
  ],
  runOutAtStop: [
    'At the Grill',
    'Table 9’s tray at the Grill: three plates read Run out for Chicken',
  ],
  runOutBringAfter: [
    'Bring after, and the check passes',
    'Chicken marked Not on and Bring after on three plates: Check the tray passes',
  ],
  runOutPlateEmpty: [
    'Nothing else on the plate',
    'Bring after refused on Bayo Ojo’s plate: take it off the tray',
  ],
  runOutLanded: [
    'A replacement lands',
    'Beef lands unmarked at the Grill, and Next says Seat 4: Beef instead of Chicken',
  ],
  runOutOffline: [
    'No connection',
    'Bring after on Seat 4 with no connection: kept, marked Waiting to send',
  ],
  runOutNotSent: [
    'Not sent',
    'Beef took Chicken’s place while offline: the kept Bring after is not sent, Beef shows at the Grill',
  ],
};

export function runOutStateOf(raw: string | undefined): RunOutStateName {
  return (RUN_OUT_STATES as readonly string[]).includes(raw ?? '')
    ? (raw as RunOutStateName)
    : 'runOutAtStop';
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

export function stationOf(id: StationId): Station {
  const st = WALK.find((s) => s.id === id);
  if (st == null) throw new Error(`No station ${id}`);
  return st;
}

export const HELD_LINE = `${RUN_OUT} has run out · waiting for the floor lead`;

export function plateEmptyLine(seat: number): string {
  return `Seat ${seat} has nothing else on it, so it can’t go without ${RUN_OUT}. Take it off the tray.`;
}

export function landedLine(seat: number, to: string | null): string {
  return to == null
    ? `Seat ${seat}: without ${RUN_OUT}`
    : `Seat ${seat}: ${to} instead of ${RUN_OUT}`;
}

export const OFFLINE_LEAD =
  'This phone has no connection, so the floor lead’s choice shows once it reconnects.';
export const NOT_SENT_HEAD = 'Not sent · the floor changed while you were offline';

export function keptLine(n: number): string {
  return n === 0
    ? ''
    : `${plural(n, 'step', 'steps')} waiting to send. ${n === 1 ? 'It sends' : 'They send'} when the connection is back.`;
}

const STEP_WORDS: Record<'notOn' | 'bringAfter', string> = {
  notOn: `${RUN_OUT} Not on`,
  bringAfter: `Bring after ${RUN_OUT}`,
};

export function notSentLine(step: 'notOn' | 'bringAfter', g: Guest, to: string | null): string {
  const instead = to == null ? `served it without ${RUN_OUT}` : `served ${to} instead`;
  return `${STEP_WORDS[step]}, Seat ${g.seat} · ${g.name}: the floor lead ${instead}, so it wasn’t sent.`;
}

const line = (item: string, mark: Mark = 'unmarked'): Line => ({ item, mark, instead: null });

function order(guest: string, where: Where, lines: readonly Line[]): Order {
  return { guest, where, lines, follow: [], choice: null, without: null };
}

const JOLLOF_ON = line('Jollof rice', 'on');

function tableNine(): RunOutState {
  return {
    online: true,
    kept: [],
    elsewhere: [],
    notSent: [],
    orders: [
      order('fa', 'tray', [JOLLOF_ON, line('Chicken')]),
      order('hs', 'tray', [JOLLOF_ON, line('Chicken')]),
      order('do', 'tray', [JOLLOF_ON, line('Grilled fish')]),
      order('tb', 'tray', [JOLLOF_ON, line('Chicken')]),
      order('ya', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('ae', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('eo', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('bo', 'toServe', [line('Chicken')]),
    ],
    tray: { table: 9, stops: ['pass', 'jollof', 'grill'], at: 2, check: false },
    seatFour: 'tb',
    refused: '',
    landed: [],
    say: '',
    note: '',
    screen: 'tray',
  };
}

function tableThree(): RunOutState {
  return {
    online: true,
    kept: [],
    elsewhere: [],
    notSent: [],
    orders: [
      order('sm', 'toServe', [
        line('Jollof rice'),
        { item: 'Beef', mark: 'unmarked', instead: RUN_OUT },
      ]),
      order('ne', 'tray', [JOLLOF_ON, { item: 'Beef', mark: 'unmarked', instead: RUN_OUT }]),
      order('bo', 'tray', [line('Chicken', 'notOn')]),
      order('fa', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('hs', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('tb', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('ya', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('ae', 'toServe', [line('Jollof rice'), line('Chicken')]),
      order('eo', 'toServe', [line('Jollof rice'), line('Chicken')]),
    ],
    tray: { table: 3, stops: ['pass', 'jollof', 'grill'], at: 2, check: false },
    seatFour: 'bo',
    refused: '',
    landed: [],
    say: '',
    note: '',
    screen: 'tray',
  };
}

function setMark(s: RunOutState, guest: string, item: string, mark: Mark): RunOutState {
  return {
    ...s,
    orders: s.orders.map((o) =>
      o.guest !== guest
        ? o
        : { ...o, lines: o.lines.map((l) => (l.item === item ? { ...l, mark } : l)) },
    ),
  };
}

export function seed(name: RunOutStateName): RunOutState {
  switch (name) {
    case 'runOutHeld':
      return { ...tableNine(), screen: 'next' };
    case 'runOutAtStop':
      return tableNine();
    case 'runOutBringAfter': {
      let s = tableNine();
      for (const g of ['fa', 'hs', 'tb']) s = setMark(s, g, RUN_OUT, 'bringAfter');
      s = setMark(s, 'do', 'Grilled fish', 'on');
      return s.tray == null ? s : { ...s, tray: { ...s.tray, check: true } };
    }
    case 'runOutPlateEmpty':
      return { ...tableThree(), refused: plateEmptyLine(4) };
    case 'runOutLanded': {
      const s = setMark(tableNine(), 'tb', RUN_OUT, 'notOn');
      return { ...leadChooses(s, 'tb', 'Beef'), screen: 'next' };
    }
    case 'runOutOffline':
      return bringAfter(markNotOn({ ...tableNine(), online: false }, 'tb'), 'tb');
    case 'runOutNotSent':
      return reconnect(leadChooses(seed('runOutOffline'), 'tb', 'Beef'));
  }
}

function keep(s: RunOutState, guest: string, step: KeptStep): RunOutState {
  if (s.online) return s;
  const mine = (k: Kept) => k.guest === guest;
  const rest = s.kept.filter((k) => {
    if (!mine(k)) return true;
    if (step === 'bringAfter' || step === 'takeOff')
      return k.step !== 'notOn' && k.step !== 'bringAfter';
    return k.step !== step;
  });
  return { ...s, kept: [...rest, { guest, step }] };
}

export function isKept(s: RunOutState, guest: string, steps: readonly KeptStep[]): boolean {
  return s.kept.some((k) => k.guest === guest && steps.includes(k.step));
}

/** A kept step naming the run-out item on a plate a replacement has since changed is refused (sc-4028's 409). */
export function reconnect(s: RunOutState): RunOutState {
  let next: RunOutState = { ...s, online: true, refused: '', note: '' };
  const notSent: string[] = [];
  for (const e of s.elsewhere) {
    const g = guestOf(e.guest);
    for (const k of s.kept)
      if (k.guest === e.guest && (k.step === 'notOn' || k.step === 'bringAfter'))
        notSent.push(notSentLine(k.step, g, e.to));
    next = {
      ...next,
      kept: next.kept.filter(
        (k) => k.guest !== e.guest || (k.step !== 'notOn' && k.step !== 'bringAfter'),
      ),
    };
    if (isKept(s, e.guest, ['notOn', 'bringAfter']))
      next = setMark(next, e.guest, RUN_OUT, 'unmarked');
    next = leadChooses(next, e.guest, e.to);
  }
  return { ...next, kept: [], elsewhere: [], notSent: [...s.notSent, ...notSent] };
}

export function goOffline(s: RunOutState): RunOutState {
  return { ...s, online: false, refused: '', note: '' };
}

export function dismissNotSent(s: RunOutState): RunOutState {
  return { ...s, notSent: [] };
}

export function orderOf(s: RunOutState, guest: string): Order | undefined {
  return s.orders.find((o) => o.guest === guest);
}

/** Waiting for a choice: the run-out item is on the order or owed, isn't On, and nothing has replaced it. */
export function isWaiting(o: Order): boolean {
  return o.lines.some((l) => l.item === RUN_OUT && l.mark !== 'on') || o.follow.includes(RUN_OUT);
}

const bySeat = (a: Guest, b: Guest) => a.table - b.table || a.seat - b.seat;

export interface HeldRow {
  guest: Guest;
  where: string;
  line: string;
  canChoose: boolean;
  choice: HeldChoice;
  result: string;
}

export function heldRows(s: RunOutState): readonly HeldRow[] {
  return s.orders
    .filter((o) => o.where === 'toServe' && isWaiting(o))
    .map((o) => ({ o, g: guestOf(o.guest) }))
    .sort((a, b) => bySeat(a.g, b.g))
    .map(({ o, g }) => {
      const rest = o.lines.filter((l) => l.item !== RUN_OUT).map((l) => l.item);
      const canChoose = rest.length > 0;
      let result = '';
      if (!canChoose)
        result = `${RUN_OUT} is all that’s on the plate. It goes first on a tray here once the floor lead chooses and it’s ready.`;
      else if (o.choice === 'now')
        result = `${andList(rest)} goes first on your next tray here. ${RUN_OUT} follows once the floor lead chooses.`;
      else if (o.choice === 'wait')
        result =
          'The whole plate goes first on a tray here once the floor lead chooses and it’s ready.';
      return {
        guest: g,
        where: `Table ${g.table} · seat ${g.seat}`,
        line: HELD_LINE,
        canChoose,
        choice: o.choice,
        result,
      };
    });
}

export function chooseHeld(s: RunOutState, guest: string, choice: 'now' | 'wait'): RunOutState {
  const o0 = orderOf(s, guest);
  if (o0 == null || o0.where !== 'toServe' || !isWaiting(o0)) return s;
  if (!o0.lines.some((l) => l.item !== RUN_OUT)) return s;
  return {
    ...keep(s, guest, 'held'),
    refused: '',
    orders: s.orders.map((o) => {
      if (o.guest !== guest || o.where !== 'toServe' || !isWaiting(o)) return o;
      if (!o.lines.some((l) => l.item !== RUN_OUT)) return o;
      if (choice === 'now')
        return {
          ...o,
          choice,
          lines: o.lines.filter((l) => l.item !== RUN_OUT),
          follow: o.follow.includes(RUN_OUT) ? o.follow : [...o.follow, RUN_OUT],
        };
      const back = o.follow.includes(RUN_OUT) ? [...o.lines, line(RUN_OUT)] : o.lines;
      return { ...o, choice, lines: back, follow: o.follow.filter((i) => i !== RUN_OUT) };
    }),
  };
}

export function onTray(s: RunOutState): readonly Order[] {
  return s.orders
    .filter((o) => o.where === 'tray')
    .slice()
    .sort((a, b) => bySeat(guestOf(a.guest), guestOf(b.guest)));
}

export function currentStop(s: RunOutState): Station | null {
  const t = s.tray;
  if (t == null || t.check) return null;
  const id = t.stops[t.at];
  return id == null ? null : stationOf(id);
}

export type LineLook = 'on' | 'notOn' | 'runOut' | 'bringAfter';

export interface StopLine {
  guest: Guest;
  item: string;
  look: LineLook;
  canResolve: boolean;
  instead: string | null;
  already: string;
}

function lookOf(l: Line): LineLook {
  if (l.mark === 'bringAfter') return 'bringAfter';
  if (l.item === RUN_OUT) return l.mark === 'notOn' ? 'notOn' : 'runOut';
  return l.mark === 'notOn' ? 'notOn' : 'on';
}

export function stopLines(s: RunOutState): readonly StopLine[] {
  const st = currentStop(s);
  if (st == null) return [];
  return onTray(s).flatMap((o) => {
    const g = guestOf(o.guest);
    const on = o.lines.filter((l) => l.mark === 'on').map((l) => l.item);
    return o.lines
      .filter((l) => DISHED_AT[l.item] === st.id)
      .map((l) => ({
        guest: g,
        item: l.item,
        look: lookOf(l),
        canResolve: l.item === RUN_OUT && l.mark === 'notOn',
        instead: l.instead,
        already: on.length > 0 ? `${andList(on)} on` : '',
      }));
  });
}

export function toggleLine(s: RunOutState, guest: string, item: string): RunOutState {
  const o = orderOf(s, guest);
  const l = o?.lines.find((x) => x.item === item);
  if (l == null || item === RUN_OUT || l.mark === 'bringAfter') return s;
  return setMark({ ...s, refused: '' }, guest, item, l.mark === 'notOn' ? 'unmarked' : 'notOn');
}

export function markNotOn(s: RunOutState, guest: string): RunOutState {
  const l = orderOf(s, guest)?.lines.find((x) => x.item === RUN_OUT);
  if (l == null || l.mark !== 'unmarked') return s;
  return setMark(keep({ ...s, refused: '' }, guest, 'notOn'), guest, RUN_OUT, 'notOn');
}

/** Nothing else would go on the plate: every other item is Not on or brought after. */
export function wouldEmpty(o: Order, item: string): boolean {
  return !o.lines.some((l) => l.item !== item && l.mark !== 'notOn' && l.mark !== 'bringAfter');
}

/** Bring after owes the guest whatever is chosen; refused (409 plate_empty) on a plate with nothing else on it. */
export function bringAfter(s: RunOutState, guest: string): RunOutState {
  const o = orderOf(s, guest);
  const l = o?.lines.find((x) => x.item === RUN_OUT);
  if (o == null || l == null || l.mark !== 'notOn') return s;
  if (wouldEmpty(o, RUN_OUT)) return { ...s, refused: plateEmptyLine(guestOf(guest).seat) };
  return setMark(keep({ ...s, refused: '' }, guest, 'bringAfter'), guest, RUN_OUT, 'bringAfter');
}

export function takeOff(s: RunOutState, guest: string): RunOutState {
  const o = orderOf(s, guest);
  if (o == null || o.where !== 'tray') return s;
  const g = guestOf(guest);
  return {
    ...keep(s, guest, 'takeOff'),
    refused: '',
    say: `Seat ${g.seat} is off the tray. ${g.name} is held.`,
    orders: s.orders.map((x) =>
      x.guest !== guest
        ? x
        : {
            ...x,
            where: 'toServe',
            choice: null,
            lines: x.lines.map((l) => ({ ...l, mark: 'unmarked' as Mark })),
          },
    ),
  };
}

/** On to the next stop, or to the check: what is still shown On here is marked On; run out never is. */
export function moveOn(s: RunOutState): RunOutState {
  const t = s.tray;
  const st = currentStop(s);
  if (t == null || st == null) return s;
  const orders = s.orders.map((o) =>
    o.where !== 'tray'
      ? o
      : {
          ...o,
          lines: o.lines.map((l) =>
            DISHED_AT[l.item] === st.id && l.item !== RUN_OUT && l.mark === 'unmarked'
              ? { ...l, mark: 'on' as Mark }
              : l,
          ),
        },
  );
  const last = t.at >= t.stops.length - 1;
  return {
    ...s,
    refused: '',
    orders,
    tray: last ? { ...t, check: true } : { ...t, at: t.at + 1 },
  };
}

export interface CheckRow {
  guest: Guest;
  item: string;
  station: Station;
}

export interface CheckOk {
  guest: Guest;
  sub: string;
}

export interface TrayCheck {
  passes: boolean;
  /** Run out and not yet brought after or taken off. */
  runOut: readonly CheckRow[];
  missing: readonly CheckRow[];
  ok: readonly CheckOk[];
}

export function trayCheck(s: RunOutState): TrayCheck {
  const runOut: CheckRow[] = [];
  const missing: CheckRow[] = [];
  const ok: CheckOk[] = [];
  for (const o of onTray(s)) {
    const g = guestOf(o.guest);
    for (const l of o.lines) {
      const at = DISHED_AT[l.item];
      if (at == null) continue;
      const row = { guest: g, item: l.item, station: stationOf(at) };
      if (l.item === RUN_OUT && (l.mark === 'unmarked' || l.mark === 'notOn')) runOut.push(row);
      else if (l.mark === 'unmarked' || l.mark === 'notOn') missing.push(row);
    }
    const on = o.lines.filter((l) => l.mark === 'on').map((l) => l.item);
    const after = o.lines.filter((l) => l.mark === 'bringAfter');
    const parts = [on.join(', ')];
    for (const a of after)
      parts.push(
        a.item === RUN_OUT
          ? `Bring after: ${RUN_OUT} · waiting for the floor lead`
          : `Bring after: ${a.item}`,
      );
    ok.push({ guest: g, sub: parts.filter((p) => p !== '').join(' · ') });
  }
  return { passes: runOut.length === 0 && missing.length === 0, runOut, missing, ok };
}

export function goBackFor(s: RunOutState): RunOutState {
  const t = s.tray;
  const first = trayCheck(s).missing[0];
  if (t == null || first == null) return s;
  const at = t.stops.indexOf(first.station.id);
  return at < 0 ? s : { ...s, tray: { ...t, at, check: false } };
}

export function takeToTable(s: RunOutState): RunOutState {
  if (s.tray == null || !trayCheck(s).passes) return s;
  return {
    ...s,
    say: `Table ${s.tray.table} is on its way.`,
    orders: s.orders.map((o) => (o.where === 'tray' ? { ...o, where: 'onItsWay' } : o)),
  };
}

export function trayGone(s: RunOutState): boolean {
  return s.tray != null && onTray(s).length === 0;
}

function withStop(t: Tray, id: StationId): Tray {
  if (t.stops.includes(id)) return t;
  const order = WALK.map((w) => w.id);
  const stops = order.filter((x) => x === id || t.stops.includes(x));
  const here = t.stops[t.at];
  return { ...t, stops, at: here == null ? t.at : stops.indexOf(here) };
}

/** The floor lead's choice for one guest, played from the board: the replacement takes the run-out item's place wherever it isn't On. */
export function leadChooses(s: RunOutState, guest: string, to: string | null): RunOutState {
  const o = orderOf(s, guest);
  if (o == null) return s;
  const g = guestOf(guest);
  if (!s.online)
    return {
      ...s,
      elsewhere: [...s.elsewhere.filter((e) => e.guest !== guest), { guest, to }],
      note: OFFLINE_LEAD,
    };
  if (!isWaiting(o)) return { ...s, note: `${g.name} isn’t waiting for a choice.` };
  if (to == null && wouldEmpty(o, RUN_OUT) && !o.follow.some((i) => i !== RUN_OUT))
    return {
      ...s,
      note: `The floor lead can’t serve ${g.name} without ${RUN_OUT}: it would leave the plate empty (plate_empty), so they stay waiting for a choice.`,
    };
  const lines = o.lines.flatMap((l): Line[] => {
    if (l.item !== RUN_OUT || l.mark === 'on') return [l];
    if (to == null) return [];
    return [
      { item: to, mark: l.mark === 'bringAfter' ? 'bringAfter' : 'unmarked', instead: RUN_OUT },
    ];
  });
  const follow = o.follow.flatMap((i) => (i !== RUN_OUT ? [i] : to == null ? [] : [to]));
  const changed: Order = { ...o, lines, follow, without: to == null ? RUN_OUT : null };
  const placed = lines.find((l) => l.instead === RUN_OUT && l.mark === 'unmarked');
  const atStation = placed == null ? null : DISHED_AT[placed.item];
  const tray =
    o.where === 'tray' && s.tray != null && atStation != null
      ? withStop(s.tray, atStation)
      : s.tray;
  const words = landedLine(g.seat, to);
  const onTheTray = o.where === 'tray';
  return {
    ...s,
    note: '',
    tray,
    orders: s.orders.map((x) => (x.guest === guest ? changed : x)),
    landed: onTheTray ? [...s.landed, words] : s.landed,
    say: onTheTray ? words : s.say,
  };
}

export interface FloorSeat {
  guest: Guest;
  plate: string;
  stage: string;
  waiting: boolean;
  now: string;
}

const STAGE: Record<Where, string> = {
  toServe: 'To serve',
  tray: 'Dishing',
  onItsWay: 'On its way',
};

export function floorSeats(s: RunOutState): readonly FloorSeat[] {
  const table = s.tray?.table ?? 9;
  return s.orders
    .filter((o) => guestOf(o.guest).table === table)
    .map((o) => ({ o, g: guestOf(o.guest) }))
    .sort((a, b) => a.g.seat - b.g.seat)
    .map(({ o, g }) => {
      const items = [...o.lines.map((l) => l.item), ...o.follow.map((i) => `${i} to follow`)];
      const swapped = o.lines.find((l) => l.instead === RUN_OUT);
      return {
        guest: g,
        plate: items.join(' · '),
        stage: STAGE[o.where],
        waiting: isWaiting(o),
        now:
          swapped != null
            ? `Now ${swapped.item}`
            : o.without === RUN_OUT
              ? `Without ${RUN_OUT}`
              : '',
      };
    });
}

export function trayTitle(s: RunOutState): string {
  if (s.tray == null) return '';
  return `Table ${s.tray.table} · ${plural(onTray(s).length, 'plate', 'plates')}`;
}

export function trayLine(s: RunOutState): string {
  const t = s.tray;
  if (t == null) return '';
  if (trayGone(s)) return 'On its way';
  if (t.check) return 'Check the tray';
  const st = currentStop(s);
  return st == null ? '' : `Stop ${t.at + 1} of ${t.stops.length} · ${st.to}, ${st.who}`;
}

export function stripLine(s: RunOutState): string {
  return s.online ? `Connected · up to date at ${NOW}` : `No connection · as of ${AS_OF}`;
}
