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
