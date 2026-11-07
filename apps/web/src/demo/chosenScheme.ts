import { useSyncExternalStore } from 'react';

import { config } from '../config.ts';
import type { SchemeKey } from './personalisation.ts';

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

/** Every page takes the scheme at once; event covers keep the build's accent, their own colour. */
export function choose(key: SchemeKey | null): void {
  const root = document.documentElement;

  if (key == null) {
    root.style.removeProperty('--coverAccent');
    const own = config().scheme;
    if (own == null) delete root.dataset.scheme;
    else root.dataset.scheme = own;
  } else {
    const accent = getComputedStyle(root).getPropertyValue('--colorAccent').trim();
    if (root.style.getPropertyValue('--coverAccent') === '' && accent !== '')
      root.style.setProperty('--coverAccent', accent);
    root.dataset.scheme = key;
  }

  if (key === chosen) return;
  chosen = key;
  listeners.forEach((listener) => listener());
}

/** Leaving the demo forgets the pick and puts the build's own scheme back. */
export function leave(): void {
  choose(null);
}
