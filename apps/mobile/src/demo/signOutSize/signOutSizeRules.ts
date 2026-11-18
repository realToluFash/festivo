import { tokens } from '../../theme/tokens.ts';

/** Sign out as the phone's 52 pill draws it on main: the label at 16 beside an 18 glyph, 20 to each side, 8 between, inside a 1.5 ring. */
export const SIGN_OUT_TEXT = 16;
export const SIGN_OUT_GLYPH = 18;
export const SIGN_OUT_SIDE = tokens.spaceXxl;
export const SIGN_OUT_GAP = tokens.spaceSm;
export const SIGN_OUT_RING = 1.5;

/** The label's size: `16 × scale` while its widest word fits beside the glyph, which grows with it; else the largest that fits, never under 16. */
export function signOutTextSize(scale: number, widest: number, room: number): number {
  const start = SIGN_OUT_TEXT * scale;
  const glyph = SIGN_OUT_GLYPH / SIGN_OUT_TEXT;
  const inside = room - 2 * (SIGN_OUT_SIDE + SIGN_OUT_RING) - SIGN_OUT_GAP;
  if (widest + glyph * start <= inside) return start;

  return Math.max(SIGN_OUT_TEXT, Math.floor(inside / (widest / start + glyph)));
}
