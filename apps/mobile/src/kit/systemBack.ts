import type { LayoutKind } from '../layout/classify.ts';

/** Wherever the page shows in place of its list, Android's Back is the page's own back (sc-18108). */
export function pageTakesBack(kind: LayoutKind, pageInFront: boolean): boolean {
  return pageInFront && kind !== 'tabletLandscape';
}

const EVENTS_LIST = 'events/index';

/**
 * Back from the Events list a link opened: the screens to close, the Events list behind it among them, so the list never shows twice in a row; Home when nothing else is behind.
 */
export function backFromLinkedList(below: readonly string[]): { close: number } | 'home' {
  let close = 1;
  while (below.at(-close) === EVENTS_LIST) close += 1;

  return close > below.length ? 'home' : { close };
}
