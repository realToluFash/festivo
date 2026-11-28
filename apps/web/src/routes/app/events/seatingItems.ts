import {
  type SeatingArrangement,
  type SeatingPlan,
  type SeatingRow,
  type SeatingTable,
  type SingleSeat,
  type TableShape,
} from '@soirely/api-client';
import {
  CHAIR_RADIUS_CM,
  type Footprint,
  isRoundShape,
  overlapping,
  rowExtent,
  tableExtent,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

export type ItemKind = SeatingArrangement['kind'];

export type FloorItem =
  | { kind: 'table'; one: SeatingTable }
  | { kind: 'row'; one: SeatingRow }
  | { kind: 'seat'; one: SingleSeat };

/** What one step changes of an item: where it stands, a table's or row's turn and a table's size, and the item's version when the step began. */
export type Placement = SeatingArrangement;

export type SaveState = 'saved' | 'saving' | 'retrying' | 'notSaved';

export type Placing = { kind: 'table'; shape: TableShape } | { kind: 'row' } | { kind: 'seat' };

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const ROUND_HANDLES: readonly [Handle, number, number][] = [
  ['nw', -1, -1],
  ['ne', 1, -1],
  ['se', 1, 1],
  ['sw', -1, 1],
];
export const LONG_HANDLES: readonly [Handle, number, number][] = [
  ['nw', -1, -1],
  ['n', 0, -1],
  ['ne', 1, -1],
  ['e', 1, 0],
  ['se', 1, 1],
  ['s', 0, 1],
  ['sw', -1, 1],
  ['w', -1, 0],
];

/** Where targets overlap on a short table, the press goes to the nearest handle, or moves the table (null) when its centre is nearer still. */
export function pressedHandle(
  table: SeatingTable,
  pressed: Handle,
  [x, y]: [number, number],
): Handle | null {
  const round = isRoundShape(table.shape);
  const hw = table.widthCm / 2;
  const hl = (round ? table.widthCm : table.lengthCm) / 2;
  let nearest: Handle | null = null;
  let distance = Math.hypot(x, y);

  for (const [name, sx, sy] of round ? ROUND_HANDLES : LONG_HANDLES) {
    const from = Math.hypot(x - sx * hw, y - sy * hl);

    if (from < distance || (from === distance && name === pressed)) {
      nearest = name;
      distance = from;
    }
  }
  return nearest;
}

export function floorItems(plan: SeatingPlan): FloorItem[] {
  return [
    ...plan.tables.map((one) => ({ kind: 'table' as const, one })),
    ...plan.rows.map((one) => ({ kind: 'row' as const, one })),
    ...plan.singleSeats.map((one) => ({ kind: 'seat' as const, one })),
  ];
}

export function itemName(t: TFunction, item: FloorItem): string {
  return item.kind === 'row' ? t('seating.rowName', { label: item.one.label }) : item.one.name;
}

export function footprintOf(item: FloorItem): Footprint {
  const { xCm, yCm } = item.one;

  if (item.kind === 'table')
    return {
      xCm,
      yCm,
      rotation: item.one.rotation,
      round: isRoundShape(item.one.shape),
      half: tableExtent(item.one),
    };
  if (item.kind === 'row')
    return { xCm, yCm, rotation: item.one.rotation, round: false, half: rowExtent(item.one) };
  return { xCm, yCm, rotation: 0, round: true, half: [CHAIR_RADIUS_CM, CHAIR_RADIUS_CM] };
}

/** The plan as it shows while a step is being dragged or saved: the change stays on screen until it is saved or refused. */
export function withPlacements(
  plan: SeatingPlan,
  placements: Readonly<Record<string, Placement>>,
): SeatingPlan {
  if (Object.keys(placements).length === 0) return plan;
  const placed = <T extends { id: string }>(one: T): T => {
    const at = placements[one.id];

    if (at == null) return one;
    const { kind: _kind, id: _id, ...fields } = at;

    return { ...one, ...fields };
  };

  return {
    ...plan,
    tables: plan.tables.map(placed),
    rows: plan.rows.map(placed),
    singleSeats: plan.singleSeats.map(placed),
  };
}

export function placementOf(item: FloorItem): Placement {
  return {
    kind: item.kind,
    id: item.one.id,
    xCm: item.one.xCm,
    yCm: item.one.yCm,
    version: item.one.version,
  };
}

/** Every item that overlaps another, outlined on the floor. */
export function overlappingIds(plan: SeatingPlan): Set<string> {
  const items = floorItems(plan).map((item) => ({ id: item.one.id, at: footprintOf(item) }));
  const over = new Set<string>();

  items.forEach((a, index) => {
    for (const b of items.slice(index + 1))
      if (overlapping(a.at, b.at)) {
        over.add(a.id);
        over.add(b.id);
      }
  });
  return over;
}
