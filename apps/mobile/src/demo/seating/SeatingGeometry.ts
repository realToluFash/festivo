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

/** A room word's letters, for telling whether it meets another word or a ring: as wide as its box, as tall as its size and 4 more. */
export function lettersBox(x: number, y: number, words: string, size: number, start: boolean): Box {
  const b = wordsBox(x, y, words, size, start);
  return { ...b, y: y - size / 2 - 2, h: size + 4 };
}

/** A colleague's ring as drawn: its centre, the outer edge's half-width and half-height (a round one's are its radius), and the stroke's width inward. */
export interface Ring {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  round: boolean;
  stroke: number;
}

function crosses(ring: Ring, b: Box): boolean {
  const { cx, cy, hx, hy, stroke } = ring;
  if (ring.round) {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w)) - cx;
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h)) - cy;
    const fx = Math.max(Math.abs(b.x - cx), Math.abs(b.x + b.w - cx));
    const fy = Math.max(Math.abs(b.y - cy), Math.abs(b.y + b.h - cy));
    return Math.hypot(nx, ny) < hx && Math.hypot(fx, fy) > hx - stroke;
  }
  const outer = { x: cx - hx, y: cy - hy, w: 2 * hx, h: 2 * hy };
  const inner = {
    x: outer.x + stroke,
    y: outer.y + stroke,
    w: outer.w - 2 * stroke,
    h: outer.h - 2 * stroke,
  };
  const within =
    b.x >= inner.x &&
    b.y >= inner.y &&
    b.x + b.w <= inner.x + inner.w &&
    b.y + b.h <= inner.y + inner.h;
  return meets(b, outer) && !within;
}

/** A colleague's ring about an item: a round one's radius r, or a square one's half-sides gw and gh, and the half-width and half-height it reaches from the item's centre. From 50% it goes about the chairs; below, about the table alone, since its chairs are not drawn there and its words sit just under it (sc-31783). */
export interface RingSize {
  r: number;
  gw: number;
  gh: number;
  hx: number;
  hy: number;
}

export function ringAbout(it: Item, s: number, detail: Detail, lit: boolean): RingSize {
  const e = extent(it);
  const hug = detail === 'out';
  const pad = lit ? 10 : hug ? 0 : 2;
  if (isCircle(it)) {
    const half = hug && (it.kind === 'round' || it.kind === 'cocktail') ? it.d / 2 : e.x;
    const r = half * s + pad + 3.5;
    return { r, gw: 0, gh: 0, hx: r + 3, hy: r + 3 };
  }
  const half = hug && (it.kind === 'rect' || it.kind === 'head') ? { x: it.w / 2, y: it.l / 2 } : e;
  const gw = half.x * s + pad + 2;
  const gh = half.y * s + pad + 2;
  const a = (it.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const n = Math.abs(Math.sin(a));
  return { r: 0, gw, gh, hx: gw * c + gh * n + 3, hy: gw * n + gh * c + 3 };
}

/** Whether every word in the room sits apart: no two meet, and no colleague's ring runs through one (sc-31783). */
export function wordsApart(words: readonly Box[], rings: readonly Ring[]): boolean {
  return words.every(
    (a, i) =>
      words.every((b, j) => j <= i || !meets(a, b)) && rings.every((ring) => !crosses(ring, a)),
  );
}

function meets(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Where a w × h mark may sit on a round table's ring of radius r about (cx, cy): its four corners, then the ring's right and left, each as the mark's top left. */
export function ringPlaces(cx: number, cy: number, r: number, w: number, h: number): Point[] {
  const d = (r - 1.5) * 0.72;
  return [
    { x: cx - d - 4, y: cy - d - h / 2 },
    { x: cx + d + 4 - w, y: cy - d - h / 2 },
    { x: cx - d - 4, y: cy + d - h / 2 },
    { x: cx + d + 4 - w, y: cy + d - h / 2 },
    { x: cx + r - w / 2, y: cy - h / 2 },
    { x: cx - r - w / 2, y: cy - h / 2 },
  ];
}

/** The first place where a w × h mark covers none of the words, or the one that covers least when each would. */
export function clearCorner(
  corners: readonly Point[],
  w: number,
  h: number,
  words: readonly Box[],
): Point {
  const first = corners[0] ?? { x: 0, y: 0 };
  const covered = (c: Point) =>
    words.reduce((n, b) => n + overlapArea({ x: c.x, y: c.y, w, h }, b), 0);
  return (
    corners.find((c) => !words.some((b) => meets({ x: c.x, y: c.y, w, h }, b))) ??
    corners.reduce((a, c) => (covered(c) < covered(a) ? c : a), first)
  );
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

/** Where a zoomed-out item's name sits, in px: below it, or above it when its name, bar and count would cross the bottom wall at floor; at least clear px from its centre, so a colleague's ring stays off them. */
export function wordsAt(it: Item, cy: number, s: number, floor: number, clear = 0): number {
  const e = extent(it);
  const off = Math.max(
    clear,
    it.kind === 'rect' || it.kind === 'head'
      ? (it.l / 2) * s
      : Math.max(e.y, 40) * s * (it.kind === 'row' ? 1 : 0.55),
  );
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
  if (wordsBox(0, 0, it.name, 12, false).w <= bw - 3 && bh >= 15) return cy;
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

const CARD_LINE = 16;

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const ROW_SLACK = 20;

/** The iPhone room card's words (sc-31783): each item's name alone, the List carrying the counts. From the bottom of the room up, each name goes below its item, else above (either up to 12 px aside), right or left: the first place inside the walls that keeps 8 px off every other item and 2 px off each name already placed, so a name sits nearer its own item than any other, or else the place that covers least. Tables whose centres lie within 20 cm of each other's are a row, and a row's names all go below it, else all above, else on whichever side covers least, so no name reads as the next row's. */
export function cardNames(
  items: readonly Item[],
  v: View,
  room: Room,
): { id: string; x: number; y: number }[] {
  const inside: Box = { x: v.ox + 1, y: v.oy + 1, w: room.w * v.s - 2, h: room.l * v.s - 2 };
  const grow = (b: Box, n: number): Box => ({
    x: b.x - n,
    y: b.y - n,
    w: b.w + 2 * n,
    h: b.h + 2 * n,
  });
  const bodies = items.map((it) => {
    const b = bounds(it);
    return {
      x: v.ox + (it.x - b.x) * v.s,
      y: v.oy + (it.y - b.y) * v.s,
      w: 2 * b.x * v.s,
      h: 2 * b.y * v.s,
    };
  });
  const sides = (i: number): Box[][] => {
    const it = items[i];
    const body = bodies[i];
    if (it == null || body == null) return [];
    const w = wordsBox(0, 0, it.name, 12, false).w;
    const cx = body.x + body.w / 2;
    const cy = body.y + body.h / 2;
    const nudged = (y: number) =>
      [0, 6, -6, 12, -12].map((dx) => ({ x: cx - w / 2 + dx, y, w, h: CARD_LINE }));
    return [
      nudged(body.y + body.h + 1),
      nudged(body.y - 1 - CARD_LINE),
      [
        { x: body.x + body.w + 3, y: cy - CARD_LINE / 2, w, h: CARD_LINE },
        { x: body.x - 3 - w, y: cy - CARD_LINE / 2, w, h: CARD_LINE },
      ],
    ];
  };
  const cost = (i: number, p: Box, placed: readonly Box[]) =>
    p.w * p.h -
    overlapArea(p, inside) +
    [
      ...placed.map((b) => grow(b, 2)),
      ...bodies.filter((_, j) => j !== i).map((b) => grow(b, 8)),
    ].reduce((n, b) => n + overlapArea(p, b), 0);
  const settle = (row: readonly number[], places: (i: number) => Box[], placed: readonly Box[]) =>
    row.reduce<{ boxes: Box[]; cost: number }>(
      (sum, i) => {
        const now = [...placed, ...sum.boxes];
        const best = places(i).reduce((a, b) => (cost(i, b, now) < cost(i, a, now) ? b : a));
        return { boxes: [...sum.boxes, best], cost: sum.cost + cost(i, best, now) };
      },
      { boxes: [], cost: 0 },
    );
  const table = (it: Item | undefined) => it != null && it.kind !== 'row' && it.kind !== 'single';
  const rows: number[][] = [];
  items
    .map((_, i) => i)
    .sort((a, b) => (items[b]?.y ?? 0) - (items[a]?.y ?? 0))
    .forEach((i) => {
      const it = items[i];
      const row = table(it)
        ? rows.find((r) => {
            const first = items[r[0] ?? -1];
            return table(first) && Math.abs((first?.y ?? 0) - (it?.y ?? 0)) <= ROW_SLACK;
          })
        : undefined;
      if (row == null) rows.push([i]);
      else row.push(i);
    });
  const placed: Box[] = [];
  const names = new Map<string, Point>();
  rows.forEach((row) => {
    const tries =
      row.length === 1
        ? [settle(row, (i) => sides(i).flat(), placed)]
        : [0, 1].map((side) => settle(row, (i) => sides(i)[side] ?? [], placed));
    const pick =
      tries.find((t) => t.cost === 0) ?? tries.reduce((a, b) => (b.cost < a.cost ? b : a));
    row.forEach((i, k) => {
      const it = items[i];
      const best = pick.boxes[k];
      if (it == null || best == null) return;
      placed.push(best);
      names.set(it.id, { x: best.x + best.w / 2, y: best.y + best.h / 2 });
    });
  });
  return items.flatMap((it) => {
    const at = names.get(it.id);
    return at == null ? [] : [{ id: it.id, ...at }];
  });
}
