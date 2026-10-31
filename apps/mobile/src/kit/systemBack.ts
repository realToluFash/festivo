import type { LayoutKind } from '../layout/classify.ts';
import { tokens } from '../theme/tokens.ts';

/** Wherever the page shows in place of its list, Android's Back and iOS's swipe from the left edge are the page's own back (sc-18108, sc-23327). */
export function pageTakesBack(kind: LayoutKind, pageInFront: boolean): boolean {
  return pageInFront && kind !== 'tabletLandscape';
}

/** The `from` a tablet's Settings list gives the section it opens in place of itself. */
export const OPENED_IN_PLACE_OF_SETTINGS = 'settings';

/** Only a section the tablet's list replaced itself with has no Settings under it; any other keeps Back as the stack has it (sc-19104). */
export function sectionTakesBack(from: string | undefined): boolean {
  return from === OPENED_IN_PLACE_OF_SETTINGS;
}

/** The strip at the left edge an iOS swipe back starts in, no wider than the pages' own margin, so it covers no control. */
export const EDGE_SWIPE_WIDTH = 12;

/** A drag from the edge that moves more across than down is iOS's swipe back (sc-23327). */
export function edgeSwipeStarts(dx: number, dy: number): boolean {
  return dx > 8 && dx > Math.abs(dy);
}

/** Let go past half the width, or flicked towards the right, the swipe completes; short of that the page stays. */
export function edgeSwipeCompletes(dx: number, vx: number, width: number): boolean {
  return dx > width / 2 || (vx > 0.5 && dx > 0);
}

/** A page's own back is 44 pt tall on iOS and 48 dp on Android, each platform's floor for a touch target (sc-22819). */
export function pageBackHit(os: string): number {
  return os === 'android' ? 48 : tokens.sizeHit;
}
