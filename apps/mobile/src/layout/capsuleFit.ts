import { PILL_BESIDE_TABS } from '../kit/frameBand.ts';
import { tokens } from '../theme/tokens.ts';
import { fitWidest } from './textSize.ts';

/** The capsule's label at the default size (`WhiteCapsule`). */
export const CAPSULE_LABEL = 15;

/** The capsule's height at the default size; a taller label makes it taller (`WhiteCapsule`). */
export const CAPSULE_HEIGHT = 46;

/** How much taller than its default a capsule of `height` is, which its row grows by so nothing clips it (sc-37693). */
export function capsuleGrowth(height: number): number {
  return Math.max(0, height - CAPSULE_HEIGHT);
}

/** Everything in a capsule of `tabs` tabs but its words: its padding, the gaps between tabs, and each tab's sides, glyph and gap (`WhiteCapsule`). */
export function capsuleChrome(tabs: number): number {
  return (
    2 * tokens.spaceXxs +
    Math.max(0, tabs - 1) * tokens.spaceHair +
    tabs * (13 + 18 + tokens.spaceSm + tokens.spaceXl)
  );
}

/** The tile reaches 2 past its 44 where the invitation's ring sits on its corner. */
const TILE_REACH = 46;

/** The widest the centred capsule may be and still stop sc-30410's 12 short of the tile with its ring and of the row's end, `end` wide where Search stands before the bell (sc-91290). */
export function capsuleRoom(rowWidth: number, end = 0): number {
  return rowWidth - 2 * (Math.max(TILE_REACH, tokens.sizeHit, end) + PILL_BESIDE_TABS.gap);
}

/** One size for the labels, `labels` wide together at the text size's own: that size where the capsule fits at it, otherwise the largest that fits, never under the default (sc-40401, as sc-37298). */
export function capsuleLabelSize(
  fontScale: number,
  tabs: number,
  labels: number,
  room: number,
): number {
  const own = CAPSULE_LABEL * fontScale;

  if (labels <= 0 || room <= 0) return own;

  return fitWidest(Math.min(CAPSULE_LABEL, own), own, labels, room - capsuleChrome(tabs));
}

/** The labels' one size once each label, the row and its end have been laid out, and nothing before: a capsule drawn ahead of them is drawn at its own size and sets the band's height from it (sc-91290). */
export function fittedLabelSize(
  fontScale: number,
  labels: readonly (number | undefined)[],
  rowWidth: number,
  end: number | undefined,
): number | undefined {
  if (labels.length === 0 || rowWidth <= 0 || end == null) return undefined;
  if (labels.some((width) => width == null)) return undefined;

  const total = labels.reduce<number>((sum, width) => sum + (width ?? 0), 0);

  return capsuleLabelSize(fontScale, labels.length, total, capsuleRoom(rowWidth, end));
}

/** The tabs take their room first: while their labels are under their own size the pill is its tile. */
export function pillGivesWay(fontScale: number, labelSize: number): boolean {
  return labelSize < CAPSULE_LABEL * fontScale;
}
