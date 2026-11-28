import { type Companion, type Guest, type Reply, WEDDING, sampleGuests } from './guests.ts';
import { figure } from './guestsWords.ts';
import type { DemoLink } from './settings.ts';

export interface PlanTable {
  id: string;
  name: string;
  section: string | null;
  chairs: number;
}

export interface Plan {
  tables: readonly PlanTable[];
  rows: readonly { row: string; seats: number; section: string | null }[];
}

export type SeatAt =
  { kind: 'table'; table: string; chair: number } | { kind: 'row'; row: string; seat: number };

/** Who sits where, by person id. Ids that are not on the sample's short list are the rest of the event's guests. */
export type Seats = Readonly<Record<string, SeatAt>>;

const LIST = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });
const COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function people(count: number): string {
  return count === 1 ? '1 person' : `${figure(count)} people`;
}

export const STW = {
  column: 'Table',
  noSeat: 'No seat',
  sortBy: 'Sort by',
  sortName: 'Name',
  sortTable: 'Table',
  unseated: 'Unseated',
  unseatedCount: (count: number) =>
    count === 1 ? 'Unseated, 1 person' : `Unseated, ${figure(count)} people`,
  assignTable: 'Assign table',
  title: 'Assign a table',
  going: (guests: number, companions: number) => {
    const named = guests === 1 ? '1 guest' : `${figure(guests)} guests`;
    const with_ =
      companions === 0
        ? ''
        : companions === 1
          ? ' and 1 companion with them'
          : ` and ${figure(companions)} companions with them`;

    return `${named}${with_}: ${people(guests + companions)}.`;
  },
  field: 'Table',
  placeholder: 'Type a table or section',
  options: 'Tables with a free seat',
  free: (count: number) => `${figure(count)} free`,
  optionsSaid: (count: number) =>
    count === 1 ? '1 table with a free seat' : `${figure(count)} tables with a free seat`,
  chooseTable: 'Choose a table.',
  everyFull: 'Every table is full.',
  noMatch: (typed: string) => `No table with a free seat matches “${typed.trim()}”.`,
  gone: (table: string) => `${table} is no longer on the plan. Choose another table.`,
  willMove: (names: readonly string[]) => `Will move from their seats: ${LIST.format(names)}.`,
  short: (need: number, free: number) =>
    `Not everyone fits. ${people(need)}, ${free === 1 ? '1 free seat' : `${figure(free)} free seats`}. Whole parties go in the order you selected them. Any that don’t fit keep their place.`,
  party: (name: string, size: number) => `${name}’s party (${figure(size)})`,
  seated: (count: number, table: string) => `Seated ${figure(count)} at ${table}.`,
  nobodySeated: (table: string) => `Nobody seated at ${table}.`,
  moved: (count: number, from: string, names: readonly string[]) =>
    `Moved ${figure(count)} from ${from}: ${LIST.format(names)}.`,
  noRoom: (names: readonly string[]) => `Not seated: ${LIST.format(names)}, not enough room.`,
  notComing: (names: readonly string[]) => `Not seated: ${LIST.format(names)}, not coming.`,
  filledUp: (table: string) => `${table} filled up while you were choosing.`,
  undone: (count: number) =>
    count === 1
      ? 'Undone. 1 person is back where they were.'
      : `Undone. ${figure(count)} people are back where they were.`,
  stays: (names: readonly string[], at: string, from: string) =>
    names.length === 1
      ? `${LIST.format(names)} stays at ${at}. Someone has taken the chair at ${from} since.`
      : `${LIST.format(names)} stay at ${at}. Someone has taken their chairs at ${from} since.`,
  close: 'Close',
  undo: 'Undo',
  seat: 'Seat',
  change: 'Change',
  unseat: 'Unseat',
  noSeatYet: 'No seat yet',
  chooseSeat: 'Choose a seat',
  unseatedFrom: (place: string) => `Unseated from ${place}.`,
  companionSeat: (place: string) => `Seat: ${place}`,
  companions: 'Companions',
  details: (name: string) => `${name}, details`,
  closeDetails: 'Close details',
  demo: 'Demo only: a colleague, on another screen',
  colleagueSeats: 'Seat Inês Duarte’s party at Table 4',
  colleagueRemoves: 'Take Table 4 off the plan',
  colleagueTakes: 'Take Yusuf Danjuma’s old chair',
  firstTable: 'Add the first table to the plan',
  colleagueDone: 'Done, on the plan. This list shows it at once.',
  viewOnly: 'You can see where guests sit. Seating them needs Seating: manage.',
  markTheirOwn: 'Mark as invited is sc-46880’s, in its own demo at /demo/guests/select.',
  addTheirOwn:
    'Add to group and Remove from the list are sc-3776’s, in their own demo at /demo/guests/many.',
} as const;

const MAIN = 'Main hall';

export const SAMPLE_PLAN: Plan = {
  tables: [
    { id: 't-2', name: 'Table 2', section: MAIN, chairs: 8 },
    { id: 't-4', name: 'Table 4', section: MAIN, chairs: 6 },
    { id: 't-9', name: 'Table 9', section: MAIN, chairs: 6 },
    { id: 't-10', name: 'Table 10', section: MAIN, chairs: 8 },
    { id: 't-12', name: 'Table 12', section: 'Garden terrace', chairs: 8 },
    { id: 't-14', name: 'Table 14', section: 'Garden terrace', chairs: 8 },
  ],
  rows: [{ row: 'C', seats: 8, section: 'Balcony' }],
};

const NO_PLAN: Plan = { tables: [], rows: [] };

function others(table: string, chairs: readonly number[]): Record<string, SeatAt> {
  return Object.fromEntries(
    chairs.map((chair) => [`other-${table}-${chair}`, { kind: 'table', table, chair }]),
  );
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, at) => from + at);

export const SAMPLE_SEATS: Seats = {
  tunde: { kind: 'table', table: 't-2', chair: 1 },
  'tunde-1': { kind: 'table', table: 't-2', chair: 2 },
  marta: { kind: 'table', table: 't-2', chair: 3 },
  ngozi: { kind: 'table', table: 't-9', chair: 3 },
  yusuf: { kind: 'table', table: 't-9', chair: 4 },
  amaka: { kind: 'table', table: 't-10', chair: 1 },
  kwame: { kind: 'row', row: 'C', seat: 4 },
  ...others('t-9', [1, 2]),
  ...others('t-10', range(2, 6)),
  ...others('t-12', range(1, 8)),
  ...others('t-14', range(1, 5)),
};

function allFull(plan: Plan, seats: Seats): Seats {
  const filled: Record<string, SeatAt> = { ...seats };

  for (const table of plan.tables) {
    for (const chair of freeChairs(table, filled)) {
      filled[`other-${table.id}-${chair}`] = { kind: 'table', table: table.id, chair };
    }
  }

  return filled;
}

const BASE: Guest = (() => {
  const found = sampleGuests(WEDDING).find((one) => one.id === 'kwame');

  if (found == null) throw new Error('The wedding sample has no Kwame Mensah.');

  return found;
})();

function companion(host: string, at: number, name: string | null, reply: Reply): Companion {
  return { id: `${host}-${at}`, name, reply };
}

function person(id: string, name: string, reply: Reply, with_: Companion[] = []): Guest {
  return {
    ...BASE,
    id,
    name,
    reply,
    replied: reply === 'noReply' || reply === 'notYet' ? null : '2026-10-14',
    recorded: null,
    email: null,
    phone: null,
    companions: with_,
    language: null,
    chose: null,
    greetAs: null,
    askAgain: null,
  };
}

export function seatingGuests(): Guest[] {
  return [
    person('adaeze', 'Chief Mrs Adaeze Okonkwo-Williams', 'coming', [
      companion('adaeze', 1, 'Nneka Okonkwo', 'held'),
    ]),
    person('amaka', 'Amaka Eze', 'coming'),
    person('bisi', 'Bisi Adewale', 'notYet'),
    person('camille', 'Camille Dubois', 'notComing'),
    person('emeka', 'Dr Emeka Nwosu', 'noReply', [companion('emeka', 1, 'Adanna Nwosu', 'held')]),
    person('ifeanyi', 'Ifeanyi Okafor', 'coming', [
      companion('ifeanyi', 1, 'Chioma Okafor', 'coming'),
      companion('ifeanyi', 2, 'Obinna Okafor', 'coming'),
      companion('ifeanyi', 3, 'Ada Okafor', 'coming'),
    ]),
    person('ines', 'Inês Duarte', 'coming', [companion('ines', 1, 'Rui Duarte', 'coming')]),
    person('kwame', 'Kwame Mensah', 'coming'),
    person('lucia', 'Lucía Ortega', 'notSure'),
    person('marta', 'Marta Silva', 'coming'),
    person('ngozi', 'Ngozi Eze', 'coming'),
    person('tunde', 'Tunde Bakare', 'coming', [companion('tunde', 1, 'Funmi Bakare', 'coming')]),
    person('yusuf', 'Yusuf Danjuma', 'coming'),
  ];
}

export function hasPlan(plan: Plan): boolean {
  return plan.tables.length > 0 || plan.rows.length > 0;
}

export function tableOf(plan: Plan, id: string): PlanTable | null {
  return plan.tables.find((one) => one.id === id) ?? null;
}

export function cellOf(plan: Plan, seat: SeatAt | undefined): string {
  if (seat == null) return STW.noSeat;
  if (seat.kind === 'row') return `Row ${seat.row}, seat ${figure(seat.seat)}`;

  return tableOf(plan, seat.table)?.name ?? STW.noSeat;
}

export function placeOf(plan: Plan, seat: SeatAt): string {
  if (seat.kind === 'row') return cellOf(plan, seat);
  const table = tableOf(plan, seat.table);

  if (table == null) return STW.noSeat;

  return table.section == null ? table.name : `${table.name} · ${table.section}`;
}

function takenAt(table: string, seats: Seats): Set<number> {
  return new Set(
    Object.values(seats)
      .filter((one) => one.kind === 'table' && one.table === table)
      .map((one) => (one.kind === 'table' ? one.chair : 0)),
  );
}

export function freeChairs(table: PlanTable, seats: Seats): number[] {
  const taken = takenAt(table.id, seats);

  return range(1, table.chairs).filter((chair) => !taken.has(chair));
}

export function freeAt(plan: Plan, seats: Seats, table: string): number {
  const found = tableOf(plan, table);

  return found == null ? 0 : freeChairs(found, seats).length;
}

function folded(words: string): string {
  return words
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim();
}

export function optionsOf(plan: Plan, seats: Seats, typed: string): PlanTable[] {
  const q = folded(typed);

  return plan.tables
    .filter((one) => freeAt(plan, seats, one.id) > 0)
    .filter(
      (one) => q === '' || folded(one.name).includes(q) || folded(one.section ?? '').includes(q),
    )
    .sort((a, b) => COLLATOR.compare(a.name, b.name));
}

export function anyFree(plan: Plan, seats: Seats): boolean {
  return optionsOf(plan, seats, '').length > 0;
}

interface Member {
  id: string;
  name: string;
  reply: Reply;
}

function membersOf(one: Guest): Member[] {
  return [
    { id: one.id, name: one.name, reply: one.reply },
    ...one.companions.map((each, at) => ({
      id: each.id,
      name: each.name ?? `${one.name}’s guest ${figure(at + 1)}`,
      reply: each.reply,
    })),
  ];
}

function chosenIn(list: readonly Guest[], order: readonly string[]): Guest[] {
  return order.flatMap((id) => list.filter((one) => one.id === id));
}

function named(one: Guest, size: number): string {
  return size === 1 ? one.name : STW.party(one.name, size);
}

export function goingOf(
  list: readonly Guest[],
  order: readonly string[],
): { guests: number; companions: number; need: number } {
  const chosen = chosenIn(list, order);
  const companions = chosen.reduce((sum, one) => sum + one.companions.length, 0);
  const need = chosen.reduce(
    (sum, one) => sum + membersOf(one).filter((each) => each.reply !== 'notComing').length,
    0,
  );

  return { guests: chosen.length, companions, need };
}

function from(plan: Plan, seat: SeatAt): string {
  return seat.kind === 'row' ? `Row ${seat.row}` : (tableOf(plan, seat.table)?.name ?? '');
}

export function previewOf(
  list: readonly Guest[],
  plan: Plan,
  seats: Seats,
  order: readonly string[],
  table: string,
): { moving: string[]; need: number; free: number } {
  const moving: string[] = [];
  let need = 0;

  for (const one of chosenIn(list, order)) {
    const going = membersOf(one).filter(
      (each) => each.reply !== 'notComing' && !atTable(seats[each.id], table),
    );
    const seated = going.filter((each) => seats[each.id] != null);

    need += going.length;
    if (seated.length === 0) continue;
    if (seated.length === going.length && going.length > 1) moving.push(named(one, going.length));
    else moving.push(...seated.map((each) => each.name));
  }

  return { moving, need, free: freeAt(plan, seats, table) };
}

function atTable(seat: SeatAt | undefined, table: string): boolean {
  return seat?.kind === 'table' && seat.table === table;
}

export interface Change {
  id: string;
  name: string;
  before: SeatAt | null;
  after: SeatAt;
}

export type Result =
  | {
      kind: 'assigned';
      table: string;
      seated: number;
      moved: { from: string; names: string[] }[];
      noRoom: string[];
      notComing: string[];
      filledUp: boolean;
    }
  | { kind: 'undone'; back: number; stays: { at: string; from: string; names: string[] }[] };

export type Assigned =
  | { kind: 'gone'; table: string }
  | { kind: 'done'; seats: Seats; result: Result; changes: Change[] };

export function assignTable(
  list: readonly Guest[],
  plan: Plan,
  seats: Seats,
  order: readonly string[],
  tableId: string,
  freeWhenChosen: number | null = null,
): Assigned {
  const table = tableOf(plan, tableId);
  const removedName = tableOf(SAMPLE_PLAN, tableId)?.name ?? tableId;

  if (table == null) return { kind: 'gone', table: removedName };
  const next: Record<string, SeatAt> = { ...seats };
  const changes: Change[] = [];
  const noRoom: string[] = [];
  const notComing: string[] = [];
  const freeNow = freeChairs(table, seats).length;

  for (const one of chosenIn(list, order)) {
    const members = membersOf(one);
    const going = members.filter((each) => each.reply !== 'notComing');

    if (going.length === 0) {
      notComing.push(named(one, members.length));
      continue;
    }
    const needing = going.filter((each) => !atTable(next[each.id], tableId));
    const chairs = freeChairs(table, next);

    if (needing.length > chairs.length) {
      noRoom.push(named(one, going.length));
      continue;
    }
    needing.forEach((each, at) => {
      const after: SeatAt = { kind: 'table', table: tableId, chair: chairs[at] ?? 0 };

      changes.push({ id: each.id, name: each.name, before: next[each.id] ?? null, after });
      next[each.id] = after;
    });
  }

  const moved = new Map<string, string[]>();

  for (const change of changes) {
    if (change.before == null) continue;
    const key = from(plan, change.before);

    moved.set(key, [...(moved.get(key) ?? []), change.name]);
  }

  return {
    kind: 'done',
    seats: next,
    changes,
    result: {
      kind: 'assigned',
      table: table.name,
      seated: changes.length,
      moved: [...moved].map(([at, names]) => ({ from: at, names })),
      noRoom,
      notComing,
      filledUp: freeWhenChosen != null && freeNow < freeWhenChosen && noRoom.length > 0,
    },
  };
}

function chairTaken(seats: Seats, seat: SeatAt, except: string): boolean {
  return Object.entries(seats).some(
    ([id, one]) =>
      id !== except &&
      (seat.kind === 'table'
        ? one.kind === 'table' && one.table === seat.table && one.chair === seat.chair
        : one.kind === 'row' && one.row === seat.row && one.seat === seat.seat),
  );
}

export function undoAssign(
  plan: Plan,
  seats: Seats,
  changes: readonly Change[],
): { seats: Seats; result: Result } {
  const next: Record<string, SeatAt> = { ...seats };
  const stays = new Map<string, { at: string; from: string; names: string[] }>();
  let back = 0;

  for (const change of changes) {
    if (change.before == null) {
      delete next[change.id];
      back += 1;
      continue;
    }
    if (chairTaken(next, change.before, change.id)) {
      const old = from(plan, change.before);
      const at = from(plan, change.after);
      const key = `${old}|${at}`;
      const was = stays.get(key) ?? { at, from: old, names: [] };

      stays.set(key, { ...was, names: [...was.names, change.name] });
      continue;
    }
    next[change.id] = change.before;
    back += 1;
  }

  return { seats: next, result: { kind: 'undone', back, stays: [...stays.values()] } };
}

export function resultWords(result: Result): string[] {
  if (result.kind === 'undone') {
    return [
      STW.undone(result.back),
      ...result.stays.map((one) => STW.stays(one.names, one.at, one.from)),
    ];
  }

  return [
    result.seated === 0 ? STW.nobodySeated(result.table) : STW.seated(result.seated, result.table),
    ...result.moved.map((one) => STW.moved(one.names.length, one.from, one.names)),
    ...(result.noRoom.length > 0 ? [STW.noRoom(result.noRoom)] : []),
    ...(result.notComing.length > 0 ? [STW.notComing(result.notComing)] : []),
    ...(result.filledUp ? [STW.filledUp(result.table)] : []),
  ];
}

export function resultTone(result: Result): 'done' | 'held' {
  if (result.kind === 'undone') return result.stays.length > 0 ? 'held' : 'done';

  return result.noRoom.length > 0 || result.notComing.length > 0 ? 'held' : 'done';
}

/** sc-4016's Without a seat with the other replies off: Coming guests and their companions, as people. */
export function unseatedOf(list: readonly Guest[], seats: Seats): string[] {
  return list
    .filter((one) => one.reply === 'coming')
    .flatMap((one) => [
      ...(seats[one.id] == null ? [one.id] : []),
      ...one.companions
        .filter((each) => each.reply !== 'notComing' && seats[each.id] == null)
        .map((each) => each.id),
    ]);
}

function seatKey(plan: Plan, seat: SeatAt | undefined): [number, string, number] {
  if (seat == null) return [2, '', 0];
  if (seat.kind === 'row') return [1, `Row ${seat.row}`, seat.seat];

  return [0, tableOf(plan, seat.table)?.name ?? '', seat.chair];
}

export function byTable(plan: Plan, seats: Seats) {
  return (a: Guest, b: Guest): number => {
    const [ka, na, ca] = seatKey(plan, seats[a.id]);
    const [kb, nb, cb] = seatKey(plan, seats[b.id]);

    return ka - kb || COLLATOR.compare(na, nb) || ca - cb || COLLATOR.compare(a.name, b.name);
  };
}

export function unseat(seats: Seats, ids: readonly string[]): Seats {
  const next: Record<string, SeatAt> = { ...seats };

  for (const id of ids) delete next[id];

  return next;
}

export function colleagueSeats(seats: Seats, plan: Plan): Seats {
  const table = tableOf(plan, 't-4');

  if (table == null) return seats;
  const [one, two] = freeChairs(table, unseat(seats, ['ines', 'ines-1']));

  if (one == null || two == null) return seats;

  return {
    ...seats,
    ines: { kind: 'table', table: 't-4', chair: one },
    'ines-1': { kind: 'table', table: 't-4', chair: two },
  };
}

export function colleagueRemoves(plan: Plan, seats: Seats): { plan: Plan; seats: Seats } {
  return {
    plan: { ...plan, tables: plan.tables.filter((one) => one.id !== 't-4') },
    seats: Object.fromEntries(
      Object.entries(seats).filter(([, one]) => !(one.kind === 'table' && one.table === 't-4')),
    ),
  };
}

export const YUSUF_CHAIR: SeatAt = { kind: 'table', table: 't-9', chair: 4 };

export function colleagueTakes(seats: Seats): Seats {
  return { ...seats, 'other-taken': YUSUF_CHAIR };
}

export const SEATING_STATES = [
  { key: 'list', name: 'The list: the Table column and the Unseated chip' },
  { key: 'sortedByTable', name: 'Sorted by table: Table 2 before Table 10, no seat last' },
  { key: 'unseatedFilter', name: 'The Unseated filter: 8 people, as the tray counts them' },
  { key: 'selected', name: 'Selected, a Draft event: Assign table is the primary' },
  { key: 'selectedLive', name: 'Selected, a Live event: Mark as invited first and primary' },
  { key: 'chooser', name: 'Assign a table: the list open, each with its free seats' },
  { key: 'chooserTyped', name: 'Typed “garden”: matched on the section, accents aside' },
  { key: 'chooserChosen', name: 'Table 4 chosen: who moves, and not everyone fits' },
  { key: 'chooserParty', name: 'A seated party moving whole: Tunde Bakare’s party (2)' },
  { key: 'chooserBlank', name: 'Assign table with no table chosen: Choose a table.' },
  { key: 'chooserFull', name: 'Every table is full: nothing can be sent' },
  { key: 'chooserRemoved', name: 'Table 4 taken off the plan after it was chosen (409)' },
  { key: 'resultSkipped', name: 'Seated 6: a party of 4 skipped, a smaller one after it seated' },
  { key: 'resultAll', name: 'Everyone seated: the green dot' },
  { key: 'resultRace', name: 'Table 4 filled up while you were choosing' },
  { key: 'resultNotComing', name: 'Not seated: a guest who is not coming' },
  { key: 'undone', name: 'Undone: everyone back where they were' },
  { key: 'undoneTaken', name: 'Undone, a chair taken since: Yusuf Danjuma stays' },
  { key: 'detailsTable', name: 'Details: Seat at a table, a companion’s own seat' },
  { key: 'detailsRow', name: 'Details: Seat in a row' },
  { key: 'detailsNoSeat', name: 'Details: No seat yet, Choose a seat' },
  { key: 'unseated', name: 'Details: unseated, with Undo' },
  { key: 'noTables', name: 'A plan with no table yet: the list as before' },
  { key: 'readOnly', name: 'Seating: read only: the column and chip, no actions' },
  { key: 'noSeating', name: 'Without Seating: read: the list as before' },
] as const;

export type SeatingState = (typeof SEATING_STATES)[number]['key'];

export function seatingStateOf(raw: string | null): SeatingState {
  return SEATING_STATES.find((one) => one.key === raw)?.key ?? 'list';
}

export const SEATING_AT = '/demo/guests/seating';

export const SEATING_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The guest list’s Table column, Unseated, Seat and Assign table · sc-4025 · desk and 320',
    states: SEATING_STATES.map((one) => ({
      to: `${SEATING_AT}?state=${one.key}`,
      name: one.name,
    })),
  },
];

export interface Chooser {
  typed: string;
  chosen: string | null;
  open: boolean;
  /** The table's free seats when it was chosen. */
  freeWhenChosen: number | null;
  error: 'blank' | 'full' | { gone: string } | null;
}

export interface SeatingStart {
  list: Guest[];
  plan: Plan;
  seats: Seats;
  live: boolean;
  reads: boolean;
  manages: boolean;
  sort: 'name' | 'table';
  unseatedOnly: boolean;
  selected: string[];
  chooser: Chooser | null;
  result: Result | null;
  changes: Change[] | null;
  details: string | null;
  unseated: { ids: string[]; seats: Seats; place: string } | null;
}

/** The selection the board's results come from: Ngozi and Yusuf at Table 9, then three unseated parties, the party of 4 fourth. */
export const PICKED = ['ngozi', 'yusuf', 'adaeze', 'ifeanyi', 'ines'];
const RACING = ['ngozi', 'yusuf', 'adaeze', 'ifeanyi', 'emeka'];
const EVERYONE_FITS = ['ngozi', 'yusuf', 'ines'];
const PARTY = ['tunde', 'adaeze'];
const NOT_COMING = ['ngozi', 'camille'];

const CLOSED: Chooser = {
  typed: '',
  chosen: null,
  open: false,
  freeWhenChosen: null,
  error: null,
};

function done(start: SeatingStart, order: readonly string[], seats = start.seats): SeatingStart {
  const after = assignTable(start.list, start.plan, seats, order, 't-4', 6);

  if (after.kind === 'gone') return start;

  return { ...start, seats: after.seats, result: after.result, changes: after.changes };
}

export function seatingStart(state: SeatingState): SeatingStart {
  const start: SeatingStart = {
    list: seatingGuests(),
    plan: SAMPLE_PLAN,
    seats: SAMPLE_SEATS,
    live: true,
    reads: true,
    manages: true,
    sort: 'name',
    unseatedOnly: false,
    selected: [],
    chooser: null,
    result: null,
    changes: null,
    details: null,
    unseated: null,
  };
  const picked = { ...start, selected: PICKED };
  const chosen = { ...CLOSED, typed: 'Table 4', chosen: 't-4', freeWhenChosen: 6 };

  switch (state) {
    case 'list':
      return start;
    case 'sortedByTable':
      return { ...start, sort: 'table' };
    case 'unseatedFilter':
      return { ...start, unseatedOnly: true };
    case 'selected':
      return { ...picked, live: false };
    case 'selectedLive':
      return picked;
    case 'chooser':
      return { ...picked, chooser: { ...CLOSED, open: true } };
    case 'chooserTyped':
      return { ...picked, chooser: { ...CLOSED, typed: 'garden', open: true } };
    case 'chooserChosen':
      return { ...picked, chooser: chosen };
    case 'chooserParty':
      return { ...start, selected: PARTY, chooser: chosen };
    case 'chooserBlank':
      return { ...picked, chooser: { ...CLOSED, error: 'blank' } };
    case 'chooserFull':
      return {
        ...picked,
        seats: allFull(SAMPLE_PLAN, SAMPLE_SEATS),
        chooser: { ...CLOSED, open: true },
      };
    case 'chooserRemoved': {
      const gone = colleagueRemoves(SAMPLE_PLAN, SAMPLE_SEATS);

      return {
        ...picked,
        ...gone,
        chooser: { ...CLOSED, error: { gone: 'Table 4' } },
      };
    }
    case 'resultSkipped':
      return done(start, PICKED);
    case 'resultAll':
      return done(start, EVERYONE_FITS);
    case 'resultRace':
      return done(start, RACING, colleagueSeats(SAMPLE_SEATS, SAMPLE_PLAN));
    case 'resultNotComing':
      return done(start, NOT_COMING);
    case 'undone': {
      const after = done(start, PICKED);
      const back = undoAssign(after.plan, after.seats, after.changes ?? []);

      return { ...after, seats: back.seats, result: back.result, changes: null };
    }
    case 'undoneTaken': {
      const after = done(start, PICKED);
      const back = undoAssign(after.plan, colleagueTakes(after.seats), after.changes ?? []);

      return { ...after, seats: back.seats, result: back.result, changes: null };
    }
    case 'detailsTable':
      return { ...start, details: 'tunde' };
    case 'detailsRow':
      return { ...start, details: 'kwame' };
    case 'detailsNoSeat':
      return { ...start, details: 'ifeanyi' };
    case 'unseated':
      return {
        ...start,
        seats: unseat(SAMPLE_SEATS, ['tunde']),
        details: 'tunde',
        unseated: { ids: ['tunde'], seats: SAMPLE_SEATS, place: 'Table 2 · Main hall' },
      };
    case 'noTables':
      return { ...start, plan: NO_PLAN, seats: {} };
    case 'readOnly':
      return { ...start, manages: false };
    case 'noSeating':
      return { ...start, reads: false, manages: false };
  }
}

export { NO_PLAN };
