import { leaveThen } from './leaveHeld.ts';
import { linkedPath } from './linkedPath.ts';

const open = new Set<() => void>();
let showing: string | null = null;

/** An open sheet lists how it closes, so a screen opened from outside the app can close it (sc-102662). */
export function noteOpenSheet(close: () => void): () => void {
  open.add(close);

  return () => {
    open.delete(close);
  };
}

export function noteShowing(pathname: string): void {
  showing = pathname;
}

function bare(path: string): string {
  return (/^[^?#]*/.exec(linkedPath(path))?.[0] ?? '').replace(/\/+$/, '') || '/';
}

/** A place that is the screen already showing opens nothing. */
export function isShowing(place: string): boolean {
  return showing != null && bare(place) === bare(showing);
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
