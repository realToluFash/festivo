import { tokens } from '../../theme/tokens.ts';

/** Sign out as the phone's 52 pill draws it on main: the label at 16 beside an 18 glyph, 20 to each side, 8 between, inside a 1.5 ring. */
export const SIGN_OUT_TEXT = 16;
export const SIGN_OUT_GLYPH = 18;
export const SIGN_OUT_SIDE = tokens.spaceXxl;
export const SIGN_OUT_GAP = tokens.spaceSm;
export const SIGN_OUT_RING = 1.5;

/** On a tablet on its side main draws Sign out 44 tall, so its label at the body size, 15. */
export const SIGN_OUT_TEXT_COLUMN = 15;

// Main's Settings: the phone's page is 20 in from each side; upright, two columns 24 apart inside 32 a side (`SettingsListBody`); on its side, the 360 list column with its 1 rule, 16 in on the left and 14 on the right.
const PHONE_SIDE = tokens.spaceXxl;
const UPRIGHT_SIDE = tokens.space5xl;
const UPRIGHT_GAP = tokens.space3xl;
const LIST_COLUMN = 360 - 1 - tokens.spaceXl - 14;

/** The width main gives Sign out: the phone's page, the left of the two upright columns, or the list column on its side. */
export function signOutRoom(
  layout: 'phone' | 'portrait' | 'landscape',
  windowWidth: number,
): number {
  if (layout === 'phone') return windowWidth - 2 * PHONE_SIDE;
  if (layout === 'portrait') return (windowWidth - 2 * UPRIGHT_SIDE - UPRIGHT_GAP) / 2;

  return LIST_COLUMN;
}

/** The label's size: `text × scale` while its widest word fits beside the glyph, which grows with it; else the largest that fits, never under `text`. */
export function signOutTextSize(
  scale: number,
  widest: number,
  room: number,
  text: number = SIGN_OUT_TEXT,
): number {
  const start = text * scale;
  const glyph = SIGN_OUT_GLYPH / text;
  const inside = room - 2 * (SIGN_OUT_SIDE + SIGN_OUT_RING) - SIGN_OUT_GAP;
  if (widest + glyph * start <= inside) return start;

  return Math.max(text, Math.floor(inside / (widest / start + glyph)));
}
