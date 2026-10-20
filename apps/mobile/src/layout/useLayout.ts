import { useWindowDimensions } from 'react-native';

import { classifyLayout, type LayoutKind } from './classify.ts';

/**
 * The current layout, recomputed when the window changes.
 *
 * `useWindowDimensions` rather than `Dimensions.get`: the latter is read once
 * and never updates, so a tablet rotated after mount keeps the layout it
 * started in — which looks like a broken screen rather than a stale read.
 *
 * This file imports React Native and is therefore the half of the pair a test
 * cannot reach. The judgement lives in classify.ts, which is where the tests
 * are.
 */
export function useLayout(): { kind: LayoutKind; width: number; height: number } {
  const { width, height } = useWindowDimensions();

  return { kind: classifyLayout({ width, height }), width, height };
}

export { classifyLayout, isTablet, TABLET_MIN_DIMENSION } from './classify.ts';
export type { LayoutKind } from './classify.ts';
