import { railWidth, sideListWidth } from './textSize.ts';

/**
 * Which of the three layouts a window is.
 *
 * Pure, and in its own file away from the hook, for two reasons. It is the
 * judgement — so it is the part worth testing, and a test must be able to reach
 * it without React Native loaded. And every screen in this product branches on
 * it, so getting it wrong is wrong everywhere at once.
 *
 * Decided by the SMALLER dimension and the orientation, never by width alone.
 * Width alone is the mistake that makes a phone in landscape report as a
 * tablet: a 932pt-wide iPhone is wider than a 834pt-wide iPad in portrait, and
 * the two want completely different layouts. The smaller dimension is what
 * actually distinguishes the devices, because it does not change when the
 * device is turned.
 */
export type LayoutKind = 'phone' | 'tabletPortrait' | 'tabletLandscape';

export interface WindowSize {
  width: number;
  height: number;
}

/**
 * The smaller dimension at which a device is a tablet.
 *
 * 600 rather than 768: a 7-inch Android tablet is around 600pt on its short
 * edge and wants the tablet layout, while the largest phones stop around 440pt.
 * There is a real gap between those, which is why a threshold works at all.
 */
export const TABLET_MIN_DIMENSION = 600;

// Width only ever steps a window down: the Settings list (320), a section's widest margins (64) and a page.
export const UPRIGHT_MIN_WIDTH = 744;

export const SIDE_MIN_WIDTH = 964;

export function classifyLayout({ width, height }: WindowSize): LayoutKind {
  // Degenerate sizes happen: a window measured before layout, a hidden frame,
  // a web container with no height yet. Phone is the safe answer — it is the
  // narrowest layout, so it fits anywhere, whereas guessing tablet puts a
  // two-column layout into 320pt.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'phone';
  }

  if (Math.min(width, height) < TABLET_MIN_DIMENSION || width < UPRIGHT_MIN_WIDTH) {
    return 'phone';
  }

  return width < height || width < SIDE_MIN_WIDTH ? 'tabletPortrait' : 'tabletLandscape';
}

export function isTablet(kind: LayoutKind): boolean {
  return kind !== 'phone';
}

/** The room a page keeps beside its list: about what the phone frame gives one. */
export const PAGE_BESIDE_MIN_WIDTH = 360;

export const SETTINGS_LIST_WIDTH = 320;

export interface ScreenWindow extends WindowSize {
  fontScale: number;
}

/** What sits beside a section on a tablet, after the rail. */
export type SectionBeside = 'nothing' | 'settingsList';

export function sectionWidth(window: ScreenWindow, beside: SectionBeside): number {
  const kind = classifyLayout(window);
  const content = window.width - (kind === 'tabletLandscape' ? railWidth(window.fontScale) : 0);
  const columns =
    beside === 'settingsList' && kind !== 'phone'
      ? sideListWidth(SETTINGS_LIST_WIDTH, content, window.fontScale)
      : 0;

  return content - columns;
}

export interface ListBeside {
  margins: number;
  list: number;
  between: number;
}

export function listFitsBeside(section: number, { margins, list, between }: ListBeside): boolean {
  return section - margins - list - between >= PAGE_BESIDE_MIN_WIDTH;
}

/** On its side, a list sits beside its page only where the page keeps its room; elsewhere, one at a time. */
export function listAndPageKind(
  window: ScreenWindow,
  beside: SectionBeside,
  { margins, list, between }: ListBeside,
): LayoutKind {
  const kind = classifyLayout(window);
  if (kind !== 'tabletLandscape') return kind;

  const content = window.width - railWidth(window.fontScale);
  const fits = listFitsBeside(sectionWidth(window, beside), {
    margins,
    list: sideListWidth(list, content, window.fontScale),
    between,
  });

  return fits ? 'tabletLandscape' : 'tabletPortrait';
}
