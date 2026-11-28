/** Main's arrived figure: its numbers at 18, arrived at 12.5, beside a 44 ring (sc-29978). */
export const FIGURE_NUMBERS = 18;
export const FIGURE_LABEL = 12.5;
export const FIGURE_RING = 44;
export const FIGURE_NUMBERS_LINE = 1.2;
export const FIGURE_LABEL_LINE = 1.3;

/** From AX1 the ring is as tall as the two lines beside it, never under main's 44, so it grows with the words and never sits over them. */
export function figureRing(numbers: number, label: number): number {
  return Math.max(
    FIGURE_RING,
    Math.ceil(numbers * FIGURE_NUMBERS_LINE) + Math.ceil(label * FIGURE_LABEL_LINE),
  );
}

/** The ring's stroke grows with its side, never under main's 4 (1:11). */
export function figureStroke(side: number): number {
  return Math.max(4, Math.round(side / 11));
}

/** The figure's words beside its ring, `gap` from it, in a column `column` wide. */
export function figureRoom(column: number, ring: number, gap: number): number {
  return Math.max(column - ring - gap, 0);
}
