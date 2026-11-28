import { LABEL_LINE, atAccessibilitySizes, fitWidest } from './textSize.ts';
import { tokens } from '../theme/tokens.ts';

/** The band's live line at the default size. */
export const LIVE_LINE = 13.5;
/** Where the band draws the tab capsule below the top of its row. */
export const CAPSULE_TOP = 7;
export const LIVE_GAP = tokens.spaceMd;
export const LIVE_FOOT = tokens.spaceLg;
export const LIVE_SIDES = tokens.spaceXl;
export const LIVE_DOT = tokens.spaceSm;
export const LIVE_DOT_GAP = tokens.spaceXs;

/** The width the line's words have: the band less its sides, the dot and the dot's gap. */
export function liveRoom(bandWidth: number): number {
  return Math.max(0, bandWidth - 2 * LIVE_SIDES - LIVE_DOT - LIVE_DOT_GAP);
}

export function liveLineHeight(size: number): number {
  return Math.ceil(size * LABEL_LINE);
}

/** The live line's size: main's at the standard sizes; from AX1, where it wraps between words, stepped down only as far as its widest word needs, never under 13.5 (sc-92315). */
export function liveLine(scale: number, widestAtStart: number, room: number): number {
  const start = LIVE_LINE * scale;

  if (!atAccessibilitySizes(scale)) return start;

  return fitWidest(LIVE_LINE, start, widestAtStart, room);
}
