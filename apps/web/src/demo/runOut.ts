import type { Alert, Section, Summary } from './howItsGoing.ts';
import { NOW, type RoomTable, type Seat, room } from './serviceRoom.ts';

export const ITEM = 'Chicken';
export const STATION = 'Grill';
export const MARKER = 'Tayo Bamidele';
export const MARKED_AT = '20:06';
export const MARKED = `Marked by ${MARKER} on ${STATION} at ${MARKED_AT}`;

export const COURSE_ITEMS = ['Jollof rice', 'Chicken', 'Beef', 'Grilled fish'] as const;
export const CONTAINS: Readonly<Record<string, readonly string[] | null>> = {
  'Jollof rice': [],
  Chicken: ['celery'],
  Beef: null,
  'Grilled fish': ['fish'],
};

export type FlagKind = 'allergen' | 'other' | 'diet';

export interface Flag {
  kind: FlagKind;
  code: string;
  words: string;
}

const FISH: Flag = { kind: 'allergen', code: 'fish', words: 'Fish allergy' };
const SESAME: Flag = { kind: 'allergen', code: 'sesame', words: 'Sesame allergy' };
const HALAL: Flag = { kind: 'diet', code: 'halal', words: 'Halal' };
const KIWI: Flag = { kind: 'other', code: 'other', words: 'Other allergy · kiwi' };

export interface Guest {
  id: string;
  name: string;
  table: number;
  seat: number;
  flags: Flag[];
  plate: string[];
}

export type Status = 'waiting' | 'changed' | 'back';
export type PlateStage = 'To serve' | 'Dishing';

/** Counted: where the guest was in How it's going's figures before the run out ('base' already counted as changed, 'late' not here yet). */
export interface Fate {
  status: Status;
  to: string | null;
  stage: PlateStage;
  counted: 'base' | 'waiting' | 'late';
}

export type Bulk = { kind: 'serve'; item: string } | { kind: 'without' };

export interface RunOut {
  guests: Guest[];
  fate: Record<string, Fate>;
  stands: Bulk | null;
  available: boolean;
  panel: boolean;
  openedFrom: 'choose' | 'kitchen';
  confirm: Bulk | null;
  choosing: string | null;
  race: string | null;
  refused: string;
  say: string;
}

export interface Access {
  online: boolean;
  manage: boolean;
}

const WAITING: readonly Guest[] = [
  g('fa', 'Funke Adeyemi', 9, 1, [FISH]),
  g('hs', 'Hauwa Sani', 9, 2, [HALAL]),
  g('tb', 'Tunde Bakare', 9, 4, []),
  g('ya', 'Yemi Alabi', 9, 6, []),
  g('ka', 'Kemi Adebayo', 12, 3, [SESAME]),
  g('mb', 'Musa Bello', 12, 6, [], ['Jollof rice', 'Chicken', 'Beef']),
  g('ae', 'Adaora Eze', 14, 2, [KIWI]),
  g('eo', 'Emeka Obi', 14, 5, []),
  g('bo', 'Bayo Ojo', 3, 4, [], ['Chicken']),
];

const CHANGED: readonly (readonly [Guest, PlateStage])[] = [
  [g('sm', 'Sola Martins', 3, 1, []), 'To serve'],
  [g('ne', 'Ngozi Eze', 3, 2, []), 'Dishing'],
];

export const LATE: Guest = g('bi', 'Bola Ige', 14, 7, []);

function g(
  id: string,
  name: string,
  table: number,
  seat: number,
  flags: Flag[],
  plate: string[] = ['Jollof rice', 'Chicken'],
): Guest {
  return { id, name, table, seat, flags, plate };
}

export function runOutSample(): RunOut {
  const fate: Record<string, Fate> = {};
  for (const x of WAITING)
    fate[x.id] = { status: 'waiting', to: null, stage: 'To serve', counted: 'waiting' };
  for (const [x, stage] of CHANGED)
    fate[x.id] = { status: 'changed', to: 'Beef', stage, counted: 'base' };
  return {
    guests: [...WAITING, ...CHANGED.map(([x]) => x)].map((x) => structuredClone(x)),
    fate,
    stands: null,
    available: false,
    panel: false,
    openedFrom: 'choose',
    confirm: null,
    choosing: null,
    race: null,
    refused: '',
    say: '',
  };
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function guestsWord(n: number): string {
  return plural(n, '1 guest', `${n} guests`);
}

export function waitingWord(n: number): string {
  return plural(n, '1 waiting for a choice', `${n} waiting for a choice`);
}

export function offlineLine(what: 'choose' | 'markAvailable'): string {
  const doing = what === 'choose' ? 'choose' : `mark ${ITEM} available again`;
  return `Needs a connection to ${doing}. Nothing is kept to send later.`;
}

export const NO_MANAGE_LINE =
  'Only the floor lead chooses what guests get instead. Nothing changed.';

export function dishingLine(name: string): string {
  return `${name}’s plate is already being dished, so their choice stays as it is.`;
}

export function whereLine(x: Guest): string {
  return `Table ${x.table} · seat ${x.seat}`;
}

export function flagged(x: Guest): boolean {
  return x.flags.length > 0;
}

export function panelOrder(a: Guest, b: Guest): number {
  return Number(flagged(b)) - Number(flagged(a)) || a.table - b.table || a.seat - b.seat;
}

function guestOf(ro: RunOut, id: string): Guest | undefined {
  return ro.guests.find((x) => x.id === id);
}

function fateOf(ro: RunOut, id: string): Fate {
  return ro.fate[id] ?? { status: 'back', to: null, stage: 'To serve', counted: 'base' };
}

export function waiting(ro: RunOut): Guest[] {
  if (ro.available) return [];
  return ro.guests.filter((x) => fateOf(ro, x.id).status === 'waiting').sort(panelOrder);
}

export function changed(ro: RunOut): Guest[] {
  return ro.guests.filter((x) => fateOf(ro, x.id).status === 'changed').sort(panelOrder);
}

export function alertOn(ro: RunOut): boolean {
  return waiting(ro).length > 0;
}

export function plateNow(ro: RunOut, x: Guest): string[] {
  const f = fateOf(ro, x.id);
  if (f.status !== 'changed') return [...x.plate];
  return x.plate.flatMap((i) => (i !== ITEM ? [i] : f.to == null ? [] : [f.to]));
}

export function nowLine(ro: RunOut, x: Guest): string {
  const to = fateOf(ro, x.id).to;
  return to == null ? `Without ${ITEM}` : `Now ${to}`;
}

export function canChooseAgain(ro: RunOut, x: Guest): boolean {
  return fateOf(ro, x.id).stage === 'To serve';
}

/** Who a bulk choice covers now: never a flagged guest, never one whose plate already has the substitute, never one it would leave with an empty plate. */
export function covered(ro: RunOut, bulk: Bulk): Guest[] {
  return waiting(ro).filter((x) => coversGuest(bulk, x));
}

function coversGuest(bulk: Bulk, x: Guest): boolean {
  if (flagged(x)) return false;
  if (bulk.kind === 'serve') return !x.plate.includes(bulk.item);
  return x.plate.some((i) => i !== ITEM);
}

export function bulkKey(b: Bulk): string {
  return b.kind === 'serve' ? `serve:${b.item}` : 'without';
}

export function bulkLabel(b: Bulk): string {
  return b.kind === 'serve' ? `Serve ${b.item}` : `Serve without ${ITEM}`;
}

export interface BulkRow {
  bulk: Bulk;
  key: string;
  label: string;
  stands: boolean;
}

export function bulkRows(ro: RunOut): BulkRow[] {
  const all: Bulk[] = [
    ...COURSE_ITEMS.filter((i) => i !== ITEM).map((item): Bulk => ({ kind: 'serve', item })),
    { kind: 'without' },
  ];
  return all.map((bulk) => ({
    bulk,
    key: bulkKey(bulk),
    label: bulkLabel(bulk),
    stands: ro.stands != null && bulkKey(ro.stands) === bulkKey(bulk),
  }));
}

/** The confirmation's question: a count of the guests it covers now, or for guests still to come, never 0. */
export function confirmTitle(ro: RunOut, bulk: Bulk): string {
  const n = covered(ro, bulk).length;
  if (bulk.kind === 'serve')
    return n > 0
      ? `Serve ${bulk.item} to ${guestsWord(n)} instead of ${ITEM}?`
      : `Serve ${bulk.item} instead of ${ITEM} for guests still to come?`;
  return n > 0
    ? `Serve without ${ITEM} for ${guestsWord(n)}?`
    : `Serve without ${ITEM} for guests still to come?`;
}

export interface Conflict {
  line: string;
  note: string;
}

/** An allergen the item contains, or any allergen when the item's allergens aren't stated. An Other allergy and a diet refuse nothing. */
export function conflict(x: Guest, item: string): Conflict | null {
  const allergens = x.flags.filter((f) => f.kind === 'allergen');
  const contains = CONTAINS[item] ?? null;
  const hit = allergens.find((f) => contains?.includes(f.code) === true);
  if (hit != null) return { line: `Not for ${x.name} · ${hit.words}`, note: '' };
  const first = allergens[0];
  if (first != null && contains == null)
    return {
      line: `Not for ${x.name} · ${first.words}`,
      note: `${item}’s allergens aren’t stated`,
    };
  return null;
}

export interface Option {
  to: string | null;
  label: string;
  item: string;
  no: Conflict | null;
}

export function options(ro: RunOut, x: Guest): Option[] {
  const plate = plateNow(ro, x);
  const f = fateOf(ro, x.id);
  const items = COURSE_ITEMS.filter((i) => i !== ITEM && !plate.includes(i)).map((i): Option => ({
    to: i,
    label: `Serve ${i}`,
    item: i,
    no: conflict(x, i),
  }));
  const rest = x.plate.filter((i) => i !== ITEM);
  const without = !(f.status === 'changed' && f.to == null) && rest.length > 0;
  return without
    ? [...items, { to: null, label: `Serve without ${ITEM}`, item: `Without ${ITEM}`, no: null }]
    : items;
}

function copy(ro: RunOut): RunOut {
  return structuredClone(ro);
}

function refused(ro: RunOut, line: string): RunOut {
  return { ...copy(ro), refused: line, say: line };
}

function guard(ro: RunOut, a: Access, what: 'choose' | 'markAvailable'): RunOut | null {
  if (!a.online) return refused(ro, offlineLine(what));
  if (!a.manage) return refused(ro, NO_MANAGE_LINE);
  return null;
}

export function openPanel(ro: RunOut, from: 'choose' | 'kitchen', a: Access): RunOut {
  const no = guard(ro, a, 'choose');
  if (no != null) return no;
  return { ...copy(ro), panel: true, openedFrom: from, refused: '', say: '' };
}

export function closePanel(ro: RunOut): RunOut {
  return { ...copy(ro), panel: false, confirm: null, choosing: null, refused: '' };
}

export function askBulk(ro: RunOut, bulk: Bulk, a: Access): RunOut {
  const no = guard(ro, a, 'choose');
  if (no != null) return no;
  return { ...copy(ro), confirm: bulk, refused: '' };
}

export function cancel(ro: RunOut): RunOut {
  return { ...copy(ro), confirm: null, choosing: null };
}

export function confirmBulk(ro: RunOut, a: Access): RunOut {
  const bulk = ro.confirm;
  if (bulk == null) return ro;
  const no = guard(ro, a, 'choose');
  if (no != null) return no;
  const s = copy(ro);
  for (const x of covered(ro, bulk)) {
    const f = s.fate[x.id];
    if (f != null)
      Object.assign(f, { status: 'changed', to: bulk.kind === 'serve' ? bulk.item : null });
  }
  s.stands = bulk;
  s.confirm = null;
  s.refused = '';
  s.say = `${bulkLabel(bulk)}: ${guestsWord(covered(ro, bulk).length)} changed. Applies to guests still to come.`;
  return s;
}

export function openChoose(ro: RunOut, id: string, a: Access): RunOut {
  const no = guard(ro, a, 'choose');
  if (no != null) return no;
  return { ...copy(ro), choosing: id, refused: '' };
}

/** A choice for one guest: refused from Dishing on (409 plate_stage_invalid), and the last choice made at To serve stands. */
export function chooseFor(ro: RunOut, id: string, to: string | null, a: Access): RunOut {
  const no = guard(ro, a, 'choose');
  if (no != null) return no;
  const x = guestOf(ro, id);
  const f = ro.fate[id];
  if (x == null || f == null) return ro;
  if (to != null && conflict(x, to) != null) return ro;
  const s = copy(ro);
  const mine = s.fate[id] as Fate;
  s.choosing = null;
  if (s.race === id || mine.stage !== 'To serve') {
    mine.stage = 'Dishing';
    s.race = null;
    return { ...s, refused: dishingLine(x.name), say: dishingLine(x.name) };
  }
  Object.assign(mine, { status: 'changed', to });
  s.refused = '';
  s.say = `${x.name}: ${to == null ? `without ${ITEM}` : `now ${to}`}.`;
  return s;
}

/** Mark available again: the item is Ready, every guest still waiting gets it back, guests already changed keep theirs, the standing choice ends. */
export function markAvailable(ro: RunOut, a: Access): RunOut {
  const no = guard(ro, a, 'markAvailable');
  if (no != null) return no;
  const s = copy(ro);
  for (const f of Object.values(s.fate)) if (f.status === 'waiting') f.status = 'back';
  return {
    ...s,
    available: true,
    stands: null,
    panel: false,
    confirm: null,
    choosing: null,
    refused: '',
    say: `${ITEM} is available again.`,
  };
}

export function markRunOutAgain(ro: RunOut): RunOut {
  const s = copy(ro);
  for (const f of Object.values(s.fate)) if (f.status === 'back') f.status = 'waiting';
  const n = Object.values(s.fate).filter((f) => f.status === 'waiting').length;
  return { ...s, available: false, stands: null, refused: '', say: n > 0 ? raisedLine(n) : '' };
}

export function raisedLine(n: number): string {
  return `${ITEM} has run out. ${STATION} · ${waitingWord(n)}.`;
}

/** A guest starts waiting late: a standing choice covers them at once and raises nothing; otherwise they wait and the alert is raised again. */
export function lateArrival(ro: RunOut, late: Guest = LATE): RunOut {
  if (ro.fate[late.id] != null) return ro;
  const s = copy(ro);
  s.guests.push(structuredClone(late));
  if (s.available) {
    s.fate[late.id] = { status: 'back', to: null, stage: 'To serve', counted: 'late' };
    s.say = `${late.name} arrived late.`;
    return s;
  }
  const stands = s.stands;
  if (stands != null && coversGuest(stands, late)) {
    s.fate[late.id] = {
      status: 'changed',
      to: stands.kind === 'serve' ? stands.item : null,
      stage: 'To serve',
      counted: 'late',
    };
    s.say = `${late.name} arrived late: ${nowLine(s, late).toLowerCase()}.`;
    return s;
  }
  s.fate[late.id] = { status: 'waiting', to: null, stage: 'To serve', counted: 'late' };
  s.say = raisedLine(waiting(s).length);
  return s;
}

type Bucket = 'choice' | 'kitchen' | 'serve';

const SECTION_OF: ReadonlyMap<number, string> = new Map(room().map((t) => [t.n, t.section]));

export function sectionOf(table: number): string {
  return SECTION_OF.get(table) ?? '';
}

export function runOutAlert(ro: RunOut): Alert {
  return {
    id: `runOut:${ITEM}`,
    kind: 'runOut',
    title: `${ITEM} has run out`,
    sub: `${STATION} · ${waitingWord(waiting(ro).length)}`,
    flag: '',
    button: 'Choose',
    table: '',
    waiter: '',
  };
}

export function withRunOut(s0: Summary, ro: RunOut | null): Summary {
  if (ro == null) return s0;
  const s = structuredClone(s0);
  const preparing = (item: string) => s.kitchen.find((k) => k.item === item)?.state === 'Preparing';
  const bucket = (f: Fate): Bucket => {
    if (f.status === 'waiting' && !ro.available) return 'choice';
    if (f.status === 'changed' && f.to != null && preparing(f.to)) return 'kitchen';
    return 'serve';
  };
  const left = new Map<string, number>();
  let choice = 0;
  for (const x of ro.guests) {
    const f = fateOf(ro, x.id);
    if (f.counted === 'base') continue;
    const b = bucket(f);
    const sec = s.sections.find((y) => y.id === sectionOf(x.table));
    const before = f.counted === 'waiting' ? 'serve' : 'notHere';
    if (before === 'serve') s.course.toServe -= 1;
    else {
      s.course.notHere -= 1;
      s.course.due += 1;
      if (sec != null) sec.due += 1;
    }
    if (b === 'choice') choice += 1;
    if (b === 'kitchen') {
      s.course.kitchen += 1;
      const k = s.kitchen.find((y) => y.item === f.to);
      if (k != null) k.waiting += 1;
    }
    if (b === 'serve') s.course.toServe += 1;
    if (sec != null) {
      const was = before === 'serve' ? 1 : 0;
      const now = b === 'serve' ? 1 : 0;
      sec.toServe += now - was;
      left.set(sec.id, (left.get(sec.id) ?? 0) + now - was);
    }
  }
  if (!ro.available) s.course.choice = choice;
  s.sections = s.sections.map((sec) => leftEachAfter(sec, left.get(sec.id) ?? 0));
  const chicken = s.kitchen.findIndex((k) => k.item === ITEM);
  if (!s.kitchen.some((k) => k.item === 'Beef'))
    s.kitchen.splice(chicken + 1, 0, {
      item: 'Beef',
      station: STATION,
      people: MARKER,
      state: 'Ready',
      readyIn: null,
      heldUpMin: null,
      waiting: 0,
    });
  if (alertOn(ro)) s.alerts = [runOutAlert(ro), ...s.alerts];
  return s;
}

export function leftEachAfter(sec: Section, delta: number): Section {
  if (sec.people === 0 || delta === 0) return sec;
  const total = Math.max(0, sec.leftEach * sec.people + delta);
  return { ...sec, leftEach: Math.ceil(total / sec.people) };
}

export function kitchenLine(): string {
  return `${ITEM} · ${STATION} · Run out`;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Plan and List: each run-out guest in their seat, and a table with anyone waiting for a choice says so. A wait for a choice adds nothing toward Behind, so a table's wait counts from the mark at most. */
export function runOutTables(tables: readonly RoomTable[], ro: RunOut): RoomTable[] {
  return tables.map((t) => {
    const here = ro.guests.filter((x) => x.table === t.n);
    if (here.length === 0) return t;
    const fired = t.has.notFired === true;
    const seats: Seat[] = t.seats.map((seat) => {
      const x = here.find((y) => y.seat === seat.n);
      const base =
        fired && seat.state === 'Not fired yet' ? { ...seat, state: 'To serve' as const } : seat;
      if (x == null) return base;
      const f = fateOf(ro, x.id);
      return {
        ...base,
        name: x.name,
        flags: x.flags.map((fl) => fl.words),
        dish: plateNow(ro, x).join(' · '),
        state: f.status === 'waiting' && !ro.available ? 'Waiting for a choice' : f.stage,
      };
    });
    const choice = here.some((x) => fateOf(ro, x.id).status === 'waiting') && !ro.available;
    const sinceMarked = minutes(NOW) - minutes(MARKED_AT);
    return {
      ...t,
      has: fired ? { serve: true, choice } : { ...t.has, choice },
      wait: Math.min(t.wait ?? sinceMarked, sinceMarked),
      seats,
    };
  });
}
