import { useSyncExternalStore } from 'react';

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

/** The focused field a lift keeps in sight: the scroll's top in the window, which the lift keeps it 12pt under, and its height. */
export interface FieldInSight {
  top: number;
  height: number;
}

let field: FieldInSight | null = null;
const fieldListeners = new Set<() => void>();

/** Says what the lift keeps in sight, so the landing toast steps aside where it and the field do not both fit above the keys (sc-37983). */
export function fieldUnderToast(next: FieldInSight | null): void {
  if (next?.top === field?.top && next?.height === field?.height) return;
  field = next;
  fieldListeners.forEach((listener) => listener());
}

export function useFieldUnderToast(): FieldInSight | null {
  return useSyncExternalStore(
    (listener) => {
      fieldListeners.add(listener);

      return () => fieldListeners.delete(listener);
    },
    () => field,
  );
}
