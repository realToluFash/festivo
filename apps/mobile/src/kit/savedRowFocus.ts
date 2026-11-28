/** A toast a page shows: its words, and the id that tells it from an earlier toast with the same words. */
export interface ShownToast<Over> {
  words: string;
  id?: string | undefined;
  /** The close by Save the toast says. */
  over?: Over | undefined;
}

/** Where a toast's box was last laid out: its top in the window, for the toast it was laid out for. */
export interface LaidOutToast {
  words: string;
  id?: string | undefined;
  top: number;
}

/** The toast as the page reads it: its top while its words show, and the Save it says only once its own box has been laid out, so a second Save with the same words counts from its own toast's layout and not from the first one's (sc-86228). */
export function toastOverPage<Over>(
  toast: ShownToast<Over> | null,
  at: LaidOutToast | null,
): { top: number; over: Over | null } | null {
  if (toast == null || at == null || at.words !== toast.words) return null;

  return { top: at.top, over: at.id === toast.id ? (toast.over ?? null) : null };
}

export interface SavedRowFocus {
  /** The toast this close shows has been laid out, mounted as the edit's window goes. */
  toastLaidOut(): void;
  /** The page has come to rest with the row in sight. */
  rested(): void;
  stop(): void;
}

/** When focus goes back to the row a Save closed onto: once the edit has gone, `settledMs` after its toast was laid out, and the page has come to rest. At `latestMs` it goes however those went, the row first brought into sight by `bringIntoSight`, so focus always comes back (sc-48600, sc-86228). */
export function savedRowFocus({
  settledMs,
  latestMs,
  move,
  bringIntoSight,
}: {
  settledMs: number;
  latestMs: number;
  move: () => void;
  bringIntoSight: (rested: () => void) => void;
}): SavedRowFocus {
  let settled = false;
  let rested = false;
  let done = false;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    done = true;
    clearTimeout(late);
    clearTimeout(settle);
  };
  const ready = () => {
    if (done || !settled || !rested) return;
    stop();
    move();
  };
  const restedNow = () => {
    rested = true;
    ready();
  };
  const late = setTimeout(() => {
    if (done) return;
    settled = true;
    if (rested) return ready();
    bringIntoSight(restedNow);
  }, latestMs);

  return {
    toastLaidOut: () => {
      if (done || settle != null) return;
      settle = setTimeout(() => {
        settled = true;
        ready();
      }, settledMs);
    },
    rested: restedNow,
    stop,
  };
}
