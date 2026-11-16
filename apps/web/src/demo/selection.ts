import {
  type Item,
  type Kind,
  type Plan,
  type Units,
  SW,
  bounds,
  filled,
  inside,
  isTable,
  lengthOf,
  many,
  nextName,
  readCount,
  readFeet,
  readMetres,
  sameName,
  say,
} from './seating.ts';

export type Edge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
export type Fold = 'grid' | 'renumber' | 'section';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Outline extends Rect {
  amber: boolean;
}

export const EDGES: readonly Edge[] = ['left', 'centre', 'right', 'top', 'middle', 'bottom'];
export const COPY_OFFSET = 50;
const GAP_MAX_CM = 1000;
const GAP_MAX_FT = 32;
const COLUMNS_MAX = 20;
const START_MAX = 999;

export function rectOf(from: readonly [number, number], to: readonly [number, number]): Rect {
  return {
    x0: Math.min(from[0], to[0]),
    y0: Math.min(from[1], to[1]),
    x1: Math.max(from[0], to[0]),
    y1: Math.max(from[1], to[1]),
  };
}

export function groupBox(items: readonly Item[]): Rect {
  const all = items.map((item) => bounds(item));

  return {
    x0: Math.min(...all.map((one) => one.x0)),
    y0: Math.min(...all.map((one) => one.y0)),
    x1: Math.max(...all.map((one) => one.x1)),
    y1: Math.max(...all.map((one) => one.y1)),
  };
}

export function touched(items: readonly Item[], box: Rect): string[] {
  return items
    .filter((item) => {
      const b = bounds(item);

      return b.x0 <= box.x1 && b.x1 >= box.x0 && b.y0 <= box.y1 && b.y1 >= box.y0;
    })
    .map((item) => item.id);
}

/** A line holds the items whose centres sit within half the first one's depth of it, so tables a few centimetres out of line don't number in a zigzag. */
export function inReadingOrder(items: readonly Item[]): Item[] {
  const left = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Item[] = [];

  while (left.length > 0) {
    const first = left[0]!;
    const b = bounds(first);
    const reach = (b.y1 - b.y0) / 2;
    const line = left.filter((item) => Math.abs(item.y - first.y) <= reach);

    out.push(...line.sort((a, c) => a.x - c.x));
    for (const item of line) left.splice(left.indexOf(item), 1);
  }
  return out;
}

function by(item: Item, dx: number, dy: number): Item {
  return { ...item, x: Math.round(item.x + dx), y: Math.round(item.y + dy) };
}

export function aligned(items: readonly Item[], edge: Edge): Item[] {
  const group = groupBox(items);

  return items.map((item) => {
    const b = bounds(item);

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
export function spaced(items: readonly Item[], axis: 'across' | 'down'): Item[] {
  const lo = (item: Item) => (axis === 'across' ? bounds(item).x0 : bounds(item).y0);
  const hi = (item: Item) => (axis === 'across' ? bounds(item).x1 : bounds(item).y1);
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
  items: readonly Item[],
  columns: number,
  gap: number,
): { moved: Item[]; w: number; l: number } {
  const order = inReadingOrder(items);
  const all = order.map((item) => bounds(item));
  const cellW = Math.max(...all.map((one) => one.x1 - one.x0));
  const cellL = Math.max(...all.map((one) => one.y1 - one.y0));
  const cols = Math.min(columns, order.length);
  const rows = Math.ceil(order.length / cols);
  const start = groupBox(items);
  const moved = order.map((item, index) => {
    const b = bounds(item);
    const cx = start.x0 + (index % cols) * (cellW + gap) + cellW / 2;
    const cy = start.y0 + Math.floor(index / cols) * (cellL + gap) + cellL / 2;

    return by(item, cx - (b.x0 + b.x1) / 2, cy - (b.y0 + b.y1) / 2);
  });

  return { moved, w: cols * cellW + (cols - 1) * gap, l: rows * cellL + (rows - 1) * gap };
}

export function outlinesOf(plan: Plan, moved: readonly Item[]): Outline[] {
  return moved.map((item) => ({
    ...bounds(item),
    amber: plan.room == null || !inside(item, plan.room),
  }));
}

/** The first moved item, in reading order, that would leave the room; null when every one stays inside. */
export function outsider(plan: Plan, moved: readonly Item[]): Item | null {
  const room = plan.room;

  if (room == null) return null;
  return inReadingOrder(moved).find((item) => !inside(item, room)) ?? null;
}

export function withMoved(plan: Plan, moved: readonly Item[]): Plan {
  const next = new Map(moved.map((item) => [item.id, item]));

  return { ...plan, items: plan.items.map((item) => next.get(item.id) ?? item) };
}

export function renamed(
  plan: Plan,
  chosen: readonly Item[],
  start: number,
): { moved: Item[]; clash: string | null } {
  const tables = inReadingOrder(chosen.filter(isTable));
  const moved = tables.map((item, index) => ({ ...item, name: `Table ${start + index}` }));
  const ids = new Set(chosen.map((item) => item.id));
  const others = plan.items.filter((item) => !ids.has(item.id) && isTable(item));
  const taken = moved.find((item) => others.some((other) => sameName(other.name, item.name)));

  return { moved, clash: taken?.name ?? null };
}

/** Copies 50 cm down and to the right, empty, named from the next free number; one copy outside the room refuses them all. */
export function copiesOf(
  plan: Plan,
  chosen: readonly Item[],
): { copies: Item[] } | { refused: Item } {
  const room = plan.room;
  const all = [...plan.items];
  const copies: Item[] = [];

  for (const item of inReadingOrder(chosen)) {
    const { name, label } = nextName(all, item.kind);
    const copy: Item = {
      ...item,
      id: `copy-${item.id}-${all.length}`,
      name,
      label,
      x: item.x + COPY_OFFSET,
      y: item.y + COPY_OFFSET,
      chairs: item.chairs.map((chair) => (chair.state === 'unusable' ? chair : { state: 'empty' })),
    };

    if (room == null || !inside(copy, room)) return { refused: item };
    all.push(copy);
    copies.push(copy);
  }
  return { copies };
}

export function thingsOf(items: readonly Item[]): string {
  return items.every(isTable) ? many('tables', items.length) : many('items', items.length);
}

export function seatedOf(items: readonly Item[]): number {
  return items.reduce((sum, item) => sum + filled(item), 0);
}

export function summaryOf(items: readonly Item[]): string {
  const tables = items.filter(isTable).length;
  const rows = items.filter((item) => item.kind === 'row').length;
  const singles = items.filter((item) => item.kind === 'single').length;

  return [
    tables > 0 ? many('tables', tables) : null,
    rows > 0 ? many('rows', rows) : null,
    singles > 0 ? many('singles', singles) : null,
    many('guestsSeated', seatedOf(items)),
  ]
    .filter((part): part is string => part != null)
    .join(' · ');
}

export interface KindLine {
  key: string;
  word: string;
  ids: string[];
}

const SHAPE_WORDS: readonly [Kind, string][] = [
  ['round', SW.allRound],
  ['rect', SW.allRect],
  ['head', SW.allHead],
  ['cocktail', SW.allCocktail],
];

/** Every table shape in use, then Rows, Single seats and Room features always, so the menu keeps its order from plan to plan. */
export function kindLines(plan: Plan): { kinds: KindLine[]; sections: KindLine[] } {
  const of = (kind: Kind) => plan.items.filter((item) => item.kind === kind).map((item) => item.id);
  const shapes = SHAPE_WORDS.map(([kind, word]) => ({ key: kind, word, ids: of(kind) })).filter(
    (line) => line.ids.length > 0,
  );

  return {
    kinds: [
      ...shapes,
      { key: 'row', word: SW.allRows, ids: of('row') },
      { key: 'single', word: SW.allSingles, ids: of('single') },
      { key: 'feature', word: SW.allFeatures, ids: [] },
    ],
    sections: plan.sections.map((section) => ({
      key: section.id,
      word: section.name,
      ids: plan.items.filter((item) => item.sec === section.id).map((item) => item.id),
    })),
  };
}

export function readColumns(text: string): number | null {
  const n = readCount(text);

  return n != null && n >= 1 && n <= COLUMNS_MAX ? n : null;
}

export function readGap(text: string, units: Units): number | null {
  const typed = text.trim();

  if (units === 'us') {
    const cm = /^\d+(?:\.\d+)?$/u.test(typed) ? Number(typed) * 30.48 : readFeet(typed);

    return cm != null && cm <= GAP_MAX_FT * 30.48 + 1e-6 ? cm : null;
  }
  const cm = readMetres(typed);

  return cm != null && cm <= GAP_MAX_CM ? cm : null;
}

export function readStart(text: string): number | null {
  const n = readCount(text);

  return n != null && n >= 1 && n <= START_MAX ? n : null;
}

export function gapRefusal(units: Units): string {
  return units === 'us' ? SW.gapRangeFeet : SW.gapRange;
}

export function tooBig(plan: Plan, w: number, l: number, units: Units): string | null {
  const room = plan.room;

  if (room == null) return null;
  if (w > room.w + 0.5)
    return say(SW.gridWide, { size: lengthOf(w, units), room: lengthOf(room.w, units) });
  if (l > room.l + 0.5)
    return say(SW.gridLong, { size: lengthOf(l, units), room: lengthOf(room.l, units) });
  return null;
}
