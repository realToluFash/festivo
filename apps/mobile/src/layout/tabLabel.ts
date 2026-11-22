import { fitWidest } from './textSize.ts';

/** The size a label under a glyph in the phone's tab bar draws at by default. */
export const TAB_LABEL = 12;

// Past 20 a label's line no longer fits under the glyph in the 54 tab (sc-37298).
export const TAB_LABEL_MOST = 20;

/** The smallest the event bar draws its labels, the size iOS's own tab bar draws them at (sc-71148). */
export const EVENT_BAR_LEAST = 10;

/** Where a tab label starts at a text size of `fontScale`, before any word is measured. */
export function tabLabelStart(fontScale: number): number {
  return Math.min(TAB_LABEL * fontScale, TAB_LABEL_MOST);
}

/** One size for the event bar's labels: their start while the widest word, measured at it, fits a tab `slot` wide, otherwise the largest that fits, never under 10 (sc-71148). */
export function eventBarLabelSize(fontScale: number, widest: number, slot: number): number {
  const start = tabLabelStart(fontScale);

  if (widest <= 0 || slot <= 0) return start;

  return fitWidest(EVENT_BAR_LEAST, start, widest, slot);
}
