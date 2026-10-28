import { useWindowDimensions } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { classifyLayout, type LayoutKind, type ScreenWindow } from './classify.ts';
import { atAccessibilitySizes, nameLines, railWidth, sideListWidth } from './textSize.ts';

/**
 * The current layout, recomputed when the window changes.
 *
 * `kind` is from the whole frame; `width` and `height` are the window without Android's navigation bar,
 * which `SHORT_ANDROID_HEIGHT` was tuned on. Never pass them to `classifyLayout` (sc-12241).
 *
 * This file imports React Native and is therefore the half of the pair a test
 * cannot reach. The judgement lives in classify.ts, which is where the tests
 * are.
 */
export function useLayout(): { kind: LayoutKind; width: number; height: number } {
  const { width, height } = useWindowDimensions();

  return { kind: classifyLayout(useWindowFrame()), width, height };
}

/** The app's whole frame, bars included: Android's window leaves out the navigation bar (sc-12241). */
export function useWindowFrame(): ScreenWindow {
  const { width, height } = useSafeAreaFrame();
  const { fontScale } = useWindowDimensions();

  return { width, height, fontScale };
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
  const { width: window, height, fontScale } = useWindowFrame();
  const landscape = classifyLayout({ width: window, height }) === 'tabletLandscape';

  return sideListWidth(width, window - (landscape ? railWidth(fontScale) : 0), fontScale);
}

export {
  classifyLayout,
  isTablet,
  listAndPageKind,
  SETTINGS_LIST_WIDTH,
  settingsListGivesWay,
  TABLET_MIN_DIMENSION,
} from './classify.ts';
export type { LayoutKind, SectionBeside } from './classify.ts';
