/** The kitchen sheet (sc-3911): allergies first, then diets, then each course as See picks counts it. */
export type KitchenCell =
  | { kind: 'dish'; text: string }
  | { kind: 'kitchen' | 'skipped' | 'host' | 'changed' | 'notYet' | 'never' };

export interface KitchenAllergic {
  id: string;
  name: string;
  /** Codes in Annex II order, `other` among them. */
  allergens: string[];
  otherAllergy: string | null;
  /** Diet codes, `other` among them; read only when `allergens` is empty: someone listed because a diet alone kept them from the default. */
  diets: string[];
  otherDiet: string | null;
  /** One per course, in the sheet's course order. */
  cells: KitchenCell[];
}

export interface KitchenCount {
  code: string;
  count: number;
}

export interface KitchenRow {
  id: string;
  kind: 'dish' | 'variant' | 'side';
  name: string;
  count: number;
}

export interface KitchenStationLine {
  /** The item, as the event names it; empty on Chef's choice. */
  name: string;
  count: number;
  /** Chef's choice, the Pass's last line. */
  chefs: boolean;
}

/** sc-34244: one station's lines on a course, the Pass first, then the walking order. */
export interface KitchenStation {
  id: string;
  name: string;
  lines: KitchenStationLine[];
}

export interface KitchenCourse {
  id: string;
  name: string;
  rows: KitchenRow[];
  kitchen: number;
  skipped: number;
  needsHost: number;
  notChosen: number;
  /** Asked again by a menu change (sc-3913). */
  menuChanged: number;
  /** After the close of a course with a default: those not chosen were never given it. */
  never: boolean;
  room: number;
  given: { count: number; plate: string } | null;
  sides: boolean;
  /** By station; null on a course that uses neither items nor stations. */
  stations: KitchenStation[] | null;
}

/** A kitchen sheet given to the kitchen (sc-30812): when, in the event's zone, and the full name of who gave it. */
export interface KitchenCopy {
  id: string;
  recordedAt: string;
  by: string;
}

const CHANGE_KINDS = [
  'allergyNew',
  'allergyGone',
  'dietNew',
  'dietGone',
  'comingMore',
  'comingFewer',
  'added',
  'removed',
  'renamed',
  'count',
] as const;

export type KitchenChangeKind = (typeof CHANGE_KINDS)[number];

/** A dish, variant or side, `parent` its dish's name on the last two; or with `state`, one of a course's other figures. */
export interface KitchenChangeItem {
  name: string;
  parent: string | null;
  state: 'kitchen' | 'skipped' | 'needsHost' | 'menuChanged' | 'notYet' | 'never' | null;
}

/** One change since a copy (sc-30692). An allergy or diet line has a `code`, and `who` only under the names rule; otherwise `count` guests. `old` to `count` on a figure. */
export interface KitchenChange {
  kind: KitchenChangeKind;
  code: string | null;
  who: string | null;
  item: KitchenChangeItem | null;
  /** The new name on `renamed`. */
  to: string | null;
  old: number;
  count: number;
}

/** The sheet against the latest copy: when that copy was recorded, in the event's zone, and each change in the sheet's order. */
export interface KitchenChangesSince {
  since: string;
  lines: KitchenChange[];
}

/** Final numbers due (sc-30812), a day or null; `picksOpenUntil` the last course's close while the day ends before it; the copies newest first; `changes` null before a first copy. */
export interface FinalNumbers {
  due: string | null;
  picksOpenUntil: string | null;
  copies: KitchenCopy[];
  changes: KitchenChangesSince | null;
}

export interface KitchenSheet {
  asOf: string;
  paper: 'a4' | 'letter';
  names: boolean;
  coming: number;
  allergicCount: number;
  /** By name: everyone with an allergen, and after the close everyone never given a default. Null without guests.manage. */
  allergic: KitchenAllergic[] | null;
  allergyCounts: KitchenCount[];
  dietCounts: KitchenCount[];
  courses: KitchenCourse[];
  finalNumbers: FinalNumbers;
}

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};
const num = (raw: unknown): number => (typeof raw === 'number' ? raw : 0);
const str = (raw: unknown): string => (typeof raw === 'string' ? raw : '');
const strings = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((one): one is string => typeof one === 'string') : [];
const list = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : []);

const STATES = ['kitchen', 'skipped', 'host', 'changed', 'notYet', 'never'] as const;

function asCell(raw: unknown): KitchenCell {
  const one = record(raw);
  if (one.kind === 'dish') return { kind: 'dish', text: str(one.text) };
  const state = STATES.find((kind) => kind === one.kind);

  return { kind: state ?? 'notYet' };
}

const asCount = (raw: unknown): KitchenCount => ({
  code: str(record(raw).code),
  count: num(record(raw).count),
});

function asStation(raw: unknown): KitchenStation {
  const one = record(raw);

  return {
    id: str(one.id),
    name: str(one.name),
    lines: list(one.lines).map((line) => {
      const it = record(line);

      return { name: str(it.name), count: num(it.count), chefs: it.chefs === true };
    }),
  };
}

function asCourse(raw: unknown): KitchenCourse {
  const one = record(raw);
  const given = one.given == null ? null : record(one.given);

  return {
    id: str(one.id),
    name: str(one.name),
    rows: list(one.rows).map((row) => {
      const line = record(row);

      return {
        id: str(line.id),
        kind: line.kind === 'variant' || line.kind === 'side' ? line.kind : 'dish',
        name: str(line.name),
        count: num(line.count),
      };
    }),
    kitchen: num(one.kitchen),
    skipped: num(one.skipped),
    needsHost: num(one.needsHost),
    notChosen: num(one.notChosen),
    menuChanged: num(one.menuChanged),
    never: one.never === true,
    room: num(one.room),
    given: given == null ? null : { count: num(given.count), plate: str(given.plate) },
    sides: one.sides === true,
    stations: Array.isArray(one.stations) ? one.stations.map(asStation) : null,
  };
}

const ITEM_STATES = ['kitchen', 'skipped', 'needsHost', 'menuChanged', 'notYet', 'never'] as const;

const text = (raw: unknown): string | null => (typeof raw === 'string' ? raw : null);

function asChange(raw: unknown): KitchenChange[] {
  const one = record(raw);
  const kind = CHANGE_KINDS.find((known) => known === one.kind);
  if (kind == null) return [];
  const item = one.item == null ? null : record(one.item);

  return [
    {
      kind,
      code: text(one.code),
      who: text(one.who),
      item:
        item == null
          ? null
          : {
              name: str(item.name),
              parent: text(item.parent),
              state: ITEM_STATES.find((state) => state === item.state) ?? null,
            },
      to: text(one.to),
      old: num(one.old),
      count: num(one.count),
    },
  ];
}

export function asFinalNumbers(raw: unknown): FinalNumbers {
  const one = record(raw);

  return {
    due: typeof one.due === 'string' ? one.due : null,
    picksOpenUntil: typeof one.picksOpenUntil === 'string' ? one.picksOpenUntil : null,
    copies: list(one.copies).map((copy) => {
      const given = record(copy);

      return { id: str(given.id), recordedAt: str(given.recordedAt), by: str(given.by) };
    }),
    changes:
      one.changes == null
        ? null
        : {
            since: str(record(one.changes).since),
            lines: list(record(one.changes).lines).flatMap(asChange),
          },
  };
}

export function asKitchenSheet(raw: unknown, final: unknown = null): KitchenSheet | null {
  const one = record(raw);
  if (typeof one.coming !== 'number' || !Array.isArray(one.courses)) return null;

  return {
    asOf: str(one.asOf),
    paper: one.paper === 'letter' ? 'letter' : 'a4',
    names: one.names === true,
    coming: one.coming,
    allergicCount: num(one.allergicCount),
    allergic: Array.isArray(one.allergic)
      ? one.allergic.map((person) => {
          const who = record(person);

          return {
            id: str(who.id),
            name: str(who.name),
            allergens: strings(who.allergens),
            otherAllergy: typeof who.otherAllergy === 'string' ? who.otherAllergy : null,
            diets: strings(who.diets),
            otherDiet: typeof who.otherDiet === 'string' ? who.otherDiet : null,
            cells: list(who.cells).map(asCell),
          };
        })
      : null,
    allergyCounts: list(one.allergyCounts).map(asCount),
    dietCounts: list(one.dietCounts).map(asCount),
    courses: one.courses.map(asCourse),
    finalNumbers: asFinalNumbers(final),
  };
}
