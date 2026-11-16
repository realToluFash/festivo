import {
  type Seating,
  type SeatingPlan,
  type SeatingRestoredItem,
  type SeatingWithChosen,
  type TableShape,
} from '@soirely/api-client';
import { type FloorBox, floorBox, insideRoom, readFeetAndInches } from '@soirely/domain';
import { type TFunction } from 'i18next';

import { type FloorItem, type Placement, floorItems, footprintOf } from './seatingItems.ts';

export type Edge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
export type Axis = 'across' | 'down';

export const EDGES: readonly Edge[] = ['left', 'centre', 'right', 'top', 'middle', 'bottom'];
export const COLUMNS_MAX = 20;
export const START_MAX = 999;
const GAP_MAX_CM = 1000;
const GAP_MAX_FT = 32;
const CM_PER_INCH = 2.54;

export function boxOf(item: FloorItem): FloorBox {
  return floorBox(footprintOf(item));
}

export function rectOf(from: [number, number], to: [number, number]): FloorBox {
  return {
    x0: Math.min(from[0], to[0]),
    y0: Math.min(from[1], to[1]),
    x1: Math.max(from[0], to[0]),
    y1: Math.max(from[1], to[1]),
  };
}

export function touchedBy(items: readonly FloorItem[], box: FloorBox): string[] {
  return items
    .filter((item) => {
      const b = boxOf(item);

      return b.x0 <= box.x1 && b.x1 >= box.x0 && b.y0 <= box.y1 && b.y1 >= box.y0;
    })
    .map((item) => item.one.id);
}

/** As the API's FloorGeometry::inReadingOrder, for Tab, the grid and Renumber: a line holds the items whose centres sit within half the first one's depth of it, so tables a few centimetres out of line don't number in a zigzag. */
export function inReadingOrder(items: readonly FloorItem[]): FloorItem[] {
  const left = [...items].sort((a, b) => a.one.yCm - b.one.yCm || a.one.xCm - b.one.xCm);
  const out: FloorItem[] = [];

  while (left.length > 0) {
    const first = left[0]!;
    const b = boxOf(first);
    const reach = (b.y1 - b.y0) / 2;
    const line = left.filter((item) => Math.abs(item.one.yCm - first.one.yCm) <= reach);

    out.push(...line.sort((a, c) => a.one.xCm - c.one.xCm));
    for (const item of line) left.splice(left.indexOf(item), 1);
  }
  return out;
}

export function groupBox(items: readonly FloorItem[]): FloorBox {
  const all = items.map(boxOf);

  return {
    x0: Math.min(...all.map((one) => one.x0)),
    y0: Math.min(...all.map((one) => one.y0)),
    x1: Math.max(...all.map((one) => one.x1)),
    y1: Math.max(...all.map((one) => one.y1)),
  };
}

function by(item: FloorItem, dx: number, dy: number): Placement {
  return {
    kind: item.kind,
    id: item.one.id,
    version: item.one.version,
    xCm: Math.round(item.one.xCm + dx),
    yCm: Math.round(item.one.yCm + dy),
  };
}

export function aligned(items: readonly FloorItem[], edge: Edge): Placement[] {
  const group = groupBox(items);

  return items.map((item) => {
    const b = boxOf(item);

    switch (edge) {
      case 'left':
        return by(item, group.x0 - b.x0, 0);
      case 'right':
        return by(item, group.x1 - b.x1, 0);
      case 'centre':
        return by(item, (group.x0 + group.x1) / 2 - (b.x0 + b.x1) / 2, 0);
      case 'top':
        return by(item, 0, group.y0 - b.y0);
      case 'bottom':
        return by(item, 0, group.y1 - b.y1);
      default:
        return by(item, 0, (group.y0 + group.y1) / 2 - (b.y0 + b.y1) / 2);
    }
  });
}

/** The outer two stay; the rest share the gap they leave. */
export function spaced(items: readonly FloorItem[], axis: Axis): Placement[] {
  const lo = (item: FloorItem) => (axis === 'across' ? boxOf(item).x0 : boxOf(item).y0);
  const hi = (item: FloorItem) => (axis === 'across' ? boxOf(item).x1 : boxOf(item).y1);
  const order = [...items].sort((a, b) => lo(a) + hi(a) - (lo(b) + hi(b)));
  const first = order[0]!;
  const last = order[order.length - 1]!;
  const sizes = order.reduce((sum, item) => sum + hi(item) - lo(item), 0);
  const gap = (hi(last) - lo(first) - sizes) / (order.length - 1);
  let at = lo(first);

  return order.map((item) => {
    const moved = axis === 'across' ? by(item, at - lo(item), 0) : by(item, 0, at - lo(item));

    at += hi(item) - lo(item) + gap;
    return moved;
  });
}

/** From the group's top-left corner, a cell the size of the largest chosen item, filled in reading order. */
export function gridOf(
  items: readonly FloorItem[],
  columns: number,
  gapCm: number,
): { moved: Placement[]; w: number; l: number } {
  const order = inReadingOrder(items);
  const all = order.map(boxOf);
  const cellW = Math.max(...all.map((one) => one.x1 - one.x0));
  const cellL = Math.max(...all.map((one) => one.y1 - one.y0));
  const cols = Math.min(columns, order.length);
  const rows = Math.ceil(order.length / cols);
  const start = groupBox(items);
  const moved = order.map((item, index) => {
    const b = all[index]!;
    const cx = start.x0 + (index % cols) * (cellW + gapCm) + cellW / 2;
    const cy = start.y0 + Math.floor(index / cols) * (cellL + gapCm) + cellL / 2;

    return by(item, cx - (b.x0 + b.x1) / 2, cy - (b.y0 + b.y1) / 2);
  });

  return { moved, w: cols * cellW + (cols - 1) * gapCm, l: rows * cellL + (rows - 1) * gapCm };
}

export function movedItem(item: FloorItem, to: Placement): FloorItem {
  return { ...item, one: { ...item.one, xCm: to.xCm, yCm: to.yCm } } as FloorItem;
}

export function outlinesOf(
  plan: SeatingPlan,
  items: readonly FloorItem[],
  moved: readonly Placement[],
): (FloorBox & { amber: boolean })[] {
  return moved.flatMap((to) => {
    const item = items.find((one) => one.one.id === to.id);

    if (item == null) return [];
    const at = movedItem(item, to);

    return [{ ...boxOf(at), amber: !insideRoom(footprintOf(at), plan) }];
  });
}

export function outsider(
  plan: SeatingPlan,
  items: readonly FloorItem[],
  moved: readonly Placement[],
): FloorItem | null {
  const at = moved.flatMap((to) => {
    const item = items.find((one) => one.one.id === to.id);

    return item == null ? [] : [movedItem(item, to)];
  });

  return inReadingOrder(at).find((item) => !insideRoom(footprintOf(item), plan)) ?? null;
}

/** The name without case or accents, as the API's NameNormaliser keys it. */
export function nameKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** The chosen tables named in reading order from `start`; `clash` is the first name a table outside the choice keeps. */
export function renumbered(
  plan: SeatingPlan,
  chosen: readonly FloorItem[],
  start: number,
  named: (n: number) => string,
): { names: { id: string; version: number; name: string }[]; clash: string | null } {
  const tables = inReadingOrder(chosen.filter((item) => item.kind === 'table'));
  const names = tables.map((item, index) => ({
    id: item.one.id,
    version: item.one.version,
    name: named(start + index),
  }));
  const ids = new Set(chosen.map((item) => item.one.id));
  const others = new Set(
    plan.tables.filter((one) => !ids.has(one.id)).map((one) => nameKey(one.name)),
  );

  return { names, clash: names.find((one) => others.has(nameKey(one.name)))?.name ?? null };
}

export interface KindLine {
  key: string;
  word: { key: string } | { name: string };
  ids: string[];
}

const SHAPE_WORDS: readonly [TableShape, string][] = [
  ['round', 'seating.allRound'],
  ['rectangular', 'seating.allRectangular'],
  ['head', 'seating.allHead'],
  ['cocktail', 'seating.allCocktail'],
];

/** Each table shape in use, then Rows, Single seats and Room features always, so the menu keeps its order from plan to plan; then each section. */
export function kindLines(plan: SeatingPlan): { kinds: KindLine[]; sections: KindLine[] } {
  const items = floorItems(plan);
  const shapes = SHAPE_WORDS.map(([shape, key]) => ({
    key: shape,
    word: { key },
    ids: plan.tables.filter((one) => one.shape === shape).map((one) => one.id),
  })).filter((line) => line.ids.length > 0);

  return {
    kinds: [
      ...shapes,
      { key: 'row', word: { key: 'seating.allRows' }, ids: plan.rows.map((one) => one.id) },
      {
        key: 'seat',
        word: { key: 'seating.allSingleSeats' },
        ids: plan.singleSeats.map((one) => one.id),
      },
      { key: 'feature', word: { key: 'seating.allFeatures' }, ids: [] },
    ],
    sections: plan.sections.map((section) => ({
      key: section.id,
      word: { name: section.name },
      ids: items.filter((item) => item.one.sectionId === section.id).map((item) => item.one.id),
    })),
  };
}

export function readWhole(text: string, max: number): number | null {
  const typed = text.trim();

  if (!/^\d+$/u.test(typed)) return null;
  const n = Number(typed);

  return n >= 1 && n <= max ? n : null;
}

/** A gap in metres, or in feet ("1.5", "2 ft 6 in") where the plan is in feet: 0 to 10 m or 0 to 32 ft. */
export function readGap(text: string, system: 'metric' | 'us', locale: string): number | null {
  const typed = text.trim();

  if (system === 'us') {
    const inches = typed === '' ? null : readFeetAndInches(typed, locale);
    const cm = inches == null ? null : inches * CM_PER_INCH;

    return cm != null && cm <= GAP_MAX_FT * 12 * CM_PER_INCH + 1e-6 ? cm : null;
  }
  if (!/^\d+(?:[.,]\d+)?$/u.test(typed)) return null;
  const cm = Number(typed.replace(',', '.')) * 100;

  return cm <= GAP_MAX_CM ? cm : null;
}

export function seatingIn(answer: Seating | SeatingWithChosen): Seating {
  return 'chosen' in answer ? answer.seating : answer;
}

export function restoredOf(item: FloorItem): SeatingRestoredItem {
  const at = { sectionId: item.one.sectionId, xCm: item.one.xCm, yCm: item.one.yCm };

  if (item.kind === 'table')
    return {
      kind: 'table',
      name: item.one.name,
      ...at,
      shape: item.one.shape,
      seats: item.one.seats,
      widthCm: item.one.widthCm,
      lengthCm: item.one.lengthCm,
      endSeats: item.one.endSeats,
      rotation: item.one.rotation,
      unusableSeats: [...item.one.unusableSeats],
    };
  if (item.kind === 'row')
    return {
      kind: 'row',
      name: item.one.label,
      ...at,
      seats: item.one.seats,
      spacingCm: item.one.spacingCm,
      rotation: item.one.rotation,
      unusableSeats: [...item.one.unusableSeats],
    };
  return { kind: 'seat', name: item.one.name, ...at, unusable: item.one.unusable };
}

export function onlyTables(items: readonly FloorItem[]): boolean {
  return items.every((item) => item.kind === 'table');
}

/** "2 tables · 1 row · 0 guests seated": nobody can be seated until sc-4013. */
export function summaryOf(t: TFunction, items: readonly FloorItem[]): string {
  const tables = items.filter((item) => item.kind === 'table').length;
  const rows = items.filter((item) => item.kind === 'row').length;
  const seats = items.filter((item) => item.kind === 'seat').length;

  return [
    tables > 0 ? t('seating.countTables', { count: tables }) : null,
    rows > 0 ? t('seating.countRows', { count: rows }) : null,
    seats > 0 ? t('seating.countSingleSeats', { count: seats }) : null,
    t('seating.guestsSeated', { count: 0 }),
  ]
    .filter((part): part is string => part != null)
    .join(' · ');
}
