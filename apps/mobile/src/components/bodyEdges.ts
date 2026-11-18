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

/** How far the phone's floating tab bar sits in from each side of the page. */
const TAB_BAR_SIDE = 18;

/** The phone's floating tab bar's ends, past a navigation bar or the Dynamic Island on its side as Events' edges are (sc-54891). */
export function tabBarSides(insets: { left: number; right: number }): {
  left: number;
  right: number;
} {
  return pastSides(TAB_BAR_SIDE, insets);
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
