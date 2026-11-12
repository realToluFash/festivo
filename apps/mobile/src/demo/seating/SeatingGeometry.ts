import type { Chair, Item } from './SeatingSample.ts';

/** A chair is 44 cm across; its centre sits 28 cm beyond a table's edge, a cocktail table's places 24 (seating-a-spec §2). */
export const CHAIR_R = 22;
const GAP_TABLE = 28;
const GAP_COCKTAIL = 24;

export interface Point {
  x: number;
  y: number;
}

/** s is px per cm: 100% is 1 px to 2 cm. ox and oy put the room's top left in the picture. */
export interface View {
  s: number;
  ox: number;
  oy: number;
}

export interface Room {
  name: string;
  w: number;
  l: number;
}

export type Detail = 'out' | 'fit' | 'near';

export const MIN_S = 0.125;
export const MAX_S = 2;
export const ZOOM_STEPS = [25, 33, 40, 50, 67, 75, 100, 150, 200, 300, 400] as const;

export function isCircle(it: Item): boolean {
  return it.kind === 'round' || it.kind === 'cocktail' || it.kind === 'single';
}

export function seatCount(it: Item): number {
  return it.chairs.length;
}

function spread(count: number, length: number): number[] {
  return Array.from({ length: count }, (_, j) => -length / 2 + (length * (j + 0.5)) / count);
}

/** The side each chair is on, so "side by side" never turns a corner: one side for a round table, four for a long one. */
export function chairSides(it: Item): number[] {
  const n = seatCount(it);
  if (it.kind !== 'rect' && it.kind !== 'head') return Array.from({ length: n }, () => 0);
  const { top, right, bottom, left } = longSides(it);
  return [
    ...Array.from({ length: top }, () => 0),
    ...Array.from({ length: right }, () => 1),
    ...Array.from({ length: bottom }, () => 2),
    ...Array.from({ length: left }, () => 3),
  ];
}

function longSides(it: Item) {
  const n = seatCount(it);
  const left = Math.ceil(it.ends / 2);
  const right = Math.floor(it.ends / 2);
  const side = n - it.ends;
  const top = it.kind === 'rect' ? Math.ceil(side / 2) : 0;

  return { top, right, bottom: side - top, left };
}

/** Each chair's centre from the item's centre in cm, before turning, numbered clockwise from the top; seat 1 at the left of a row. */
export function chairPoints(it: Item): Point[] {
  const n = seatCount(it);
  if (it.kind === 'round' || it.kind === 'cocktail') {
    const r = it.d / 2 + (it.kind === 'round' ? GAP_TABLE : GAP_COCKTAIL);
    return Array.from({ length: n }, (_, i) => {
      const a = ((-90 + (360 * i) / n) * Math.PI) / 180;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    });
  }
  if (it.kind === 'rect' || it.kind === 'head') {
    const { top, right, bottom, left } = longSides(it);
    return [
      ...spread(top, it.w).map((x) => ({ x, y: -it.l / 2 - GAP_TABLE })),
      ...spread(right, it.l).map((y) => ({ x: it.w / 2 + GAP_TABLE, y })),
      ...spread(bottom, it.w)
        .reverse()
        .map((x) => ({ x, y: it.l / 2 + GAP_TABLE })),
      ...spread(left, it.l)
        .reverse()
        .map((y) => ({ x: -it.w / 2 - GAP_TABLE, y })),
    ];
  }
  if (it.kind === 'row')
    return Array.from({ length: n }, (_, i) => ({ x: (-(n - 1) / 2 + i) * it.spacing, y: 0 }));
  return [{ x: 0, y: 0 }];
}

export function turn(p: Point, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

export function extent(it: Item): Point {
  if (it.kind === 'round' || it.kind === 'cocktail') {
    const r = it.d / 2 + (it.kind === 'round' ? GAP_TABLE : GAP_COCKTAIL) + CHAIR_R;
    return { x: r, y: r };
  }
  if (it.kind === 'rect' || it.kind === 'head')
    return {
      x: it.w / 2 + (it.ends > 0 ? GAP_TABLE + CHAIR_R : 0),
      y: it.l / 2 + GAP_TABLE + CHAIR_R,
    };
  if (it.kind === 'row') return { x: ((seatCount(it) - 1) / 2) * it.spacing + CHAIR_R, y: CHAIR_R };
  return { x: CHAIR_R, y: CHAIR_R };
}

export function bounds(it: Item): Point {
  const e = extent(it);
  if (isCircle(it) || it.rot === 0) return e;
  const a = (it.rot * Math.PI) / 180;
  return {
    x: Math.abs(e.x * Math.cos(a)) + Math.abs(e.y * Math.sin(a)),
    y: Math.abs(e.x * Math.sin(a)) + Math.abs(e.y * Math.cos(a)),
  };
}

/** The room's margins inside its box, top, right, bottom, left: room for the floating tools, or only a frame once they sit outside it. */
export type Pad = readonly [number, number, number, number];
export const PAD_UNDER_TOOLS: Pad = [72, 16, 76, 16];
export const PAD_FRAME: Pad = [16, 16, 16, 16];

export function fit(w: number, h: number, room: Room, pad: Pad = PAD_UNDER_TOOLS): View {
  const [top, right, bottom, left] = pad;
  const s = Math.min((w - left - right) / room.w, (h - top - bottom) / room.l);
  return {
    s,
    ox: left + (w - left - right - room.w * s) / 2,
    oy: top + (h - top - bottom - room.l * s) / 2,
  };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A room word's box as drawn: 20 tall about its y, as wide as its words at 0.56 of their size, from x or about it. */
export function wordsBox(x: number, y: number, words: string, size: number, start: boolean): Box {
  const w = words.length * size * 0.56;
  return { x: start ? x : x - w / 2, y: y - 10, w, h: 20 };
}

function meets(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The first corner where a w × h mark covers none of the words, or the first corner when each would. */
export function clearCorner(
  corners: readonly Point[],
  w: number,
  h: number,
  words: readonly Box[],
): Point {
  const first = corners[0] ?? { x: 0, y: 0 };
  return corners.find((c) => !words.some((b) => meets({ x: c.x, y: c.y, w, h }, b))) ?? first;
}

export function pct(s: number): number {
  return Math.round((s / 0.5) * 100);
}

/** Below 50% outlines and how full; from 150% each chair a 44 target with initials or its number. */
export function detailOf(s: number): Detail {
  if (s < 0.25) return 'out';
  return s >= 0.75 ? 'near' : 'fit';
}

export const HANDLE_DRAWN = 24;
export const HANDLE_HIT = 48;
export const CHAIR_HIT = 48;

function bodyHalf(it: Item): Point {
  return isCircle(it) ? { x: it.d / 2, y: it.d / 2 } : { x: it.w / 2, y: it.l / 2 };
}

export interface Plan {
  room: Room;
  items: readonly Item[];
}

function ownReach(it: Item, s: number): Point {
  const e = extent(it);
  const half = bodyHalf(it);
  const pad =
    detailOf(s) === 'near'
      ? HANDLE_HIT / 2 + Math.max(0, CHAIR_HIT / 2 - CHAIR_R * s)
      : HANDLE_DRAWN / 2;
  return { x: (e.x - half.x) * s + pad, y: (e.y - half.y) * s + pad };
}

function pointsAt(it: Item, s: number, r: Point): Point[] {
  const half = bodyHalf(it);
  const w = half.x * s + r.x;
  const l = half.y * s + r.y;
  if (it.kind === 'round' || it.kind === 'cocktail')
    return [
      { x: -w, y: -l },
      { x: w, y: -l },
      { x: w, y: l },
      { x: -w, y: l },
    ];
  return [
    { x: -w, y: -l },
    { x: 0, y: -l },
    { x: w, y: -l },
    { x: w, y: 0 },
    { x: w, y: l },
    { x: 0, y: l },
    { x: -w, y: l },
    { x: -w, y: 0 },
  ].map((p) => turn(p, it.rot));
}

/** Other items' chairs as a touch would meet them, in px from the room's corner: a 48 target from 150%, the drawn chair below, none zoomed out. */
function othersChairs(
  it: Item,
  s: number,
  plan: Plan,
): { x: number; y: number; r: number; box: boolean }[] {
  const detail = detailOf(s);
  if (detail === 'out') return [];
  const r = detail === 'near' ? CHAIR_HIT / 2 : CHAIR_R * s;
  return plan.items
    .filter((o) => o.id !== it.id)
    .flatMap((o) =>
      chairPoints(o).map((p0) => {
        const p = turn(p0, o.rot);
        return { x: (o.x + p.x) * s, y: (o.y + p.y) * s, r, box: detail === 'near' };
      }),
    );
}

/** A handle's centre held inside the walls: a table held against a wall keeps that side's handle in its frame, half a handle in from the wall. */
function walled(it: Item, s: number, room: Room, p: Point): Point {
  const lo = HANDLE_DRAWN / 2;
  return {
    x: Math.min(room.w * s - lo, Math.max(lo, it.x * s + p.x)) - it.x * s,
    y: Math.min(room.l * s - lo, Math.max(lo, it.y * s + p.y)) - it.y * s,
  };
}

/** How far past a table's edge its handles sit, in px: off its own chairs' targets, inside the walls and, given the plan, off every other item's chairs. */
export function handleReach(it: Item, s: number, plan?: Plan): Point {
  const own = ownReach(it, s);
  if (plan == null) return own;
  const chairs = othersChairs(it, s, plan);
  const cx = it.x * s;
  const cy = it.y * s;
  const over = (r: Point) =>
    pointsAt(it, s, r).reduce((sum, p0) => {
      const p = walled(it, s, plan.room, p0);
      return chairs.reduce((acc, c) => {
        const dx = Math.max(0, Math.abs(cx + p.x - c.x) - HANDLE_HIT / 2);
        const dy = Math.max(0, Math.abs(cy + p.y - c.y) - HANDLE_HIT / 2);
        return acc + Math.max(0, c.r - (c.box ? Math.max(dx, dy) : Math.hypot(dx, dy)));
      }, sum);
    }, 0);
  let best = { r: own, over: Infinity };
  for (let cut = 0; cut <= Math.min(own.x, own.y); cut += 1) {
    const r = { x: own.x - cut, y: own.y - cut };
    const o = over(r);
    if (o === 0) return r;
    if (o < best.over) best = { r, over: o };
  }
  return best.r;
}

/** A round or cocktail table's four corners, a long table's eight points, each handleReach past its edge and inside the walls, from its centre in px. */
export function handlePoints(it: Item, s: number, plan?: Plan): Point[] {
  const points = pointsAt(it, s, handleReach(it, s, plan));
  return plan == null ? points : points.map((p) => walled(it, s, plan.room, p));
}

/** How far past the table's edge one handle sits along the table's own axes, in px; less than its reach, or inside the edge, where a wall holds it in. */
export function reachOf(it: Item, s: number, handle: Point): Point {
  const half = bodyHalf(it);
  const q = turn(handle, -it.rot);
  return { x: Math.abs(q.x) - half.x * s, y: Math.abs(q.y) - half.y * s };
}

/** The size a handle dragged to n px from the centre asks for, in cm: its reach is taken off first, so a handle picked up does not grow the table. */
export function sideFrom(n: number, reach: number, s: number): number {
  return Math.max(40, snapped((2 * Math.max(0, Math.abs(n) - reach)) / s, true));
}

const WORDS_DEPTH = 35;
const NAME_DEPTH = 10;

/** Where a zoomed-out item's name sits, in px: below it, or above it when its name, bar and count would cross the bottom wall at floor. */
export function wordsAt(it: Item, cy: number, s: number, floor: number): number {
  const e = extent(it);
  const off =
    it.kind === 'rect' || it.kind === 'head'
      ? (it.l / 2) * s
      : Math.max(e.y, 40) * s * (it.kind === 'row' ? 1 : 0.55);
  const depth = it.kind === 'single' ? NAME_DEPTH : WORDS_DEPTH;
  const below = cy + off + 12;
  if (below + depth <= floor - 2) return below;
  return cy - off - 2 - depth;
}

/** Where a table's name sits from 50%, in px: on the table when it fits there, else below it, or above it when below would cross the bottom wall at floor. The name is drawn from 10 above to 6 below. */
export function nameAt(it: Item, cy: number, s: number, floor: number): number {
  const round = it.kind === 'round' || it.kind === 'cocktail';
  const bw = (round ? it.d : it.w) * s;
  const bh = (round ? it.d : it.l) * s;
  if (it.name.length * 12 * 0.56 <= bw - 3 && bh >= 15) return cy;
  const e = extent(it).y * s;
  const below = cy + e + 10;
  if (below + 6 <= floor - 2) return below;
  return cy - e - 8;
}

export function zoomAbout(view: View, factor: number, cx: number, cy: number): View {
  const s = Math.min(MAX_S, Math.max(MIN_S, view.s * factor));
  const k = s / view.s;
  return { s, ox: cx - (cx - view.ox) * k, oy: cy - (cy - view.oy) * k };
}

/** − and + step through the zoom's stops about the picture's centre. */
export function zoomStep(view: View, up: boolean, w: number, h: number): View {
  const now = pct(view.s);
  const next = up
    ? (ZOOM_STEPS.find((step) => step > now) ?? 400)
    : ([...ZOOM_STEPS].reverse().find((step) => step < now) ?? 25);
  return zoomAbout(view, ((next / 100) * 0.5) / view.s, w / 2, h / 2);
}

export function centreOn(p: Point, s: number, w: number, h: number): View {
  return { s, ox: w / 2 - p.x * s, oy: h / 2 - p.y * s };
}

export function metres(cm: number): string {
  const v = Math.round(cm) / 100;
  return Number.isInteger(v) ? `${v} m` : `${v.toFixed(2)} m`;
}

export function feetInches(cm: number): string {
  const inches = Math.round(cm / 2.54);
  const feet = Math.floor(inches / 12);
  return `${feet} ft ${inches % 12} in`;
}

export function parseMetres(text: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(m)?\s*$/u.exec(text);
  if (m?.[1] == null) return null;
  return Math.round(Number(m[1].replace(',', '.')) * 100);
}

export function parseWhole(text: string): number | null {
  const m = /^\s*(\d+)\s*(cm|°)?\s*$/u.exec(text);
  return m?.[1] == null ? null : Number(m[1]);
}

export function snapped(cm: number, on: boolean): number {
  return on ? Math.round(cm / 10) * 10 : Math.round(cm);
}

export function inside(it: Item, room: Room): boolean {
  const b = bounds(it);
  return it.x - b.x >= 0 && it.y - b.y >= 0 && it.x + b.x <= room.w && it.y + b.y <= room.l;
}

/** The wall stops a drag: the centre is held where the item still fits. */
export function heldInside(it: Item, room: Room): Point {
  const b = bounds(it);
  return {
    x: Math.min(room.w - b.x, Math.max(b.x, it.x)),
    y: Math.min(room.l - b.y, Math.max(b.y, it.y)),
  };
}

export function overlaps(a: Item, b: Item): boolean {
  if (a.id === b.id) return false;
  const ea = bounds(a);
  const eb = bounds(b);
  if (isCircle(a) && isCircle(b)) return Math.hypot(a.x - b.x, a.y - b.y) < ea.x + eb.x;
  return Math.abs(a.x - b.x) < ea.x + eb.x && Math.abs(a.y - b.y) < ea.y + eb.y;
}

export function overlapping(it: Item, items: readonly Item[]): Item[] {
  return items.filter((other) => overlaps(it, other));
}

/** The nearest free space to a point: the point itself, else rings outward on the 10 cm grid. */
export function nearestFree(it: Item, items: readonly Item[], room: Room, from: Point): Point {
  for (let r = 0; r <= Math.max(room.w, room.l); r += 40) {
    const tries = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / 40));
    for (let k = 0; k < tries; k += 1) {
      const a = (2 * Math.PI * k) / tries;
      const p = {
        x: snapped(from.x + r * Math.cos(a), true),
        y: snapped(from.y + r * Math.sin(a), true),
      };
      const placed = { ...it, ...p };
      if (inside(placed, room) && overlapping(placed, items).length === 0) return p;
    }
  }
  return from;
}

export function itemAt(items: readonly Item[], p: Point, slop: number): Item | null {
  let best: { it: Item; d: number } | null = null;
  for (const it of items) {
    const local = turn({ x: p.x - it.x, y: p.y - it.y }, -it.rot);
    const e = extent(it);
    const d = isCircle(it)
      ? Math.hypot(local.x, local.y) - e.x
      : Math.max(Math.abs(local.x) - e.x, Math.abs(local.y) - e.y);
    if (d <= slop && (best == null || d < best.d)) best = { it, d };
  }
  return best?.it ?? null;
}

export function chairAt(it: Item, index: number): Point {
  const p = turn(chairPoints(it)[index] ?? { x: 0, y: 0 }, it.rot);
  return { x: it.x + p.x, y: it.y + p.y };
}

export const usable = (it: Item): number => it.chairs.filter((c) => c.state !== 'unusable').length;
export const filled = (it: Item): number =>
  it.chairs.filter((c) => c.state === 'taken' || c.state === 'held').length;
export const free = (it: Item): number => usable(it) - filled(it);
export const takenCount = (chairs: readonly Chair[]): number =>
  chairs.filter((c) => c.state === 'taken').length;

export function sideBySide(it: Item, size: number): number[] | null {
  const n = it.chairs.length;
  const sides = chairSides(it);
  const round = it.kind === 'round' || it.kind === 'cocktail';
  for (let start = 0; start < n; start += 1) {
    const run = Array.from({ length: size }, (_, k) => (round ? (start + k) % n : start + k));
    if (run.some((i) => i >= n)) break;
    if (size > n) break;
    const empty = run.every((i) => it.chairs[i]?.state === 'empty');
    const oneSide = run.every((i) => sides[i] === sides[run[0] ?? 0]);
    if (empty && oneSide) return run;
  }
  return null;
}

export function firstEmpty(it: Item, size: number): number[] {
  return it.chairs
    .map((chair, index) => ({ chair, index }))
    .filter(({ chair }) => chair.state === 'empty')
    .slice(0, size)
    .map(({ index }) => index);
}
