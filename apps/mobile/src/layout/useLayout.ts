import { useWindowDimensions } from 'react-native';

import { classifyLayout, type LayoutKind } from './classify.ts';
import { atAccessibilitySizes, nameLines, railWidth, sideListWidth } from './textSize.ts';

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

/** Whether the system text size is one of the accessibility sizes, where the frame changes its form (sc-13496). */
export function useAccessibilitySizes(): boolean {
  return atAccessibilitySizes(useWindowDimensions().fontScale);
}

export function useNameLines(): 1 | 2 {
  return nameLines(useWindowDimensions().fontScale);
}

/** A list beside a page on a tablet, widened at the accessibility sizes. */
export function useSideListWidth(width: number): number {
  const { width: window, height, fontScale } = useWindowDimensions();
  const landscape = classifyLayout({ width: window, height }) === 'tabletLandscape';

  return sideListWidth(width, window - (landscape ? railWidth(fontScale) : 0), fontScale);
}

export {
  classifyLayout,
  isTablet,
  listAndPageKind,
  SETTINGS_LIST_WIDTH,
  TABLET_MIN_DIMENSION,
} from './classify.ts';
export type { LayoutKind, SectionBeside } from './classify.ts';
