import { tokens } from '../theme/tokens.ts';

/** What a chip on the live cover draws beside its words: 12 each side (`TodayRun`'s chip). */
const CHIP_SIDES = 2 * 12;

/** Live now's ring, before the gap to its words. */
const LIVE_RING = 14;

/** What Open the event draws beside its label: 22 each side, the gap and the arrow (`WhiteButton`). */
const OPEN_CHROME = 2 * 22 + tokens.spaceSm + 18;

/** The room for Live now's words: the cover's column less the chip's sides, its ring and the gap after it (sc-92312). */
export function liveChipRoom(column: number): number {
  return Math.max(column - CHIP_SIDES - LIVE_RING - tokens.spaceXs, 0);
}

/** The room for the day's words: the cover's column less the chip's sides. */
export function dayChipRoom(column: number): number {
  return Math.max(column - CHIP_SIDES, 0);
}

/** The room for Open the event's label: the cover's column less the button's sides, the gap and the arrow. */
export function openRoom(column: number): number {
  return Math.max(column - OPEN_CHROME, 0);
}
