/** A row's texts on main: the title 16, each line under it and the event-and-time line 13.5, Unread and Muted 12.5 (BellParts' BellItem). */
export const ROW_TITLE = 16;
export const ROW_LINE = 13.5;
export const ROW_MARK = 12.5;

/** Main's line heights, as a share of each text's size. */
export const ROW_TITLE_LINE = 1.35;
export const ROW_LINE_LINE = 1.4;
export const ROW_MARK_LINE = 1.22;

/** What sits beside a mark's word: Unread's 8 dot and Muted's 14 glyph, each 6 from it. */
export const UNREAD_BESIDE = 8 + 6;
export const MUTED_BESIDE = 14 + 6;

export type BellRows = 'main' | 'qa' | 'mixed' | 'steps' | 'word40';

export const BELL_ROWS: readonly { key: BellRows; label: string }[] = [
  { key: 'main', label: 'As on main' },
  { key: 'qa', label: 'QA notification 1' },
  { key: 'mixed', label: 'Mixed rows' },
  { key: 'steps', label: 'Title steps down' },
  { key: 'word40', label: 'A 40-letter name' },
];

/** Where a row's text starts: its size grown with the text size, no larger than `cap` (its title, for a text under it), never under its size. */
export function rowTextStart(size: number, scale: number, cap: number): number {
  return Math.max(size, Math.min(size * scale, cap));
}

/** sc-102956: the start while the text's widest word fits `room`; else the largest size at which it fits, never under the text's default size, at every text size. A word wider than `room` even at the default size draws at the default size and breaks at the line's end. */
export function rowTextSize(size: number, start: number, widest: number, room: number): number {
  if (widest <= room) return start;

  return Math.max(size, Math.floor((start * room) / widest));
}

/** A word wider than its line at the text's default size: the only word a row may break. */
export function tooLongForAnyLine(widestAtDefault: number, room: number): boolean {
  return widestAtDefault > room;
}
