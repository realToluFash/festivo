/** The event bar's labels at the default text size, as the bar at the foot of Today draws its own (sc-37298). */
export const EVENT_BAR_LABEL = 12;

/** Past 20 a label's line no longer fits under the glyph in the 54 tab (sc-37298). */
export const EVENT_BAR_MOST = 20;

/** The smallest the event bar draws its labels, the size iOS's own tab bar draws them at (sc-71148). */
export const EVENT_BAR_LEAST = 10;

/** The size the event bar's labels start from at a text size of `fontScale`. */
export function eventBarStart(fontScale: number): number {
  return Math.min(EVENT_BAR_LABEL * fontScale, EVENT_BAR_MOST);
}

/** One size for the five labels: their start while the widest word, measured at it, fits a tab `slot` wide, otherwise the largest that fits, never under 10 (sc-71148). */
export function eventBarLabelSize(fontScale: number, widest: number, slot: number): number {
  const start = eventBarStart(fontScale);

  if (widest <= 0 || slot <= 0 || widest <= slot) return start;

  return Math.max(EVENT_BAR_LEAST, Math.min(start, Math.floor((start * slot) / widest)));
}
