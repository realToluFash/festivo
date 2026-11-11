let top: number | null = null;
const listeners = new Set<() => void>();

/** Where the landing toast's top sits in the window while it shows over a step, or null, so a field lifted above the keys lifts above the toast too (sc-37983). */
export function landingToastAt(next: number | null): void {
  if (next === top) return;
  top = next;
  listeners.forEach((listener) => listener());
}

export function landingToastTop(): number | null {
  return top;
}

/** Calls `moved` each time the landing toast's top moves, shows or goes. Returns the unsubscribe. */
export function watchLandingToastTop(moved: () => void): () => void {
  listeners.add(moved);

  return () => listeners.delete(moved);
}
