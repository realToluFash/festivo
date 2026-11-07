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

/** Every page takes the scheme at once, Violet while the person has never chosen; event covers keep the build's accent, their own colour. */
export function choose(key: SchemeKey | null): void {
  paint(key ?? OWN_SCHEME);
  tell(key);
}

/** Leaving the demo forgets the pick and puts the build's own scheme back. */
export function leave(): void {
  const root = document.documentElement;
  const own = config().scheme;

  root.style.removeProperty('--coverAccent');
  if (own == null) delete root.dataset.scheme;
  else root.dataset.scheme = own;
  tell(null);
}

function paint(key: SchemeKey): void {
  const root = document.documentElement;
  const accent = getComputedStyle(root).getPropertyValue('--colorAccent').trim();

  if (root.style.getPropertyValue('--coverAccent') === '' && accent !== '')
    root.style.setProperty('--coverAccent', accent);
  root.dataset.scheme = key;
}

function tell(key: SchemeKey | null): void {
  if (key === chosen) return;
  chosen = key;
  listeners.forEach((listener) => listener());
}
