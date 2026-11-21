import { initials } from '@soirely/domain';
import { useSyncExternalStore } from 'react';

import type { Looking } from '../../components/settingsShell.ts';
import { YOU } from './sample.ts';

const store = { name: null as string | null, listeners: new Set<() => void>() };

function changed(): void {
  store.listeners.forEach((listener) => listener());
}

export function savedName(): string | null {
  return store.name;
}

/** A name saved on Your account, held for the visit: the list's card and the sidebar's foot take it too (sc-34213). */
export function saveName(name: string): void {
  if (store.name === name) return;
  store.name = name;
  changed();
}

/** A reload starts from the sample by itself; a deep link starts from it through this. */
export function forgetName(): void {
  if (store.name == null) return;
  store.name = null;
  changed();
}

function hear(listener: () => void): () => void {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

export function useSavedName(): string | null {
  return useSyncExternalStore(hear, savedName, savedName);
}

/** You, under the name you saved; anybody else the demo looks as keeps their sample. */
export function underSavedName(looking: Looking, saved: string | null): Looking {
  if (saved == null || looking.email !== YOU.email) return looking;

  return { ...looking, name: saved, initials: initials(saved) };
}
