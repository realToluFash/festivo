/** The kitchen sheet (sc-3911): allergies first, then diets, then each course as See picks counts it. */
export type KitchenCell =
  { kind: 'dish'; text: string } | { kind: 'kitchen' | 'skipped' | 'host' | 'notYet' | 'never' };

export interface KitchenAllergic {
  id: string;
  name: string;
  /** Codes in Annex II order, `other` among them. */
  allergens: string[];
  otherAllergy: string | null;
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

export interface KitchenCourse {
  id: string;
  name: string;
  rows: KitchenRow[];
  kitchen: number;
  skipped: number;
  needsHost: number;
  notChosen: number;
  /** After the close of a course with a default: those not chosen were never given it. */
  never: boolean;
  room: number;
  given: { count: number; plate: string } | null;
  sides: boolean;
}

export interface KitchenSheet {
  asOf: string;
  paper: 'a4' | 'letter';
  names: boolean;
  coming: number;
  allergicCount: number;
  /** Null without guests.manage. */
  allergic: KitchenAllergic[] | null;
  allergyCounts: KitchenCount[];
  dietCounts: KitchenCount[];
  courses: KitchenCourse[];
}

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};
const num = (raw: unknown): number => (typeof raw === 'number' ? raw : 0);
const str = (raw: unknown): string => (typeof raw === 'string' ? raw : '');
const strings = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((one): one is string => typeof one === 'string') : [];
const list = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : []);

const STATES = ['kitchen', 'skipped', 'host', 'notYet', 'never'] as const;

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
    never: one.never === true,
    room: num(one.room),
    given: given == null ? null : { count: num(given.count), plate: str(given.plate) },
    sides: one.sides === true,
  };
}

export function asKitchenSheet(raw: unknown): KitchenSheet | null {
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
            cells: list(who.cells).map(asCell),
          };
        })
      : null,
    allergyCounts: list(one.allergyCounts).map(asCount),
    dietCounts: list(one.dietCounts).map(asCount),
    courses: one.courses.map(asCourse),
  };
}
