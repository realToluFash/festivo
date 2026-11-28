import { whereNow } from './where.ts';
import { leaveThen } from './leaveHeld.ts';
import { linkedPath } from './linkedPath.ts';

const open = new Set<() => void>();

/** An open sheet lists how it closes, so a screen opened from outside the app can close it (sc-102662). */
export function noteOpenSheet(close: () => void): () => void {
  open.add(close);

  return () => {
    open.delete(close);
  };
}

function bare(path: string): string {
  return (/^[^?#]*/.exec(linkedPath(path))?.[0] ?? '').replace(/\/+$/, '') || '/';
}

/** A place that is the screen already showing opens nothing; one carrying a query or a fragment still opens, as it asks the screen for something (an area, a filter). */
export function isShowing(place: string): boolean {
  if (/[?#]/u.test(linkedPath(place))) return false;

  return bare(place) === bare(whereNow() ?? '/');
}

/** The screen a push or link opens wins: a form holding a change asks first, every other open sheet closes without asking. */
export function openFromOutside(
  place: string,
  go: (discarding: boolean) => void,
  stay?: () => void,
): void {
  if (isShowing(place)) {
    stay?.();
    return;
  }
  leaveThen((discarding) => {
    if (!discarding) [...open].forEach((close) => close());
    go(discarding);
  }, stay);
}
