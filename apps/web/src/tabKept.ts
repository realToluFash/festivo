import { ApiUnreachableError } from '@soirely/api-client';
import { keepsWhatLoaded } from '@soirely/domain';
import { useEffect, useSyncExternalStore } from 'react';

export interface Kept<T> {
  value: T;
  at: Date;
}

/** Held in the module's memory: it lasts while the tab is open, a reload forgets it, and nothing reaches the browser's storage. */
let kept = new Map<string, Kept<unknown>>();
let standingIn = false;
let answers = 0;
const listeners = new Set<() => void>();

/** A load Soirely answered. After a page stood on what was kept, the first answer is a reason for the rest of the page to load afresh. */
export function keepLoaded<T>(key: string, value: T, at: Date = new Date()): void {
  kept.set(key, { value, at });
  if (!standingIn) return;

  standingIn = false;
  answers += 1;
  for (const listener of [...listeners]) listener();
}

export function rekeep<T>(key: string, value: T): void {
  const was = kept.get(key);

  if (was != null) kept.set(key, { value, at: was.at });
}

/** What the page shows now is what it stands on if Soirely stops answering: an edit of the host's own included. */
export function useKeptAsShown<T>(key: string, shown: T | null): void {
  useEffect(() => {
    if (shown != null) rekeep(key, shown);
  }, [key, shown]);
}

/** A 5xx on the token refresh is an answer, as the offline watch counts it: only a request with no answer at all is unreached. */
function unreached(error: unknown): boolean {
  return (
    keepsWhatLoaded(error) ||
    error instanceof TypeError ||
    (error instanceof ApiUnreachableError && error.cause != null)
  );
}

/** What this tab kept for a load that never reached Soirely; a load Soirely refused keeps nothing. */
export function keptFor<T>(key: string, error: unknown): Kept<T> | null {
  if (!unreached(error)) return null;

  const found = kept.get(key) as Kept<T> | undefined;
  if (found == null) return null;

  standingIn = true;

  return found;
}

/** An area's own load: answered, it is kept; never reaching Soirely, it is what was kept, if anything was. */
export function keptLoad<T>(key: string, load: Promise<T>): Promise<T> {
  return load.then(
    (value) => {
      keepLoaded(key, value);

      return value;
    },
    (error: unknown) => {
      const found = keptFor<T>(key, error);
      if (found == null) throw error;

      return found.value;
    },
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** Counts the times Soirely answered again after a page stood on what was kept: an area's loads follow it. */
export function useAnsweredAgain(): number {
  return useSyncExternalStore(subscribe, () => answers);
}

export const keptKeys = {
  event: (eventId: string) => `event:${eventId}`,
  guests: (eventId: string) => `guests:${eventId}`,
  headcount: (eventId: string) => `headcount:${eventId}`,
  seating: (eventId: string) => `seating:${eventId}`,
  menu: (eventId: string) => `menu:${eventId}`,
  staff: (eventId: string) => `staff:${eventId}`,
  schedule: (eventId: string) => `schedule:${eventId}`,
  people: (eventId: string) => `people:${eventId}`,
};

/** Signing out or moving to another organisation: nothing one account or organisation loaded is shown under the next. */
export function forgetKept(): void {
  kept = new Map();
  standingIn = false;
}

/** Tests only: a fresh tab. */
export function __forgetTab(): void {
  forgetKept();
  answers = 0;
}
