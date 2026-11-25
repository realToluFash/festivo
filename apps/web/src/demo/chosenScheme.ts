import { useSyncExternalStore } from 'react';

import { config } from '../config.ts';
import { OWN_SCHEME, type SchemeKey } from './personalisation.ts';

let chosen: SchemeKey | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** The person's colours in this visit, or null while they have never chosen: kept in memory only, never stored. */
export function useChosenScheme(): SchemeKey | null {
  return useSyncExternalStore(subscribe, () => chosen);
}

export function chosenScheme(): SchemeKey | null {
  return chosen;
}

/** Every page takes the scheme at once, Violet while the person has never chosen. */
export function choose(key: SchemeKey | null): void {
  document.documentElement.dataset.scheme = key ?? OWN_SCHEME;
  tell(key);
}

/** Leaving the demo forgets the pick and puts the build's own scheme back. */
export function leave(): void {
  document.documentElement.dataset.scheme = config().scheme;
  tell(null);
}

function tell(key: SchemeKey | null): void {
  if (key === chosen) return;
  chosen = key;
  listeners.forEach((listener) => listener());
}
