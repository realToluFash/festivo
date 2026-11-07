import {
  type Point,
  type Room,
  type View,
  feetInches,
  filled,
  free,
  metres,
  usable,
} from './SeatingGeometry.ts';
import {
  COLOURS,
  type ColourName,
  type Item,
  type Kind,
  type Party,
  type Person,
  type Section,
} from './SeatingSample.ts';
import { W, say } from './SeatingWords.ts';

/** Every ?state= of seating-a-spec §6, by the names both demos use; the app opens the plan in use for a state it does not have. */
export const SEATING_STATES = [
  'plan',
  'noPlan',
  'startBlank',
  'startRange',
  'newPlan',
  'loading',
  'failed',
  'readOnly',
  'offline',
  'zoomOut',
  'corner',
  'roomSettings',
  'shrinkRefused',
  'deletePlan',
  'roomChanged',
  'usCustomary',
  'sectionAdd',
  'sectionTaken',
  'sectionBlank',
  'sectionLimit',
  'sectionEdit',
  'sectionDelete',
  'sparse',
  'addMenu',
  'placing',
  'placed',
  'rect',
  'head',
  'cocktail',
  'shapeChanged',
  'squeeze',
  'nameTaken',
  'belowSeated',
  'chair',
  'unusable',
  'unusableRefused',
  'duplicated',
  'deleteTable',
  'deleteEmpty',
  'tableChanged',
  'rowAdded',
  'rowTurned',
  'rowLabelTaken',
  'rowBelowSeated',
  'deleteRow',
  'seatAdded',
  'seatNameTaken',
  'drag',
  'resize',
  'turn',
  'several',
  'overlap',
  'wall',
  'acrossRefused',
  'keysUp',
  'saving',
  'retrying',
  'notSaved',
  'stepRefused',
  'tabOrder',
  'arrows',
  'duplicateKey',
  'screenReader',
  'presenceOne',
  'presenceChose',
  'presenceBoth',
  'presenceSix',
  'presenceViewer',
  'reconnecting',
  'left',
  'arriving',
  'tapChooses',
  'seat',
  'picked',
  'seated',
  'apart',
  'full',
  'short',
  'swap',
  'race',
  'undoRefused',
  'tableGuests',
  'moveAll',
  'emptyTable',
  'everyoneSeated',
  'noMatch',
  'notSureYet',
  'tables',
  'tablesPicked',
  'list',
  'listOpen',
  'print',
  'printPreparing',
  'printDone',
  'printFailed',
  'printReadOnly',
  'printOffline',
  'refresh',
  'guestSeat',
  'guestNoSeat',
] as const;

export type SeatingState = (typeof SEATING_STATES)[number];

export function seatingStateOf(value: string | undefined): SeatingState | null {
  return SEATING_STATES.find((state) => state === value) ?? null;
}

export type Layout = 'phone' | 'portrait' | 'landscape';
export type ViewName = 'Floor plan' | 'Tables' | 'List';
export type Tab = 'Arrange' | 'Seat';
export type ListTab = 'With space' | 'Full' | 'All';
export type SaveLine = 'saved' | 'saving' | 'retry' | 'failed';
export type Load = 'ready' | 'loading' | 'failed' | 'noPlan' | 'start';
export type ArrangeShows = 'room' | 'roomSettings' | 'sectionAdd' | 'sectionEdit' | 'sectionLimit';
export type Doc = 'Table lists' | 'Table cards' | 'Floor plan';
export const DOCS: readonly Doc[] = ['Table lists', 'Table cards', 'Floor plan'];

export interface Bar {
  kind: 'tint' | 'amber' | 'white';
  words: string;
  undo?: boolean;
  cancel?: boolean;
  placing?: boolean;
  glyph?: 'tick' | 'offline';
}

export type Ask =
  | { kind: 'deletePlan' }
  | { kind: 'deleteSection'; key: string }
  | { kind: 'deleteItem'; id: string }
  | { kind: 'swap'; id: string; chair: number };

export type Pop =
  | { kind: 'short'; id: string }
  | { kind: 'swap'; id: string; chair: number }
  | { kind: 'moveAll'; id: string }
  | { kind: 'addMenu' }
  | { kind: 'people' }
  | { kind: 'select'; field: 'Section' | 'Shape' | 'Rotation' };

export type Sheet =
  | { kind: 'table'; id: string }
  | { kind: 'move'; id: string; chair: number }
  | { kind: 'short'; id: string }
  | { kind: 'print' };

export interface Fields {
  drafts: Record<string, string>;
  errors: Record<string, string>;
  warn: string | null;
  note: string | null;
  added: string | null;
  changedBy: string | null;
  focus: string | null;
}

export interface Snapshot {
  items: Item[];
  tray: Party[];
}

export interface Seating {
  layout: Layout;
  load: Load;
  day: boolean;
  readOnly: boolean;
  offline: boolean;
  units: 'metric' | 'us';
  room: Room;
  items: Item[];
  sections: Section[];
  tray: Party[];
  view: ViewName;
  tab: Tab;
  arrange: ArrangeShows;
  sectionKey: string | null;
  chosen: string | null;
  chair: number | null;
  picked: string | null;
  lit: string[];
  bar: Bar | null;
  undo: Snapshot | null;
  undoRefuses: boolean;
  save: SaveLine;
  people: Person[];
  presence: 'chips' | 'reconnecting';
  rings: Record<string, Person>;
  ask: Ask | null;
  pop: Pop | null;
  sheet: Sheet | null;
  fields: Fields;
  start: { name: string; width: string; length: string; errors: Record<string, string> };
  roomDraft: { name: string; width: string; length: string; error: string | null };
  outside: string[];
  wallAt: number | null;
  sectionForm: { name: string; colour: ColourName; error: string | null };
  zoom: { s: number; centre: Point } | null;
  shown: View | null;
  size: { w: number; h: number } | null;
  ghost: Item | null;
  tip: { words: string; at: Point } | null;
  placing: Kind | null;
  placeAnother: boolean;
  snap: boolean;
  listTab: ListTab;
  listOpen: string | null;
  tableFilter: string | null;
  trayOpen: boolean;
  search: string;
  group: string | null;
  showNotYet: boolean;
  paper: 'A4' | 'Letter';
  preparing: Doc | null;
  printFailed: Doc | null;
  refreshing: boolean;
  spoken: string | null;
  guest: 'seat' | 'noSeat' | null;
  held: boolean;
}

export const NO_FIELDS: Fields = {
  drafts: {},
  errors: {},
  warn: null,
  note: null,
  added: null,
  changedBy: null,
  focus: null,
};

export function hexOf(colour: ColourName): string {
  return COLOURS.find(([name]) => name === colour)?.[1] ?? '#8B8B9A';
}

export function sectionOf(m: Seating, key: string | null): Section | null {
  return m.sections.find((section) => section.key === key) ?? null;
}

export function sectionName(m: Seating, it: Item): string {
  return sectionOf(m, it.sec)?.name ?? W.noSection;
}

export function itemOf(m: Seating, id: string | null): Item | null {
  return m.items.find((it) => it.id === id) ?? null;
}

export function partyOf(m: Seating, id: string | null): Party | null {
  return m.tray.find((p) => p.id === id) ?? null;
}

export const isTable = (it: Item): boolean => it.kind !== 'row' && it.kind !== 'single';
export const partySize = (p: Party): number => 1 + p.plus;
export const partyWho = (p: Party): string => (p.guestOf == null ? p.lead : say.guestOf(p.guestOf));

const SHAPE: Record<Kind, string> = {
  round: 'Round table',
  rect: 'Rectangular table',
  head: 'Head table',
  cocktail: 'Cocktail table',
  row: 'Row',
  single: 'Single seat',
};

export function shapeWord(it: Item): string {
  return it.kind === 'row' ? `Row of ${it.chairs.length} seats` : SHAPE[it.kind];
}

export const SHAPE_CHOICES = ['Round', 'Rectangular', 'Head', 'Cocktail'] as const;
export const SHAPE_KIND: Record<(typeof SHAPE_CHOICES)[number], Kind> = {
  Round: 'round',
  Rectangular: 'rect',
  Head: 'head',
  Cocktail: 'cocktail',
};

export function shapeChoice(it: Item): string {
  return SHAPE[it.kind].replace(' table', '');
}

export function ofWords(it: Item): string {
  return say.of(filled(it), usable(it));
}

export function titleLine(m: Seating, it: Item): string {
  return say.titleLine(shapeWord(it), sectionName(m, it), ofWords(it));
}

/** sc-4007's name for an item: "Table 4, round, 8 of 10 seats taken, Stage side". */
export function accName(m: Seating, it: Item): string {
  const kind = {
    round: 'round',
    rect: 'rectangular',
    head: 'head table',
    cocktail: 'cocktail',
    row: `row of ${it.chairs.length}`,
    single: 'single seat',
  }[it.kind];
  const ring = m.rings[it.id];
  const by = ring != null && !ring.viewer ? say.chosenBy(ring.name) : '';
  return say.accName(it.name, kind, filled(it), usable(it), sectionOf(m, it.sec)?.name ?? null, by);
}

export function length(m: Seating, cm: number): string {
  return m.units === 'us' ? feetInches(cm) : metres(cm);
}

export function roomLine(m: Seating): string {
  return say.roomLine(m.room.name, `${length(m, m.room.w)} × ${length(m, m.room.l)}`);
}

export const seatedCount = (items: readonly Item[]): number =>
  items.reduce((n, it) => n + it.chairs.filter((c) => c.state === 'taken').length, 0);
export const freeCount = (items: readonly Item[]): number =>
  items.reduce((n, it) => n + free(it), 0);
export const tableCount = (items: readonly Item[]): number => items.filter(isTable).length;
export const trayCount = (tray: readonly Party[]): number =>
  tray.reduce((n, p) => n + partySize(p), 0);

export function summaryLine(m: Seating, coming: number): string {
  return say.summary(tableCount(m.items), seatedCount(m.items), coming, freeCount(m.items));
}

export const withSpace = (items: readonly Item[]): Item[] => items.filter((it) => free(it) > 0);
export const fullOnes = (items: readonly Item[]): Item[] => items.filter((it) => free(it) <= 0);

export function listed(items: readonly Item[], tab: ListTab): Item[] {
  if (tab === 'With space') return withSpace(items);
  return tab === 'Full' ? fullOnes(items) : [...items];
}

/** Each section's row: its colour's name, its tables and its seats (sc-3998). */
export function sectionRowLine(m: Seating, key: string): string {
  const its = m.items.filter((it) => it.sec === key);
  const colour = sectionOf(m, key)?.colour ?? 'Blue';
  return say.sectionLine(
    colour,
    its.filter(isTable).length,
    its.reduce((n, it) => n + it.chairs.length, 0),
  );
}

export function noSectionLine(m: Seating): string {
  const its = m.items.filter((it) => sectionOf(m, it.sec) == null);
  const count = (n: number, one: string, many: string) =>
    n === 0 ? [] : [`${n} ${n === 1 ? one : many}`];
  return [
    ...count(its.filter(isTable).length, 'table', 'tables'),
    ...count(its.filter((it) => it.kind === 'row').length, 'row', 'rows'),
    ...count(its.filter((it) => it.kind === 'single').length, 'single seat', 'single seats'),
    ...count(
      its.reduce((n, it) => n + it.chairs.length, 0),
      'seat',
      'seats',
    ),
  ].join(' · ');
}

/** The least-used colour, the first in order on a tie (sc-3998). */
export function leastUsed(sections: readonly Section[]): ColourName {
  const uses = (name: ColourName) => sections.filter((s) => s.colour === name).length;
  return COLOURS.reduce<ColourName>(
    (best, [name]) => (uses(name) < uses(best) ? name : best),
    COLOURS[0][0],
  );
}

/** Case and accents ignored, as sc-3998 compares names. */
export function sameName(a: string, b: string): boolean {
  const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase();
  return plain(a) === plain(b);
}

/** "13 tables, 1 row and 84 seated guests", for Delete the plan. */
export function whatGoes(m: Seating): string {
  const tables = tableCount(m.items);
  const rows = m.items.filter((it) => it.kind === 'row').length;
  const parts = [
    `${tables} ${tables === 1 ? 'table' : 'tables'}`,
    ...(rows > 0 ? [`${rows} ${rows === 1 ? 'row' : 'rows'}`] : []),
  ];
  return `${parts.join(', ')} and ${seatedCount(m.items)} seated guests`;
}

export function trayShown(m: Seating): Party[] {
  const q = m.search.trim();
  return m.tray.filter(
    (p) =>
      (m.group == null || p.group === m.group) &&
      (q === '' || partyWho(p).toLocaleLowerCase().includes(q.toLocaleLowerCase())),
  );
}

export function groupCounts(m: Seating): { group: string; n: number }[] {
  const groups = [...new Set(m.tray.map((p) => p.group).filter((g) => g !== ''))];
  return groups.map((group) => ({
    group,
    n: m.tray.filter((p) => p.group === group).reduce((n, p) => n + partySize(p), 0),
  }));
}

export function namesLine(it: Item, shown = 3): string | null {
  const names = it.chairs.flatMap((c) => (c.state === 'taken' && c.who != null ? [c.who] : []));
  if (names.length === 0) return null;
  const extra = filled(it) - shown;
  const first = names.slice(0, shown).join(', ');
  return extra > 0 ? say.more(first, extra) : first;
}

/** The List's Seated column: the first two names, "Nobody yet" when nobody is, and nothing when the sample names nobody. */
export function seatedWords(it: Item): string {
  return namesLine(it, 2) ?? (filled(it) === 0 ? W.nobodyYet : '');
}

export function chairWord(it: Item, index: number): string {
  const chair = it.chairs[index];
  if (chair == null) return W.empty;
  if (chair.state === 'taken') return chair.who ?? W.taken;
  return { held: W.held, empty: W.empty, unusable: W.unusable }[chair.state];
}

export function nextTableName(items: readonly Item[]): string {
  const numbers = items
    .map((it) => /^Table (\d+)$/u.exec(it.name)?.[1])
    .map(Number)
    .filter(Boolean);
  return `Table ${Math.max(0, ...numbers) + 1}`;
}

export function nextRowLabel(items: readonly Item[]): string {
  const used = new Set(items.filter((it) => it.kind === 'row').map((it) => it.label));
  return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((letter) => !used.has(letter)) ?? 'Z';
}

export function nextSeatName(items: readonly Item[]): string {
  const used = new Set(items.map((it) => it.name));
  let n = 1;
  while (used.has(`Seat ${n}`)) n += 1;
  return `Seat ${n}`;
}

export function editable(m: Seating): boolean {
  return !m.readOnly && !m.offline && m.load === 'ready';
}
