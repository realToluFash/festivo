import { atAccessibilitySizes, besideGlyph, labelStart } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

export type HeaderLanguage = 'en' | 'es';
export type HeaderRefreshing = 'off' | 'on';

export const HEADER_LANGUAGES: readonly { key: HeaderLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Spanish' },
];

export const HEADER_REFRESHING: readonly { key: HeaderRefreshing; label: string }[] = [
  { key: 'off', label: 'Without Refreshing…' },
  { key: 'on', label: 'With Refreshing…' },
];

/** Subscribe as main's 44 pill draws it on an iPad: the label at 15 beside an 18 glyph, 22 to each side, 8 between, inside a 1.5 ring. */
export const SUBSCRIBE_TEXT = 15;
export const SUBSCRIBE_GLYPH = 18;
export const SUBSCRIBE_SIDE = 22;
export const SUBSCRIBE_GAP = tokens.spaceSm;
export const SUBSCRIBE_RING = 1.5;

/** From AX1 Subscribe leaves the title's row for its own row under it; at the standard sizes it ends the title's row, as on main. */
export function subscribeUnder(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

/** Where a word under the title starts: from AX1 no larger than the title draws (sc-67338); at the standard sizes main's, the text size's own. */
export function underStart(size: number, scale: number, title: number): number {
  return subscribeUnder(scale) ? labelStart(size, scale, title) : size * scale;
}

/** The label's size in a pill `room` wide: its start while its widest word fits beside the glyph, which grows with it; else the largest that fits, never under 15. */
export function subscribeSize(scale: number, title: number, widest: number, room: number): number {
  const start = underStart(SUBSCRIBE_TEXT, scale, title);
  const inside = room - 2 * (SUBSCRIBE_SIDE + SUBSCRIBE_RING) - SUBSCRIBE_GAP;

  return besideGlyph(SUBSCRIBE_TEXT, start, widest, SUBSCRIBE_GLYPH / SUBSCRIBE_TEXT, inside);
}
