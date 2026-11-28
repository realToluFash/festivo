import { atAccessibilitySizes, fitWidest } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';

/** The tablet panel's heading and Mark all read at the default size. */
export const BELL_HEADING = 18;
export const BELL_MARK_ALL = 15;

/** The phone screen's title on main: 30 bold, lines at 1.12, tracked -0.02 of its size, so the tracking grows with it (sc-92959). */
export const PHONE_TITLE = 30;
export const PHONE_TITLE_LINE = 1.12;
export const PHONE_TITLE_TRACKING = -0.02;

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

/** The empty sentence on main: 15, beside a 40 bell tile with 12 between (sc-94028). */
export const EMPTY_SENTENCE = 15;
export const EMPTY_TILE = 40;
export const EMPTY_GAP = tokens.spaceLg;

/** Notification settings at the panel's foot: 15 semibold. */
export const SETTINGS_LINK = 15;

/** Below AX1 main's size; from AX1 the text size's, no cap. */
export function bellStart(size: number, scale: number): number {
  return size * scale;
}

/** From AX1 the tile moves onto its own line above the sentence where the sentence's widest word, at its grown size, cannot fit beside it; below AX1 never. */
export function emptyTileAbove(scale: number, widest: number, room: number): boolean {
  return atAccessibilitySizes(scale) && widest > room - EMPTY_TILE - EMPTY_GAP;
}

/** Main's size below AX1; from AX1 the largest at which the widest word fits the sentence's line, never under 15, no cap. */
export function emptySentenceSize(scale: number, widest: number, room: number): number {
  const line = emptyTileAbove(scale, widest, room) ? room : room - EMPTY_TILE - EMPTY_GAP;
  const start = bellStart(EMPTY_SENTENCE, scale);

  return atAccessibilitySizes(scale)
    ? fitWidest(EMPTY_SENTENCE, start, widest, Math.max(line, 1))
    : start;
}

/** The sentence's rule for Notification settings, whose line is the body's. */
export function settingsSize(scale: number, widest: number, room: number): number {
  const start = bellStart(SETTINGS_LINK, scale);

  return atAccessibilitySizes(scale)
    ? fitWidest(SETTINGS_LINK, start, widest, Math.max(room, 1))
    : start;
}
