import { PILL_BESIDE_TABS } from '../kit/frameBand.ts';
import { tokens } from '../theme/tokens.ts';
import { fitWidest } from './textSize.ts';

/** The capsule's label at the default size (`WhiteCapsule`). */
export const CAPSULE_LABEL = 15;

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

/** The widest the centred capsule may be and still stop sc-30410's 12 short of the tile with its ring and of the bell. */
export function capsuleRoom(rowWidth: number): number {
  return rowWidth - 2 * (Math.max(TILE_REACH, tokens.sizeHit) + PILL_BESIDE_TABS.gap);
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

/** The tabs take their room first: while their labels are under their own size the pill is its tile. */
export function pillGivesWay(fontScale: number, labelSize: number): boolean {
  return labelSize < CAPSULE_LABEL * fontScale;
}
