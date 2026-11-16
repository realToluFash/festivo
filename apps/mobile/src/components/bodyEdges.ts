import { type LayoutKind } from '../layout/useLayout.ts';

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
  return { left: TAB_BAR_SIDE + insets.left, right: TAB_BAR_SIDE + insets.right };
}
