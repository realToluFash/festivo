import { capUnderTitle, fitWidest } from './textSize.ts';
import { tokens } from '../theme/tokens.ts';

/** (a) one row, as main; (b) Cancel and the verb on a row, the title under them; (c) Cancel, the title and the verb each on a row. */
export type HeaderForm = 'row' | 'under' | 'stacked';

export const HEADER_TEXT = 17;
export const NAV_LEAST = 52;
export const NAV_SIDE = tokens.spaceSm;
export const NAV_BUTTON_SIDE = tokens.spaceLg;
export const TITLE_ROW_SIDE = tokens.spaceXxl;
export const BACK_GLYPH = 20;
export const PILL_TEXT = 15;
export const PILL_GLYPH = 18;
export const PILL_LEFT = tokens.spaceMd;
export const PILL_RIGHT = tokens.spaceXl;
export const PILL_GAP = tokens.spaceXxs;
export const PILL_ABOVE = tokens.spaceXs;

export function buttonWidth(word: number): number {
  return Math.max(tokens.sizeHit, word + 2 * NAV_BUTTON_SIDE);
}

/** A back label in Cancel's place: 6, the ‹, 2, the word and 12. */
export function backWidth(word: number, scale: number): number {
  return 6 + BACK_GLYPH * scale + tokens.spaceHair + word + NAV_BUTTON_SIDE;
}

export function titleSlot(width: number, left: number, verb: number): number {
  return width - left - verb - 2 * NAV_BUTTON_SIDE;
}

export function linesFor(words: readonly number[], space: number, room: number): number {
  let lines = 1;
  let taken = 0;
  for (const word of words) {
    if (taken === 0) taken = word;
    else if (taken + space + word <= room) taken += space + word;
    else {
      lines += 1;
      taken = word;
    }
  }

  return lines;
}

export interface HeaderMeasures {
  width: number;
  left: number;
  verb: number;
  words: readonly number[];
  space: number;
}

/** (a) holds when the title, every word whole at its full size, takes at most `lines` lines between the sides. */
export function fitsOneRow(
  { width, left, verb, words, space }: HeaderMeasures,
  lines: 1 | 2 = 2,
): boolean {
  const slot = titleSlot(width, left, verb);

  return Math.max(...words) <= slot && linesFor(words, space, slot) <= lines;
}

/** The first form that holds every word whole; `lefts` are Cancel's widths to try in turn, a back label before Back, and only the last may sit beside a two-line title (as main's FocusNav). */
export function headerForm(measures: Omit<HeaderMeasures, 'left'> & { lefts: readonly number[] }): {
  form: HeaderForm;
  at: number;
} {
  const { lefts, ...rest } = measures;
  const last = lefts.length - 1;
  const fits = lefts.findIndex((left, index) =>
    fitsOneRow({ ...rest, left }, index === last ? 2 : 1),
  );
  if (fits >= 0) return { form: 'row', at: fits };
  const across = (lefts[last] ?? 0) + rest.verb;

  return { form: across <= rest.width - 2 * NAV_SIDE ? 'under' : 'stacked', at: last };
}

/** The title on its own row: its full size unless its widest word is wider than the row, never below 17 (sc-13496). */
export function titleOnItsRow(scale: number, widest: number, width: number): number {
  return fitWidest(HEADER_TEXT, HEADER_TEXT * scale, widest, width - 2 * TITLE_ROW_SIDE);
}

export function pillWidth(size: number, word: number, full: number): number {
  return PILL_LEFT + (PILL_GLYPH / PILL_TEXT) * size + PILL_GAP + (word * size) / full + PILL_RIGHT;
}

/** The pill's word at its full size unless the pill would be wider than its room, then the size that fits; never below 15. */
export function pillTextSize(scale: number, word: number, room: number): number {
  const full = PILL_TEXT * scale;
  if (pillWidth(full, word, full) <= room) return full;
  const per = PILL_GLYPH / PILL_TEXT + word / full;

  return Math.max(PILL_TEXT, Math.floor((room - PILL_LEFT - PILL_GAP - PILL_RIGHT) / per));
}

/** How much a back's word grows: with the text, and no further than a title drawn at `titleCap` (sc-28812). */
export function backScale(fontScale: number, titleCap: number | null): number {
  return capUnderTitle(titleCap ?? Infinity, PILL_TEXT, fontScale);
}

/** The least a back's word drawn at `scale` may step down to, to stay whole in its room: never below 15. */
export function backLeast(scale: number): number {
  return Math.min(1, 1 / scale);
}
