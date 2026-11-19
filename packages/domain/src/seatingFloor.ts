import { type RoomUnits } from './roomSize.ts';

/** An item as the floor sees it: its middle, its turn, and half its width and length with chairs and a row's tab, before it turns. */
export interface Footprint {
  xCm: number;
  yCm: number;
  rotation: number;
  round: boolean;
  half: [number, number];
}

export interface FloorBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CM_PER_INCH = 2.54;

/** Snap to grid and the arrow keys (pm, 20 Oct): 10 cm, 10 cm and 1 m, or 6 in, 3 in and 1 ft. */
export const FLOOR_STEPS: Record<RoomUnits, { grid: number; key: number; bigKey: number }> = {
  metric: { grid: 10, key: 10, bigKey: 100 },
  us: { grid: 6 * CM_PER_INCH, key: 3 * CM_PER_INCH, bigKey: 12 * CM_PER_INCH },
};

function turned([x, y]: [number, number], degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;

  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

export function floorBox(item: Footprint, at: [number, number] = [item.xCm, item.yCm]): FloorBox {
  const [ex, ey] = item.half;
  const angle = (item.rotation * Math.PI) / 180;
  const halfX = item.round ? ex : Math.abs(ex * Math.cos(angle)) + Math.abs(ey * Math.sin(angle));
  const halfY = item.round ? ey : Math.abs(ex * Math.sin(angle)) + Math.abs(ey * Math.cos(angle));

  return { x0: at[0] - halfX, y0: at[1] - halfY, x1: at[0] + halfX, y1: at[1] + halfY };
}

/** As the API's FloorGeometry::inside: half a centimetre of rounding either way is still inside. */
export function insideRoom(
  item: Footprint,
  room: { widthCm: number; lengthCm: number },
  at: [number, number] = [item.xCm, item.yCm],
): boolean {
  const box = floorBox(item, at);

  return (
    box.x0 >= -0.5 &&
    box.y0 >= -0.5 &&
    box.x1 <= room.widthCm + 0.5 &&
    box.y1 <= room.lengthCm + 0.5
  );
}

/** How far a step of several items may go before the first of them meets a wall: it stops at the edge. */
export function shiftWithin(
  items: readonly Footprint[],
  room: { widthCm: number; lengthCm: number },
  [dx, dy]: [number, number],
): [number, number] {
  let x = dx;
  let y = dy;

  for (const item of items) {
    const box = floorBox(item);

    x = Math.min(Math.max(x, Math.min(0, -box.x0)), Math.max(0, room.widthCm - box.x1));
    y = Math.min(Math.max(y, Math.min(0, -box.y0)), Math.max(0, room.lengthCm - box.y1));
  }

  return [x, y];
}

export function snapToGrid(cm: number, units: RoomUnits, on: boolean): number {
  const step = FLOOR_STEPS[units].grid;

  return Math.round(on ? Math.round(cm / step) * step : cm);
}

export function keyStep(units: RoomUnits, big: boolean): number {
  return big ? FLOOR_STEPS[units].bigKey : FLOOR_STEPS[units].key;
}

function corners(item: Footprint): [number, number][] {
  const [ex, ey] = item.half;

  return (
    [
      [-ex, -ey],
      [ex, -ey],
      [ex, ey],
      [-ex, ey],
    ] as [number, number][]
  ).map((corner) => {
    const [x, y] = turned(corner, item.rotation);

    return [item.xCm + x, item.yCm + y];
  });
}

function spread(points: readonly [number, number][], axis: [number, number]): [number, number] {
  const values = points.map(([x, y]) => x * axis[0] + y * axis[1]);

  return [Math.min(...values), Math.max(...values)];
}

/** Two items whose chairs cross by more than a centimetre: circle against circle, circle against a turned box, or two turned boxes by their axes. */
export function overlapping(a: Footprint, b: Footprint): boolean {
  const gap = 1;

  if (a.round && b.round)
    return Math.hypot(a.xCm - b.xCm, a.yCm - b.yCm) < a.half[0] + b.half[0] - gap;
  if (a.round !== b.round) {
    const circle = a.round ? a : b;
    const box = a.round ? b : a;
    const [ex, ey] = box.half;
    const [lx, ly] = turned([circle.xCm - box.xCm, circle.yCm - box.yCm], -box.rotation);
    const nx = Math.max(-ex, Math.min(ex, lx));
    const ny = Math.max(-ey, Math.min(ey, ly));

    return Math.hypot(lx - nx, ly - ny) < circle.half[0] - gap;
  }
  const pa = corners(a);
  const pb = corners(b);
  const axes = [a.rotation, b.rotation].flatMap((rotation) => [
    turned([1, 0], rotation),
    turned([0, 1], rotation),
  ]);

  return axes.every((axis) => {
    const [a0, a1] = spread(pa, axis);
    const [b0, b1] = spread(pb, axis);

    return a1 - gap > b0 && b1 - gap > a0;
  });
}
