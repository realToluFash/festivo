import { type GuestPage } from '@soirely/api-client';
import { guestLanguage } from '@soirely/domain';
import { useSyncExternalStore } from 'react';

import { api } from '../../api.ts';
import { showLanguage } from '../../i18n/index.ts';

/** `said` counts the switches, so the status says each one once; `unsaved` is the choice the guest's record did not take. */
export interface GuestLanguageState {
  said: number;
  unsaved: string | null;
  saving: boolean;
}

const START: GuestLanguageState = { said: 0, unsaved: null, saving: false };

let state = START;
/** The last language picked, so an older save that answers late changes nothing. */
let latest: string | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<GuestLanguageState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useGuestLanguage(): GuestLanguageState {
  return useSyncExternalStore(subscribe, () => state);
}

/** The page opens in the rule's language, the browser asked through `navigator.languages`; nothing is kept on the device. */
export async function openIn(language: GuestPage['language']): Promise<void> {
  await showLanguage(guestLanguage({ ...language, browser: navigator.languages ?? [] }));
}

/** Switches at once, then keeps the choice on the guest, never on an account or this device. */
export async function chooseGuestLanguage(token: string, code: string): Promise<void> {
  latest = code;
  set({ said: state.said + 1, unsaved: null });
  await showLanguage(code);
  await save(token, code);
}

export async function saveAgain(token: string): Promise<void> {
  if (state.unsaved == null || state.saving) return;

  await save(token, state.unsaved);
}

async function save(token: string, code: string): Promise<void> {
  set({ saving: true });
  let saved = true;
  try {
    await api.chooseGuestLanguage(token, code);
  } catch {
    saved = false;
  }
  if (code === latest) set({ saving: false, unsaved: saved ? null : code });
}

/** Leaving the guest's page gives the device its own language back. */
export function leaveGuestPage(): void {
  state = START;
  latest = null;
  void showLanguage(null);
}
