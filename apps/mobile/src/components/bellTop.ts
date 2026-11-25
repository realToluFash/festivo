import { atAccessibilitySizes, fitWidest } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';

/** The tablet panel's heading and Mark all read at the default size. */
export const BELL_HEADING = 18;
export const BELL_MARK_ALL = 15;

/** Between the heading and Mark all read on one row. */
export const BELL_BESIDE_GAP = tokens.spaceSm;

/** Mark all read's 44 tap area under the heading's line, with this between. */
export const BELL_UNDER_GAP = tokens.spaceXxs;

/** Mark all read's size: main's at every size, from AX1 the largest at which its widest word fits the panel's top, never under 15. */
export function markAllSize(scale: number, widest: number, room: number): number {
  const start = BELL_MARK_ALL * scale;

  return atAccessibilitySizes(scale) ? fitWidest(BELL_MARK_ALL, start, widest, room) : start;
}

/** Widths measured at the sizes drawn; zero until measured. */
export interface BellTop {
  room: number;
  heading: number;
  markAll: number;
}

/** Mark all read moves under the heading wherever the heading and Mark all read, each whole on one line, cannot share the row; the heading never steps down to make room (sc-92580, the web's rule from sc-21358). */
export function markAllUnder({ room, heading, markAll }: BellTop): boolean {
  if (room <= 0 || heading <= 0 || markAll <= 0) return false;

  return heading + BELL_BESIDE_GAP + markAll > room;
}
