import { wherePlaceNow } from './where.ts';
import { leaveThen } from './leaveHeld.ts';
import { linkedPath } from './linkedPath.ts';

type Entry = { close: () => void; held: () => boolean };

const open = new Set<Entry>();
let waiting: { entries: Entry[]; proceed: () => void; stay: (() => void) | undefined } | null =
  null;

/** The wait ends once no sheet it waited for is still held: every one gone is a success, one still open is an answer that stays. */
function settle(): void {
  const wait = waiting;
  if (wait == null || wait.entries.some((entry) => open.has(entry) && entry.held())) return;

  waiting = null;
  if (wait.entries.every((entry) => !open.has(entry))) wait.proceed();
  else wait.stay?.();
}

/** An open sheet lists how it closes and whether it is held, so a screen opened from outside the app can close it (sc-102662). */
export function noteOpenSheet(close: () => void, held: () => boolean = () => false): () => void {
  const entry = { close, held };
  open.add(entry);

  return () => {
    open.delete(entry);
    settle();
  };
}

/** A sheet whose request has been answered tells a push or link that waited for it. */
export function noteSheetSettled(): void {
  settle();
}

function split(place: string): { path: string; query: string } {
  const [path = '', query = ''] = linkedPath(place).replace(/#.*$/u, '').split('?');
  const pairs = [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();

  return { path: path.replace(/\/+$/, '') || '/', query: pairs.join('&') };
}

/** The place already showing, query included: the same screen asked for something else is another place. */
export function isShowing(place: string): boolean {
  const there = split(place);
  const here = split(wherePlaceNow() ?? '/');

  return there.path === here.path && there.query === here.query;
}

/** The screen a push or link opens wins: a form holding a change asks first, every other open sheet closes without asking, and a sheet whose request is running answers first. */
export function openFromOutside(
  place: string,
  go: (discarding: boolean) => void,
  stay?: () => void,
): void {
  if (isShowing(place) || waiting != null) {
    stay?.();
    return;
  }
  const proceed = () =>
    leaveThen((discarding) => {
      if (!discarding) [...open].forEach((entry) => entry.close());
      go(discarding);
    }, stay);
  const entries = [...open].filter((entry) => entry.held());
  if (entries.length === 0) {
    proceed();
    return;
  }
  waiting = { entries, proceed, stay };
}
