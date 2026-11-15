/** Where a table's chairs sit (sc-4000); the API's TableGeometry holds the same gaps for the floor a table takes. */

export type TableShapeName = 'round' | 'rectangular' | 'head' | 'cocktail';

export interface TableLayout {
  shape: TableShapeName;
  seats: number;
  widthCm: number;
  lengthCm: number;
  endSeats: number;
}

export type ChairSide = 'round' | 'top' | 'right' | 'bottom' | 'left';

export interface PlacedChair {
  /** From 1: on a long table, the top side left to right, then the right end, the bottom side right to left, the left end. */
  seat: number;
  side: ChairSide;
  x: number;
  y: number;
}

export const CHAIR_RADIUS_CM = 22;
const CHAIR_GAP_CM = 28;
const PLACE_GAP_CM = 24;

/** The catering allowance below which a table warns (sc-4000, reversed 20 Oct). */
export const SQUEEZE_CM_PER_CHAIR = 55;

export function isRoundShape(shape: TableShapeName): boolean {
  return shape === 'round' || shape === 'cocktail';
}

/** The ends split with the left taking the odd one, the long sides with the top taking it; a head table seats only its bottom side. */
export function sidesOf(table: TableLayout): Record<Exclude<ChairSide, 'round'>, number> {
  if (isRoundShape(table.shape)) return { top: 0, right: 0, bottom: 0, left: 0 };
  const ends = Math.min(Math.max(table.endSeats, 0), table.seats);
  const side = table.seats - ends;
  const left = Math.ceil(ends / 2);
  const right = Math.floor(ends / 2);

  return table.shape === 'head'
    ? { top: 0, right, bottom: side, left }
    : { top: Math.ceil(side / 2), right, bottom: Math.floor(side / 2), left };
}

function spread(count: number, length: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => -length / 2 + (length * (index + 0.5)) / count,
  );
}

export function chairsOf(table: TableLayout): PlacedChair[] {
  if (isRoundShape(table.shape)) {
    const r = table.widthCm / 2 + (table.shape === 'cocktail' ? PLACE_GAP_CM : CHAIR_GAP_CM);

    return Array.from({ length: table.seats }, (_, index) => {
      const a = ((-90 + (360 * index) / table.seats) * Math.PI) / 180;

      return { seat: index + 1, side: 'round', x: r * Math.cos(a), y: r * Math.sin(a) };
    });
  }

  const w = table.widthCm;
  const l = table.lengthCm;
  const { top, right, bottom, left } = sidesOf(table);
  const placed: Omit<PlacedChair, 'seat'>[] = [
    ...spread(top, w).map((x) => ({ side: 'top' as const, x, y: -l / 2 - CHAIR_GAP_CM })),
    ...spread(right, l).map((y) => ({ side: 'right' as const, x: w / 2 + CHAIR_GAP_CM, y })),
    ...spread(bottom, w)
      .reverse()
      .map((x) => ({ side: 'bottom' as const, x, y: l / 2 + CHAIR_GAP_CM })),
    ...spread(left, l)
      .reverse()
      .map((y) => ({ side: 'left' as const, x: -w / 2 - CHAIR_GAP_CM, y })),
  ];

  return placed.map((chair, index) => ({ ...chair, seat: index + 1 }));
}

export function tableExtent(table: TableLayout): [number, number] {
  if (isRoundShape(table.shape)) {
    const r =
      table.widthCm / 2 +
      (table.shape === 'cocktail' ? PLACE_GAP_CM : CHAIR_GAP_CM) +
      CHAIR_RADIUS_CM;

    return [r, r];
  }
  const ends = table.endSeats > 0 ? CHAIR_GAP_CM + CHAIR_RADIUS_CM : 0;

  return [table.widthCm / 2 + ends, table.lengthCm / 2 + CHAIR_GAP_CM + CHAIR_RADIUS_CM];
}

/** Below 55 cm of edge a chair: a round table's circumference over its seats, a long table's each side and end on its own; never a cocktail table, whose guests stand. */
export function squeezed(table: TableLayout): boolean {
  if (table.shape === 'cocktail' || table.seats < 1) return false;
  if (table.shape === 'round')
    return (Math.PI * table.widthCm) / table.seats < SQUEEZE_CM_PER_CHAIR;
  const { top, right, bottom, left } = sidesOf(table);
  const each = [
    [top, table.widthCm],
    [bottom, table.widthCm],
    [right, table.lengthCm],
    [left, table.lengthCm],
  ].filter(([count]) => count! > 0);

  return each.some(([count, edge]) => edge! / count! < SQUEEZE_CM_PER_CHAIR);
}
