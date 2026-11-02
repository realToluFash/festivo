/** Under a second a person's flow is not broken, and a loading state that flashes up and away is noise. */
export const SKELETON_AFTER_MS = 1000;

export type SkeletonRowHeight = 56 | 60 | 64 | 76;

type Width = `${number}%`;

/** Bar widths from one fixed pattern, so no row reads as a name, a number or a status. */
const BAR_WIDTHS: readonly (readonly [Width, Width])[] = [
  ['62%', '38%'],
  ['48%', '30%'],
  ['70%', '44%'],
  ['55%', '34%'],
];

export function barWidths(row: number): readonly [Width, Width] {
  return BAR_WIDTHS[row % BAR_WIDTHS.length] ?? ['62%', '38%'];
}

/** As many rows as fill the room the layout leaves, never the real count, so the skeleton never scrolls. */
export function fillingRows(room: number, rowHeight: SkeletonRowHeight): number {
  return Math.min(10, Math.max(3, Math.floor(room / rowHeight)));
}
