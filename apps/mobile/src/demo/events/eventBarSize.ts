import { fitWidest } from '../../layout/textSize.ts';
import { TAB_LABEL, TAB_LABEL_MOST } from '../textSize/textSizeRules.ts';

/** The smallest the event bar draws its labels, the size iOS's own tab bar draws them at (sc-71148). */
export const EVENT_BAR_LEAST = 10;

/** The size the event bar's labels start from at a text size of `fontScale`, where Today's bar starts. */
export function eventBarStart(fontScale: number): number {
  return Math.min(TAB_LABEL * fontScale, TAB_LABEL_MOST);
}

/** One size for the five labels: their start while the widest word, measured at it, fits a tab `slot` wide, otherwise the largest that fits, never under 10 (sc-71148). */
export function eventBarLabelSize(fontScale: number, widest: number, slot: number): number {
  const start = eventBarStart(fontScale);

  if (widest <= 0 || slot <= 0) return start;

  return fitWidest(EVENT_BAR_LEAST, start, widest, slot);
}
