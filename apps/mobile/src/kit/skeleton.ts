/** Under a second a person's flow is not broken, and a loading state that flashes up and away is noise. */
export const SKELETON_AFTER_MS = 1000;

/** Opacity only, ending where it started, three times: 4.2 s, inside WCAG 2.2.2's five seconds. */
export const SKELETON_PULSE = { dimmed: 0.55, ms: 1400, times: 3 } as const;

export type SkeletonRowHeight = 56 | 64 | 76;

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
