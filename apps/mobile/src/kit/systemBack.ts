import type { LayoutKind } from '../layout/classify.ts';

/** Wherever the page shows in place of its list, Android's Back is the page's own back (sc-18108). */
export function pageTakesBack(kind: LayoutKind, pageInFront: boolean): boolean {
  return pageInFront && kind !== 'tabletLandscape';
}
