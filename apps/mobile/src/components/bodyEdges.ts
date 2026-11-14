import { type LayoutKind } from '../layout/useLayout.ts';

/** The edges a signed-in screen's own `Screen` insets: the frame's header, rail and tab bar take the rest. */
export function bodyEdges(kind: LayoutKind): readonly ('top' | 'bottom' | 'left' | 'right')[] {
  if (kind === 'phone') return ['left', 'right'];

  return kind === 'tabletPortrait' ? ['left', 'right', 'bottom'] : ['right', 'bottom'];
}
