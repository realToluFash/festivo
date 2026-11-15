import { initials } from '@soirely/domain';
import { useSyncExternalStore } from 'react';

import type { Viewer, ViewerKey } from './settings.ts';

let saved: Partial<Record<ViewerKey, string>> = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** Names saved on Your account in this visit, in memory only: a reload or a deep link starts from the sample (sc-34213). */
export function useSavedNames(): Partial<Record<ViewerKey, string>> {
  return useSyncExternalStore(subscribe, () => saved);
}

export function savedNameOf(key: ViewerKey): string | null {
  return saved[key] ?? null;
}

export function saveName(key: ViewerKey, name: string): void {
  if (saved[key] === name) return;
  saved = { ...saved, [key]: name };
  listeners.forEach((listener) => listener());
}

export function forgetNames(): void {
  saved = {};
  listeners.forEach((listener) => listener());
}

/** Whoever is looking, under the name they saved: the list's tile and the sidebar's foot take it with the page's card. */
export function underSavedName(viewer: Viewer, names: Partial<Record<ViewerKey, string>>): Viewer {
  const name = names[viewer.key];
  if (name == null) return viewer;

  return { ...viewer, name, initials: initials(name) };
}
