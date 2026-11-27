import { type SeatingPlan } from '@soirely/api-client';
import { type FloorBox, isRoundShape, rowExtent, tableExtent } from '@soirely/domain';
import { type TFunction } from 'i18next';

import { CHAIRS_FROM_SCALE } from './seatingDraw.ts';
import { freeAt } from './seatingGuests.ts';
import { type FloorItem } from './seatingItems.ts';
import { boxOf, inReadingOrder } from './seatingSelection.ts';

export interface FreeTagAt {
  id: string;
  x: number;
  y: number;
  n: number;
}

const TAG_HALF_HEIGHT = 11;
const TAG_GAP = 26;
const LINE = 24;
const RING_PAD = 6;

/** One guess at 12 to 13 px words, so the label and the free tag grow with every locale. */
export function wordsWide(words: string): number {
  return words.length * 7;
}

export function freeTagWords(t: TFunction, n: number): string {
  return n === 0 ? t('seating.full') : t('seating.freeTag', { count: n });
}

export function crosses(a: FloorBox, b: FloorBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

type Tagged = Exclude<FloorItem, { kind: 'seat' }>;

/** Below 50%, where a table's or row's name and its "{taken} of {seats}" go, under it. */
export function outNameY(item: Tagged, s: number, oy: number): number {
  const cy = oy + item.one.yCm * s;

  if (item.kind === 'row') return cy + Math.max(rowExtent(item.one)[1], 40) * s + 12;
  return isRoundShape(item.one.shape)
    ? cy + Math.max(tableExtent(item.one)[1], 40) * s * 0.55 + 12
    : cy + (item.one.lengthCm / 2) * s + 12;
}

/** An item's outline on screen with its chairs, turned with it, plus the 6 px of its free ring. */
function ringOf(item: FloorItem, s: number, ox: number, oy: number): FloorBox {
  const box = boxOf(item);

  return {
    x0: ox + box.x0 * s - RING_PAD,
    y0: oy + box.y0 * s - RING_PAD,
    x1: ox + box.x1 * s + RING_PAD,
    y1: oy + box.y1 * s + RING_PAD,
  };
}

/** Where each table's and row's "{n} free" or Full goes while a guest is picked, drawn after every item (sc-5030): from 50% under its item, or over it when only the space under it is taken; below 50% under its name, a line lower for each tag it would cross, in reading order. */
export function freeTags(
  plan: SeatingPlan,
  items: readonly FloorItem[],
  s: number,
  ox: number,
  oy: number,
  wordsOf: (n: number) => string,
): FreeTagAt[] {
  const ordered = inReadingOrder(items);
  const tagged = ordered.filter((item): item is Tagged => item.kind !== 'seat');
  const tagBox = (x: number, y: number, n: number): FloorBox => {
    const half = (wordsWide(wordsOf(n)) + 16) / 2;

    return { x0: x - half, y0: y - TAG_HALF_HEIGHT, x1: x + half, y1: y + TAG_HALF_HEIGHT };
  };

  if (s < CHAIRS_FROM_SCALE) {
    const placed: FloorBox[] = [];

    return tagged.map((item) => {
      const n = freeAt(plan, item.one);
      const x = ox + item.one.xCm * s;
      let y = outNameY(item, s, oy) + 20;

      while (placed.some((one) => crosses(tagBox(x, y, n), one))) y += LINE;
      placed.push(tagBox(x, y, n));
      return { id: item.one.id, x, y, n };
    });
  }

  const rings = ordered.map((item) => ({ id: item.one.id, box: ringOf(item, s, ox, oy) }));

  return tagged.map((item) => {
    const n = freeAt(plan, item.one);
    const own = ringOf(item, s, ox, oy);
    const x = (own.x0 + own.x1) / 2;
    const taken = (y: number) =>
      rings.some((other) => other.id !== item.one.id && crosses(tagBox(x, y, n), other.box));
    const under = own.y1 + TAG_GAP;
    const over = own.y0 - TAG_GAP;

    return { id: item.one.id, x, y: taken(under) && !taken(over) ? over : under, n };
  });
}

const TIP_INSET = 8;

/** Where a chair's label sits: above the chair, or under it where above would sit under the bar over the room or past the room's top, and slid inside the room's left and right edges (sc-5030). */
export function chairTipBox(
  tip: { x: number; y: number; r: number },
  width: number,
  roomWidth: number,
  cover: FloorBox | null,
): { left: number; top: number } {
  const left = Math.max(TIP_INSET, Math.min(tip.x - width / 2, roomWidth - TIP_INSET - width));
  const over = tip.y - tip.r - 40;
  const hidden =
    over < 0 ||
    (cover != null && crosses({ x0: left, y0: over, x1: left + width, y1: over + 28 }, cover));

  return { left, top: hidden ? tip.y + tip.r + 12 : over };
}
