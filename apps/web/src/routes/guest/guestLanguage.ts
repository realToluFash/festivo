import { type GuestPage } from '@soirely/api-client';
import { guestLanguage } from '@soirely/domain';
import { useSyncExternalStore } from 'react';

import { api } from '../../api.ts';
import { setLanguage, showLanguage, storedLanguage } from '../../i18n/index.ts';

/** `said` counts the switches, so the status says each one once; `unsaved` is the choice the guest's record did not take. */
export interface GuestLanguageState {
  said: number;
  unsaved: string | null;
  saving: boolean;
}

const START: GuestLanguageState = { said: 0, unsaved: null, saving: false };

let state = START;
/** The last language picked: a save that is no longer it is skipped, and one that answers late changes nothing. */
let latest: string | null = null;
/** Each save waits for the one before, so the server records the picks in the order the guest made them. */
let saving: Promise<void> = Promise.resolve();
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

/** The guest's saved choice, then this device's copy of it, then the browser (pm #5238). */
export async function openIn(language: GuestPage['language']): Promise<void> {
  const device = storedLanguage();
  const browser = navigator.languages ?? [];

  await showLanguage(
    guestLanguage({ ...language, browser: device == null ? browser : [device, ...browser] }),
  );
}

/** Switches at once and saves on the guest; signed out, this device keeps a copy, and a signed-in account's language is left alone. */
export async function chooseGuestLanguage(
  token: string,
  code: string,
  signedIn: boolean,
): Promise<void> {
  latest = code;
  set({ said: state.said + 1, unsaved: null });
  await (signedIn ? showLanguage(code) : keepOnDevice(code));
  await save(token, code);
}

async function keepOnDevice(code: string): Promise<void> {
  try {
    await setLanguage(code);
  } catch {
    await showLanguage(code);
  }
}

export async function saveAgain(token: string): Promise<void> {
  if (state.unsaved == null || state.saving) return;

  await save(token, state.unsaved);
}

function save(token: string, code: string): Promise<void> {
  saving = saving.then(() => send(token, code));

  return saving;
}

async function send(token: string, code: string): Promise<void> {
  if (code !== latest) return;
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
  saving = Promise.resolve();
  void showLanguage(null);
}
