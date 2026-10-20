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

export function classifyLayout({ width, height }: WindowSize): LayoutKind {
  // Degenerate sizes happen: a window measured before layout, a hidden frame,
  // a web container with no height yet. Phone is the safe answer — it is the
  // narrowest layout, so it fits anywhere, whereas guessing tablet puts a
  // two-column layout into 320pt.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'phone';
  }

  if (Math.min(width, height) < TABLET_MIN_DIMENSION) {
    return 'phone';
  }

  return width >= height ? 'tabletLandscape' : 'tabletPortrait';
}

export function isTablet(kind: LayoutKind): boolean {
  return kind !== 'phone';
}
