import type { LayoutKind } from '../layout/classify.ts';

/** Wherever the page shows in place of its list, Android's Back is the page's own back (sc-18108). */
export function pageTakesBack(kind: LayoutKind, pageInFront: boolean): boolean {
  return pageInFront && kind !== 'tabletLandscape';
}

/** The `from` a tablet's Settings list gives the section it opens in place of itself. */
export const OPENED_IN_PLACE_OF_SETTINGS = 'settings';

/** Only a section the tablet's list replaced itself with has no Settings under it; any other keeps Back as the stack has it (sc-19104). */
export function sectionTakesBack(from: string | undefined): boolean {
  return from === OPENED_IN_PLACE_OF_SETTINGS;
}

/** The iOS edge swipe arrives as a `POP`; a tab, a sign-out, a link or a page's own `router.back()` (‹ Event on a copy) removes the screen some other way. */
export function swipedBack(action: { type: string }): boolean {
  return action.type === 'POP';
}
