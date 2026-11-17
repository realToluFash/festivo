/** Kitchen station (sc-4015, KitchenStation.dc.html and PickStation.dc.html on page 35): the trays that need a station, the tray as the disher faces it, and each item Ready or Preparing. */

export type StationId = 'pass' | 'jollof' | 'fried' | 'grill' | 'fryer';
export type CourseName = 'Starter' | 'Mains';
export type Mark = 'on' | 'off';
export type Eta = 5 | 10 | 15 | null;
export type Stage = 'To serve' | 'Dishing' | 'Checked' | 'On its way' | 'Served';

export interface Station {
  id: StationId;
  name: string;
}

export interface Item {
  name: string;
  course: CourseName;
  at: StationId | null;
}

export interface Plate {
  seat: string;
  dish: string;
  variant?: string;
  flags: readonly string[];
  owed?: boolean;
  stage: Stage;
  marks: Readonly<Record<string, { v: Mark; at: number }>>;
  /** A run-out item's replacement, chosen by the floor lead: another item, or '' for without. */
  swap?: Readonly<Record<string, string>>;
}

export interface Tray {
  id: string;
  label: string;
  waiter: string;
  startedAt: number;
  paused: boolean;
  taken: boolean;
  plates: readonly Plate[];
}

export type ItemState =
  | { kind: 'ready' }
  | { kind: 'preparing'; since: number; eta: Eta; etaFrom: number }
  | { kind: 'runOut'; at: number; by: string };

export type Roster = Readonly<Record<StationId, readonly string[]>>;

export interface Undo {
  item: string;
  before: ItemState;
  at: number;
}

export interface Refusal {
  item: string;
  by: string;
}

export interface StationState {
  station: StationId | null;
  you: string;
  now: number;
  asOf: number;
  online: boolean;
  fired: CourseName | null;
  trays: readonly Tray[];
  waiting: readonly Plate[];
  items: Readonly<Record<string, ItemState>>;
  held: Readonly<Record<string, number>>;
  undo: Readonly<Record<string, Undo>>;
  kept: readonly { item: string; to: ItemState }[];
  notSent: readonly Refusal[];
  rival: { item: string; by: string; to: ItemState } | null;
  choosing: string | null;
  picking: boolean;
  moved: string;
  say: string;
  access: 'pass' | 'floor' | 'none';
  roster: Roster;
  confirming: string | null;
  notice: { item: string; line: string } | null;
  runOutRival: { item: string; by: string; at: number } | null;
}

export const EVENT = 'Adaeze & Tunde’s wedding';
export const UNDO_MINUTES = 2;
export const HELD_UP_NO_TIME = 15;
export const ETAS: readonly Eta[] = [5, 10, 15, null];

export const STATIONS: readonly Station[] = [
  { id: 'pass', name: 'Pass' },
  { id: 'jollof', name: 'Rice · Jollof' },
  { id: 'fried', name: 'Rice · Fried' },
  { id: 'grill', name: 'Grill' },
  { id: 'fryer', name: 'Fryer' },
];

export const ROSTER: Roster = {
  pass: ['Ronke Alade'],
  jollof: ['Bisi Okon'],
  fried: [],
  grill: ['Tayo Bamidele'],
  fryer: ['Gbenga Salami', 'Kemi Adebayo'],
};

export const COURSES: readonly CourseName[] = ['Starter', 'Mains'];

export const ITEMS: readonly Item[] = [
  { name: 'Small chops', course: 'Starter', at: 'fryer' },
  { name: 'Jollof rice', course: 'Mains', at: 'jollof' },
  { name: 'Chicken', course: 'Mains', at: 'grill' },
  { name: 'Moin moin', course: 'Mains', at: null },
  { name: 'Fried rice', course: 'Mains', at: 'fried' },
  { name: 'Grilled fish', course: 'Mains', at: 'grill' },
  { name: 'Plantain', course: 'Mains', at: 'fryer' },
  { name: 'Chef’s choice', course: 'Mains', at: null },
];

export const DISHES: Readonly<Record<string, readonly string[]>> = {
  'Small chops': ['Small chops'],
  'Jollof rice with chicken': ['Jollof rice', 'Chicken', 'Moin moin', 'Plantain'],
  'Fried rice with grilled fish': ['Fried rice', 'Grilled fish', 'Plantain'],
  'Chef’s choice': ['Chef’s choice'],
  'Mixed grill': ['Chicken', 'Grilled fish'],
};

export function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const at = (h: number, m: number): number => h * 60 + m;

export function nameOf(id: StationId): string {
  return STATIONS.find((s) => s.id === id)?.name ?? id;
}

export function itemOf(name: string): Item | undefined {
  return ITEMS.find((i) => i.name === name);
}

export function dishedAt(item: Item): StationId {
  return item.at ?? 'pass';
}

export function itemsOf(plate: Plate): readonly Item[] {
  return (DISHES[plate.dish] ?? []).flatMap((n) => {
    const it = itemOf(plate.swap?.[n] ?? n);
    return it == null ? [] : [it];
  });
}

export function courseOf(plate: Plate): CourseName {
  return itemsOf(plate)[0]?.course ?? 'Mains';
}

export function needsFrom(plate: Plate, st: StationId): readonly Item[] {
  return itemsOf(plate).filter((i) => dishedAt(i) === st);
}

export function route(tray: Tray): readonly StationId[] {
  return STATIONS.map((s) => s.id).filter(
    (id) => id === 'pass' || tray.plates.some((p) => needsFrom(p, id).length > 0),
  );
}

function markedAt(plate: Plate, st: StationId): boolean {
  return needsFrom(plate, st).every((i) => plate.marks[i.name] != null);
}

function marksAt(tray: Tray, st: StationId): readonly number[] {
  return tray.plates.flatMap((p) =>
    needsFrom(p, st).flatMap((i) => {
      const m = p.marks[i.name];
      return m == null ? [] : [m.at];
    }),
  );
}

/** When the tray became here, or null: every stop before this one marked, or a mark made here; at the Pass, as it starts. */
export function hereSince(tray: Tray, st: StationId): number | null {
  if (st === 'pass') return tray.startedAt;
  const stops = route(tray);
  const i = stops.indexOf(st);
  if (i < 0) return null;
  const here = marksAt(tray, st);
  const firstHere = here.length > 0 ? Math.min(...here) : null;
  const before = stops.slice(0, i);
  const allBefore = before.every((b) => tray.plates.every((p) => markedAt(p, b)));
  const doneBefore = allBefore
    ? Math.max(tray.startedAt, ...before.flatMap((b) => marksAt(tray, b)))
    : null;
  if (firstHere == null) return doneBefore;
  if (doneBefore == null) return firstHere;
  return Math.min(firstHere, doneBefore);
}

export function hereLine(tray: Tray, st: StationId): string {
  const since = hereSince(tray, st);
  const plates = `${tray.waiter} · ${plural(tray.plates.length, 'plate', 'plates')}`;
  return since == null ? plates : `${plates} · here since ${hm(since)}`;
}

function stillHere(tray: Tray, st: StationId): boolean {
  return !tray.taken && tray.plates.some((p) => needsFrom(p, st).length > 0 && !markedAt(p, st));
}

export function hereTrays(s: StationState): readonly Tray[] {
  const st = s.station;
  if (st == null) return [];
  return s.trays
    .filter((t) => hereSince(t, st) != null && stillHere(t, st))
    .slice()
    .sort((a, b) => (hereSince(a, st) ?? 0) - (hereSince(b, st) ?? 0));
}

export function headingTrays(s: StationState): readonly Tray[] {
  const st = s.station;
  if (st == null) return [];
  return s.trays
    .filter((t) => hereSince(t, st) == null && stillHere(t, st))
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function flaggedCount(tray: Tray): number {
  return tray.plates.filter((p) => p.flags.length > 0).length;
}

export function trayCounts(tray: Tray, st: StationId): readonly { item: string; n: number }[] {
  return ITEMS.filter((i) => dishedAt(i) === st)
    .map((i) => ({
      item: i.name,
      n: tray.plates.filter((p) => needsFrom(p, st).some((x) => x.name === i.name)).length,
    }))
    .filter((c) => c.n > 0);
}

export interface FacedPlate {
  seat: string;
  items: readonly string[];
  variant: string;
  course: string;
  flags: readonly string[];
  marked: Readonly<Record<string, Mark>>;
  preparing: readonly string[];
  runOut: readonly string[];
  pos: number;
  owed: boolean;
}

/** The tray as the disher faces it: the reverse of the tray's order (owed plates first, then seats), flagged plates kept in place. */
export function faced(s: StationState, tray: Tray): readonly FacedPlate[] {
  const st = s.station ?? 'pass';
  const latest = s.fired;
  return tray.plates
    .slice()
    .reverse()
    .map((p, i) => {
      const its = needsFrom(p, st);
      const marked: Record<string, Mark> = {};
      for (const x of its) {
        const m = p.marks[x.name];
        if (m != null) marked[x.name] = m.v;
      }
      const course = courseOf(p);
      return {
        seat: p.seat,
        items: its.map((x) => x.name),
        variant: p.variant ?? '',
        course: latest != null && course !== latest ? course : '',
        flags: p.flags,
        marked,
        preparing: its.filter((x) => s.items[x.name]?.kind === 'preparing').map((x) => x.name),
        runOut: its.filter((x) => s.items[x.name]?.kind === 'runOut').map((x) => x.name),
        pos: i + 1,
        owed: p.owed === true,
      };
    });
}

function allPlates(s: StationState): readonly Plate[] {
  return [...s.trays.filter((t) => !t.taken).flatMap((t) => t.plates), ...s.waiting];
}

export interface LeftLine {
  item: string;
  label: string;
  n: number;
}

/** A plate To serve, Dishing or owed that needs the item and hasn't had it marked On. */
function stillNeeds(p: Plate, name: string): boolean {
  return (
    (p.stage === 'To serve' || p.stage === 'Dishing' || p.owed === true) &&
    itemsOf(p).some((x) => x.name === name) &&
    p.marks[name]?.v !== 'on'
  );
}

/** Its "{n} to dish"; while the item is run out, the guests waiting for a choice on it. */
export function stillNeed(s: StationState, name: string): number {
  return allPlates(s).filter((p) => stillNeeds(p, name)).length;
}

export function leftToDish(s: StationState): readonly LeftLine[] {
  const st = s.station;
  const fired = s.fired;
  if (st == null || fired == null) return [];
  const latest = COURSES.indexOf(fired);
  const count = (name: string) => stillNeed(s, name);
  const now = ITEMS.filter((i) => dishedAt(i) === st && i.course === fired).map((i) => ({
    item: i.name,
    label: i.name,
    n: count(i.name),
  }));
  const earlier = ITEMS.filter(
    (i) => dishedAt(i) === st && COURSES.indexOf(i.course) < latest && count(i.name) > 0,
  ).map((i) => ({ item: i.name, label: `${i.course} · ${i.name}`, n: count(i.name) }));
  return [...now, ...earlier];
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface StateLine {
  word: 'Ready' | 'Preparing' | 'Held up' | 'Run out';
  line: string;
  waiting: string;
}

/** sc-34107's rule: Preparing and holding a guest, past the disher's time, or 15 minutes after with none; counted from when it was marked Preparing. */
export function heldUp(s: StationState, item: string): number | null {
  const st = s.items[item];
  if (st == null || st.kind !== 'preparing' || (s.held[item] ?? 0) < 1) return null;
  const due = st.eta == null ? st.since + HELD_UP_NO_TIME : st.etaFrom + st.eta;
  return s.now >= due ? s.now - st.since : null;
}

export function stateLine(s: StationState, item: string): StateLine {
  const st = s.items[item] ?? { kind: 'ready' };
  const held = s.held[item] ?? 0;
  const waiting = st.kind === 'preparing' && held > 0 ? `${held} waiting` : '';
  if (st.kind === 'ready') return { word: 'Ready', line: 'Ready', waiting: '' };
  if (st.kind === 'runOut') {
    return { word: 'Run out', line: runOutLine(st.at), waiting: waitingLine(stillNeed(s, item)) };
  }
  const late = heldUp(s, item);
  if (late != null) return { word: 'Held up', line: `${late} min`, waiting };
  return {
    word: 'Preparing',
    line: st.eta == null ? '' : `ready in about ${st.eta} min`,
    waiting,
  };
}

export function canUndo(s: StationState, item: string): boolean {
  const u = s.undo[item];
  return u != null && s.now - u.at < UNDO_MINUTES;
}

function setItem(s: StationState, item: string, to: ItemState): StationState {
  if (isRunOut(s, item)) return s;
  const before = s.items[item] ?? { kind: 'ready' };
  const undo = { ...s.undo, [item]: { item, before, at: s.now } };
  if (!s.online) {
    return {
      ...s,
      items: { ...s.items, [item]: to },
      undo,
      kept: [...s.kept.filter((k) => k.item !== item), { item, to }],
      choosing: null,
    };
  }
  if (s.rival != null && s.rival.item === item) {
    return {
      ...s,
      items: { ...s.items, [item]: s.rival.to },
      notSent: [...s.notSent, { item, by: s.rival.by }],
      rival: null,
      choosing: null,
    };
  }
  return { ...s, items: { ...s.items, [item]: to }, undo, choosing: null };
}

export function markReady(s: StationState, item: string): StationState {
  return setItem(s, item, { kind: 'ready' });
}

export function markPreparing(s: StationState, item: string, eta: Eta): StationState {
  const was = s.items[item];
  const since = was?.kind === 'preparing' ? was.since : s.now;
  return setItem(s, item, { kind: 'preparing', since, eta, etaFrom: s.now });
}

export function choose(s: StationState, item: string | null): StationState {
  if (item != null && isRunOut(s, item)) return s;
  return { ...s, choosing: item };
}

export function undo(s: StationState, item: string): StationState {
  const u = s.undo[item];
  if (u == null || !canUndo(s, item)) return s;
  const rest = { ...s.undo };
  delete rest[item];
  return {
    ...s,
    items: { ...s.items, [item]: u.before },
    undo: rest,
    kept: s.online ? s.kept : s.kept.filter((k) => k.item !== item),
  };
}

export function isKept(s: StationState, item: string): boolean {
  return s.kept.some((k) => k.item === item);
}

/** Back online: kept taps go in order; one another disher beat is dropped with its Not sent line, and the station holds what the server holds. */
export function goOnline(s: StationState, online: boolean): StationState {
  if (!online) return { ...s, online: false };
  let next: StationState = { ...s, online: true, asOf: s.now, kept: [] };
  for (const k of s.kept) {
    if (s.rival != null && s.rival.item === k.item) {
      next = {
        ...next,
        items: { ...next.items, [k.item]: s.rival.to },
        notSent: [...next.notSent, { item: k.item, by: s.rival.by }],
        rival: null,
      };
    }
  }
  return next;
}

export function notSentLine(s: StationState, r: Refusal): string {
  const st = s.items[r.item] ?? { kind: 'ready' };
  const now = st.kind === 'ready' ? 'ready' : st.kind === 'runOut' ? 'run out' : 'preparing';
  return `${r.item} is ${now} now, by ${r.by}.`;
}

export function dismissNotSent(s: StationState): StationState {
  return { ...s, notSent: [] };
}

export function wait(s: StationState, minutes: number): StationState {
  return { ...s, now: s.now + minutes, asOf: s.online ? s.now + minutes : s.asOf };
}

export function strip(s: StationState): string {
  if (s.online) return `Connected · up to date ${hm(s.asOf)}`;
  const n = s.kept.length;
  return `No connection · as of ${hm(s.asOf)}${n > 0 ? ` · ${plural(n, 'tap', 'taps')} waiting` : ''}`;
}

export function waiterMarks(s: StationState, v: Mark): StationState {
  const st = s.station;
  const tray = hereTrays(s)[0];
  if (st == null || tray == null) return s;
  const order = tray.plates.slice().reverse();
  const plate = order.find((p) => needsFrom(p, st).some((i) => p.marks[i.name] == null));
  if (plate == null) return s;
  const marks = { ...plate.marks };
  for (const i of needsFrom(plate, st)) if (marks[i.name] == null) marks[i.name] = { v, at: s.now };
  return replacePlate(s, tray.id, plate, { ...plate, marks });
}

function replacePlate(s: StationState, trayId: string, from: Plate, to: Plate): StationState {
  return {
    ...s,
    trays: s.trays.map((t) =>
      t.id !== trayId ? t : { ...t, plates: t.plates.map((p) => (p === from ? to : p)) },
    ),
  };
}

export function walkHere(s: StationState): StationState {
  const st = s.station;
  const tray = headingTrays(s).find((t) => !t.paused);
  if (st == null || tray == null) return s;
  const stops = route(tray);
  const before = stops.slice(0, stops.indexOf(st));
  const plates = tray.plates.map((p) => {
    const marks = { ...p.marks };
    for (const b of before)
      for (const i of needsFrom(p, b))
        if (marks[i.name] == null) marks[i.name] = { v: 'on', at: s.now };
    return { ...p, marks };
  });
  const next = { ...s, trays: s.trays.map((t) => (t.id === tray.id ? { ...t, plates } : t)) };
  return { ...next, say: arrivalLine(tray) };
}

export function arrivalLine(tray: Tray): string {
  return `${tray.label}’s tray is here · ${plural(tray.plates.length, 'plate', 'plates')}`;
}

export function takeToTable(s: StationState): StationState {
  const tray = hereTrays(s)[0];
  if (tray == null) return s;
  return { ...s, trays: s.trays.map((t) => (t.id === tray.id ? { ...t, taken: true } : t)) };
}

export function giveTray(s: StationState, label: string, to: string): StationState {
  return { ...s, trays: s.trays.map((t) => (t.label === label ? { ...t, waiter: to } : t)) };
}

export function pauseTray(s: StationState, label: string, paused: boolean): StationState {
  return { ...s, trays: s.trays.map((t) => (t.label === label ? { ...t, paused } : t)) };
}

export function openPick(s: StationState, open: boolean): StationState {
  return { ...s, picking: open, choosing: null };
}

/** Opens that station on this device; nobody's station changes (Team does that, sc-36034). */
export function pick(s: StationState, id: StationId): StationState {
  return { ...s, station: id, picking: false, choosing: null, moved: pickedLine(id), say: '' };
}

export function pickedLine(id: StationId): string {
  return `${nameOf(id)} is open on this tablet. Nobody’s station changed.`;
}

export function undoLine(was: 'Ready' | 'Preparing', when: number): string {
  return `Marked ${was} at ${hm(when)} · for ${plural(UNDO_MINUTES, 'minute', 'minutes')}`;
}

export function movedTo(s: StationState, id: StationId): StationState {
  return { ...pick(s, id), moved: `You’re on ${nameOf(id)} now.` };
}

export function stationOf(name: string): StationId | null {
  const hit = STATIONS.find((st) => ROSTER[st.id].includes(name));
  return hit == null ? null : hit.id;
}

export function whoLine(id: StationId, roster: Roster = ROSTER): string {
  const on = roster[id];
  if (on.length === 0) return `Nobody on ${nameOf(id)}`;
  if (on.length === 1) return on[0] ?? '';
  return `${on.slice(0, -1).join(', ')} and ${on[on.length - 1]}`;
}

export const RUN_OUT = {
  item: 'Chicken',
  by: 'Tayo Bamidele',
  at: at(20, 6),
  other: 'Segun Afolabi',
  substitute: 'Grilled fish',
  served: 3,
} as const;

export const CONFIRM_LEAD = 'The floor lead chooses what they get instead.';

export function isRunOut(s: StationState, item: string): boolean {
  return s.items[item]?.kind === 'runOut';
}

function dishedHere(s: StationState, item: string): boolean {
  const it = itemOf(item);
  return s.station != null && it != null && dishedAt(it) === s.station;
}

export interface Offers {
  ready: boolean;
  preparing: boolean;
  runOut: boolean;
  available: boolean;
}

/** What an item's line offers: Run out… only on this station's own items, and while run out only Mark available again. */
export function offers(s: StationState, item: string): Offers {
  const mine = dishedHere(s, item);
  const out = isRunOut(s, item);
  return {
    ready: mine && !out,
    preparing: mine && !out,
    runOut: mine && !out,
    available: mine && out,
  };
}

export function runOutQuestion(item: string): string {
  return `Run out of ${item} for the rest of the event?`;
}

export function stillNeedLine(n: number): string {
  return n === 1 ? '1 guest still needs it.' : `${n} guests still need it.`;
}

export function waitingLine(n: number): string {
  return n === 1 ? '1 waiting for a choice' : `${n} waiting for a choice`;
}

export function runOutLine(when: number): string {
  return `Run out · ${hm(when)}`;
}

export function takenLine(item: string, by: string, when: number): string {
  return `${item} was already marked run out by ${by} at ${hm(when)}. Nothing changed.`;
}

export function offlineLine(what: string): string {
  return `Needs a connection to ${what}. Nothing is kept to send later.`;
}

/** Run out… opens the confirmation; offline it is refused on the device and nothing is kept. */
export function askRunOut(s: StationState, item: string): StationState {
  if (!offers(s, item).runOut) return s;
  if (!s.online) {
    return {
      ...s,
      confirming: null,
      choosing: null,
      notice: { item, line: offlineLine(`mark ${item} run out`) },
    };
  }
  return { ...s, confirming: item, choosing: null, notice: null };
}

export function cancelRunOut(s: StationState): StationState {
  return { ...s, confirming: null };
}

/** The confirmation's Run out: stored with its time and who marked it; a second marking is the API's 409, naming who and when, and changes nothing. */
export function confirmRunOut(s: StationState): StationState {
  const item = s.confirming;
  if (item == null) return s;
  if (!s.online) {
    return {
      ...s,
      confirming: null,
      notice: { item, line: offlineLine(`mark ${item} run out`) },
    };
  }
  const held = s.items[item];
  const first =
    held?.kind === 'runOut'
      ? { by: held.by, at: held.at }
      : s.runOutRival?.item === item
        ? { by: s.runOutRival.by, at: s.runOutRival.at }
        : null;
  const undo = { ...s.undo };
  delete undo[item];
  const done = { ...s, confirming: null, choosing: null, undo, runOutRival: null };
  if (first != null) {
    return {
      ...done,
      items: { ...s.items, [item]: { kind: 'runOut', ...first } },
      notice: { item, line: takenLine(item, first.by, first.at) },
    };
  }
  return {
    ...done,
    items: { ...s.items, [item]: { kind: 'runOut', at: s.now, by: s.you } },
    notice: null,
  };
}

/** Ready again, with no confirmation and no undo; offline it is refused and nothing is kept. Guests already changed keep their replacement. */
export function markAvailable(s: StationState, item: string): StationState {
  if (!offers(s, item).available) return s;
  if (!s.online) {
    return { ...s, notice: { item, line: offlineLine(`mark ${item} available again`) } };
  }
  return { ...s, items: { ...s.items, [item]: { kind: 'ready' } }, notice: null };
}

export function dismissNotice(s: StationState): StationState {
  return { ...s, notice: null };
}

export function otherDisher(s: StationState): string {
  const st = s.station ?? 'pass';
  return s.roster[st].find((n) => n !== s.you) ?? RUN_OUT.other;
}

export function armRunOutRival(s: StationState, item: string): StationState {
  return {
    ...s,
    runOutRival: s.runOutRival == null ? { item, by: otherDisher(s), at: s.now } : null,
  };
}

export function leadServes(s: StationState, from: string, to: string, n: number): StationState {
  if (!isRunOut(s, from)) return s;
  let left = n;
  const serve = (p: Plate): Plate => {
    if (left < 1 || p.flags.length > 0 || !stillNeeds(p, from)) return p;
    if (itemsOf(p).some((x) => x.name === to)) return p;
    left -= 1;
    return { ...p, swap: { ...p.swap, [from]: to } };
  };
  return {
    ...s,
    trays: s.trays.map((t) => (t.taken ? t : { ...t, plates: t.plates.map(serve) })),
    waiting: s.waiting.map(serve),
  };
}

export const EMPTY = {
  noCourse: 'No course has been fired yet. Trays show here once the first course is.',
  noHeading: 'No tray is heading here.',
  noItem: (st: StationId) => `Nothing on a fired course is dished at ${nameOf(st)}.`,
  noTray: 'No tray here yet. A tray shows here as it arrives.',
};

export const REFUSED = {
  floor: {
    title: 'Kitchen stations open with Can work the pass',
    line: 'You can work the floor at this event: your tables and the room.',
  },
  none: {
    title: 'The service isn’t open to you',
    line: 'Your access to this event doesn’t include working the service.',
  },
};

function plate(
  seat: string,
  dish: string,
  marks: Record<string, { v: Mark; at: number }> = {},
  more: Partial<Plate> = {},
): Plate {
  return { seat, dish, flags: [], stage: 'Dishing', marks, ...more };
}

const on = (t: number) => ({ v: 'on' as const, at: t });
const off = (t: number) => ({ v: 'off' as const, at: t });

export function fresh(): StationState {
  const trays: Tray[] = [
    {
      id: 't4',
      label: 'Table 4',
      waiter: 'Kunle Ajayi',
      startedAt: at(19, 31),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 6', 'Small chops', {}, { owed: true }),
        plate(
          'Seat 1',
          'Jollof rice with chicken',
          { 'Jollof rice': on(at(19, 33)), Chicken: on(at(19, 35)), 'Moin moin': on(at(19, 31)) },
          { variant: 'Child’s portion' },
        ),
        plate(
          'Seat 3',
          'Fried rice with grilled fish',
          { 'Fried rice': on(at(19, 34)), 'Grilled fish': on(at(19, 36)) },
          { flags: ['Peanut allergy', 'Halal', 'Other · no onions'] },
        ),
      ],
    },
    {
      id: 't7',
      label: 'Table 7',
      waiter: 'Funmi Bakare',
      startedAt: at(19, 33),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 1', 'Fried rice with grilled fish', {
          'Fried rice': on(at(19, 35)),
          Plantain: on(at(19, 40)),
        }),
        plate('Seat 2', 'Fried rice with grilled fish', {
          'Fried rice': on(at(19, 35)),
          Plantain: off(at(19, 40)),
        }),
        plate('Seat 4', 'Jollof rice with chicken', { 'Moin moin': on(at(19, 33)) }),
      ],
    },
    {
      id: 't9',
      label: 'Table 9',
      waiter: 'Chidi Okafor',
      startedAt: at(19, 35),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 2', 'Jollof rice with chicken', { 'Moin moin': on(at(19, 35)) }),
        plate('Seat 3', 'Jollof rice with chicken', { 'Moin moin': on(at(19, 35)) }),
        plate('Seat 5', 'Fried rice with grilled fish'),
      ],
    },
    {
      id: 'rb',
      label: 'Row B',
      waiter: 'Grace Udo',
      startedAt: at(19, 37),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 1', 'Jollof rice with chicken', {}, { flags: ['Gluten'] }),
        plate('Seat 2', 'Fried rice with grilled fish', {}, { flags: ['Vegetarian'] }),
        plate('Seat 3', 'Jollof rice with chicken', { 'Moin moin': on(at(19, 37)) }),
      ],
    },
    {
      id: 't12',
      label: 'Table 12',
      waiter: 'Yinka Hassan',
      startedAt: at(19, 38),
      paused: true,
      taken: false,
      plates: [
        plate('Seat 1', 'Fried rice with grilled fish'),
        plate('Seat 4', 'Fried rice with grilled fish'),
      ],
    },
    {
      id: 't2',
      label: 'Table 2',
      waiter: 'Emeka Obi',
      startedAt: at(19, 40),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 1', 'Jollof rice with chicken'),
        plate('Seat 2', 'Chef’s choice'),
        plate('Seat 3', 'Jollof rice with chicken'),
      ],
    },
  ];
  const waiting: Plate[] = [
    ...['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6'].map((seat) =>
      plate(seat, 'Jollof rice with chicken', {}, { stage: 'To serve' }),
    ),
    ...['Seat 7', 'Seat 8', 'Seat 9', 'Seat 10'].map((seat) =>
      plate(seat, 'Fried rice with grilled fish', {}, { stage: 'To serve' }),
    ),
    plate('Seat 11', 'Chef’s choice', {}, { stage: 'To serve' }),
    plate('Seat 12', 'Fried rice with grilled fish', {}, { stage: 'Served' }),
  ];
  return {
    station: 'fryer',
    you: 'Gbenga Salami',
    now: at(19, 42),
    asOf: at(19, 42),
    online: true,
    fired: 'Mains',
    trays,
    waiting,
    items: {},
    held: { Plantain: 4, 'Small chops': 1 },
    undo: {},
    kept: [],
    notSent: [],
    rival: null,
    choosing: null,
    picking: false,
    moved: '',
    say: '',
    access: 'pass',
    roster: ROSTER,
    confirming: null,
    notice: null,
    runOutRival: null,
  };
}

export function runOutWorld(): StationState {
  const before = (t: number) => ({ 'Moin moin': on(t - 2), 'Jollof rice': on(t) });
  const chicken = 'Jollof rice with chicken';
  const fish = 'Fried rice with grilled fish';
  const trays: Tray[] = [
    {
      id: 'r9',
      label: 'Table 9',
      waiter: 'Chidi Okafor',
      startedAt: at(20, 1),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 1', chicken, before(at(20, 3)), { flags: ['Fish allergy'] }),
        plate('Seat 2', chicken, before(at(20, 3)), { flags: ['Halal'] }),
        plate('Seat 3', chicken, { ...before(at(20, 3)), Chicken: on(at(20, 5)) }),
        plate('Seat 4', chicken, before(at(20, 3))),
        plate('Seat 6', chicken, before(at(20, 3))),
      ],
    },
    {
      id: 'r12',
      label: 'Table 12',
      waiter: 'Yinka Hassan',
      startedAt: at(20, 4),
      paused: false,
      taken: false,
      plates: [
        plate('Seat 1', fish),
        plate('Seat 3', chicken, { 'Moin moin': on(at(20, 4)) }, { flags: ['Sesame allergy'] }),
        plate('Seat 6', chicken, { 'Moin moin': on(at(20, 4)) }),
      ],
    },
  ];
  const toServe = { stage: 'To serve' as const };
  const waiting: Plate[] = [
    plate('Seat 2', chicken, {}, { ...toServe, flags: ['Other allergy · kiwi'] }),
    plate('Seat 5', chicken, {}, toServe),
    plate('Seat 1', chicken, {}, toServe),
    plate('Seat 2', chicken, {}, toServe),
    plate('Seat 4', chicken, {}, toServe),
    plate('Seat 7', fish, {}, toServe),
    plate('Seat 8', fish, {}, toServe),
    plate('Seat 9', fish, {}, toServe),
  ];
  return {
    ...fresh(),
    station: 'grill',
    you: RUN_OUT.by,
    now: RUN_OUT.at,
    asOf: RUN_OUT.at,
    trays,
    waiting,
    held: {},
    roster: { ...ROSTER, grill: [RUN_OUT.by, RUN_OUT.other] },
  };
}

export const STATION_STATES = [
  'here',
  'twoHere',
  'preparing',
  'choosing',
  'noTime',
  'heldUp',
  'undo',
  'marks',
  'pass',
  'noCourse',
  'nothingHeading',
  'noItem',
  'offline',
  'waitingToSend',
  'notSent',
  'moved',
  'given',
  'refusedFloor',
  'refusedNone',
  'pick',
  'noStation',
  'runOutLines',
  'runOutConfirm',
  'runOut',
  'runOutTaken',
  'runOutFaced',
  'runOutOffline',
] as const;

export type StationStateName = (typeof STATION_STATES)[number];

export const STATION_STATE_WHAT: Record<StationStateName, readonly [string, string]> = {
  here: [
    'A tray here',
    'Table 4 as faced: Seat 3 flagged in place, a child’s portion, Starter last',
  ],
  twoHere: ['Two trays here', 'Table 4 arrived first, so it is on top of Table 7'],
  preparing: ['Plantain preparing', 'Preparing · ready in about 10 min · 4 waiting, on each plate'],
  choosing: ['The Preparing chooser', 'Ready in about 5, 10 or 15 min, or no time'],
  noTime: ['Preparing with no time', 'Preparing, and 4 waiting'],
  heldUp: ['Held up', 'Small chops past 15 minutes with no time: Held up · 22 min'],
  undo: ['Undo after a mark', 'Undo for 2 minutes, then gone'],
  marks: ['The waiter’s marks', 'On and Not on on Table 7’s plates, as Funmi marks them'],
  pass: ['The Pass as a station', 'Moin moin and Chef’s choice; every tray here as it starts'],
  noCourse: ['No course fired', 'Each part says so in words'],
  nothingHeading: ['No tray heading here', 'Heading here says so in words'],
  noItem: [
    'Nothing of this station fired',
    'Only the Starter fired: nothing on it is dished at the Grill',
  ],
  offline: ['No connection', 'sc-4028’s strip: No connection · as of 19:40'],
  waitingToSend: ['A mark waiting to send', 'Plantain Preparing kept offline, 1 tap waiting'],
  notSent: ['Not sent', 'Plantain is preparing now, by Kemi Adebayo.'],
  moved: ['Moved by Team', 'You’re on Grill now.'],
  given: ['A tray given', 'Table 9’s tray given to Funmi Bakare'],
  refusedFloor: ['Refused · Can work the floor', 'sc-4002’s 403: no station drawn'],
  refusedNone: ['Refused · without service.work', 'Nothing here is drawn'],
  pick: ['Pick a station', 'From the header: every kitchen station in walking order'],
  noStation: ['On no station', 'Lands on the list of stations'],
  runOutLines: [
    'Run out… on the Grill’s items',
    'Chicken and Grilled fish each offer Run out… beside Ready and Preparing',
  ],
  runOutConfirm: [
    'Run out, asked first',
    'Run out of Chicken for the rest of the event? With the guests who still need it',
  ],
  runOut: [
    'Chicken run out',
    'Run out · 20:06 and the guests waiting for a choice, with Mark available again',
  ],
  runOutTaken: [
    'Run out twice',
    'Segun Afolabi’s Run out refused: Tayo Bamidele marked it at 20:06',
  ],
  runOutFaced: [
    'Run out as you face it',
    'Table 9: Run out on each plate still needing Chicken, beside the waiter’s marks',
  ],
  runOutOffline: [
    'Run out… with no connection',
    'Refused on the device, and nothing kept to send later',
  ],
};

export function stationStateOf(raw: string | undefined): StationStateName {
  return STATION_STATES.find((x) => x === raw) ?? 'here';
}

export function seed(name: StationStateName): StationState {
  const s = fresh();
  switch (name) {
    case 'here':
      return { ...s, trays: s.trays.filter((t) => t.id !== 't7') };
    case 'twoHere':
      return s;
    case 'preparing':
      return markPreparing({ ...s, undo: {} }, 'Plantain', 10);
    case 'choosing':
      return choose(s, 'Plantain');
    case 'noTime':
      return { ...markPreparing(s, 'Plantain', null), undo: {} };
    case 'heldUp':
      return {
        ...s,
        items: {
          'Small chops': { kind: 'preparing', since: at(19, 20), eta: null, etaFrom: at(19, 20) },
        },
      };
    case 'undo':
      return markPreparing(s, 'Plantain', 5);
    case 'marks':
      return waiterMarks(s, 'on');
    case 'pass':
      return { ...s, station: 'pass', you: 'Ronke Alade' };
    case 'noCourse':
      return { ...s, fired: null, trays: [], held: {} };
    case 'nothingHeading':
      return { ...s, trays: s.trays.filter((t) => t.id === 't4' || t.id === 't7') };
    case 'noItem':
      return {
        ...s,
        station: 'grill',
        you: 'Tayo Bamidele',
        fired: 'Starter',
        trays: [],
        waiting: [plate('Seat 1', 'Small chops', {}, { stage: 'To serve' })],
      };
    case 'offline':
      return { ...s, online: false, asOf: at(19, 40) };
    case 'waitingToSend':
      return markPreparing({ ...s, online: false, asOf: at(19, 40) }, 'Plantain', 10);
    case 'notSent':
      return goOnline(
        {
          ...markPreparing({ ...s, online: false, asOf: at(19, 40) }, 'Plantain', 10),
          rival: {
            item: 'Plantain',
            by: 'Kemi Adebayo',
            to: { kind: 'preparing', since: at(19, 41), eta: 15, etaFrom: at(19, 41) },
          },
        },
        true,
      );
    case 'moved':
      return { ...movedTo(s, 'grill'), you: 'Gbenga Salami' };
    case 'given':
      return giveTray(s, 'Table 9', 'Funmi Bakare');
    case 'refusedFloor':
      return { ...s, access: 'floor' };
    case 'refusedNone':
      return { ...s, access: 'none' };
    case 'pick':
      return openPick(s, true);
    case 'noStation':
      return { ...s, station: null, you: 'Ada Nnaji' };
    case 'runOutLines':
      return runOutWorld();
    case 'runOutConfirm':
      return askRunOut(runOutWorld(), RUN_OUT.item);
    case 'runOut':
      return confirmRunOut(askRunOut(runOutWorld(), RUN_OUT.item));
    case 'runOutTaken': {
      const w = { ...runOutWorld(), you: RUN_OUT.other };
      const rival = { item: RUN_OUT.item, by: RUN_OUT.by, at: RUN_OUT.at };
      return confirmRunOut(askRunOut({ ...w, runOutRival: rival }, RUN_OUT.item));
    }
    case 'runOutFaced':
      return waiterMarks(confirmRunOut(askRunOut(runOutWorld(), RUN_OUT.item)), 'off');
    case 'runOutOffline':
      return askRunOut({ ...runOutWorld(), online: false, asOf: at(20, 5) }, RUN_OUT.item);
  }
}
