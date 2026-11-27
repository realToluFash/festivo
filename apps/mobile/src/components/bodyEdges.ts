import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';

/** The edges a signed-in screen's own `Screen` insets: the frame's header, rail, tab bar and, on its side, card take the rest. */
export function bodyEdges(kind: LayoutKind): readonly ('top' | 'bottom' | 'left' | 'right')[] {
  if (kind === 'phone') return ['left', 'right'];

  return kind === 'tabletPortrait' ? ['left', 'right', 'bottom'] : ['right'];
}

/** The side padding that insets the same edges, for a body that is not a `Screen`. */
export function sideInsets(
  kind: LayoutKind,
  insets: { left: number; right: number },
): { paddingLeft: number; paddingRight: number } {
  const edges = bodyEdges(kind);

  return {
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
}

export interface TabBarGeometry {
  side: number;
  padSides: number;
  padEnds: number;
  gap: number;
}

/** Android sets no phone narrower than 320dp (CDD §7.1.1.1), so under 360 the phone's tab bar makes room for its words (sc-99214). */
export const TAB_BAR_NARROW_BELOW = 360;

const TAB_BAR: TabBarGeometry = { side: 18, padSides: 5, padEnds: 5, gap: tokens.spaceHair };
const NARROW_TAB_BAR: TabBarGeometry = { side: 8, padSides: 3, padEnds: 5, gap: 0 };

/** The threshold is the window's width, never the language, so the bar's edges never move between languages or between Today and an event (sc-99214). */
export function tabBarGeometry(windowWidth: number): TabBarGeometry {
  return windowWidth < TAB_BAR_NARROW_BELOW ? NARROW_TAB_BAR : TAB_BAR;
}

/** The phone's floating tab bar on a window `windowWidth` wide, its ends past a navigation bar or the Dynamic Island on its side as Events' edges are (sc-54891). */
export function tabBarFit(windowWidth: number, insets: { left: number; right: number }) {
  const { side, padSides, padEnds, gap } = tabBarGeometry(windowWidth);

  return {
    ...pastSides(side, insets),
    paddingHorizontal: padSides,
    paddingVertical: padEnds,
    gap,
  };
}

/** How far Today's top row on a phone sits in from each side while no bar takes one. */
const COVER_ROW_SIDE = tokens.spaceXl;

/** How far Events' header sits in from each side of a phone. */
const HEADER_SIDE = tokens.spaceXxl;

/** Today's top row on a phone: its cover's own edge while nothing takes a side, and Events' edge past a navigation bar or the Dynamic Island once one does (sc-62018). */
export function coverRowSides(insets: { left: number; right: number }): {
  paddingLeft: number;
  paddingRight: number;
} {
  return sidePadding(insets.left > 0 || insets.right > 0 ? HEADER_SIDE : COVER_ROW_SIDE, insets);
}

/** A phone's `side` padding, moved in past a navigation bar or the Dynamic Island on its side (sc-62018). */
export function sidePadding(
  side: number,
  insets: { left: number; right: number },
): { paddingLeft: number; paddingRight: number } {
  return { paddingLeft: side + insets.left, paddingRight: side + insets.right };
}

/** A phone's `side` inset for an absolute view, moved in past a navigation bar or the Dynamic Island on its side (sc-62018). */
export function pastSides(
  side: number,
  insets: { left: number; right: number },
): { left: number; right: number } {
  return { left: side + insets.left, right: side + insets.right };
}
