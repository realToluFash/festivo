import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Account, Membership } from '@soirely/api-client';
import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { chooseOrganisation } from './kit/appNav.ts';
import { tokens } from './tokens.ts';

const REMEMBERED = 'soirely.organisation';

export interface SignedIn {
  account: Account | null;
  organisations: readonly Membership[];
  organisation: Membership | null;
}

let state: SignedIn = { account: null, organisations: [], organisation: null };
let loading: Promise<void> | null = null;
/** Set by signing out here, so a frame still on screen does not ask again and earn a "You were signed out". */
let ended = false;
const listeners = new Set<() => void>();

function set(next: SignedIn): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** The account and the organisation this device works in, shared by the frame and every signed-in screen. */
export function useSignedIn(): SignedIn {
  const current = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (current.account == null && !ended) void load();
  }, [current.account]);

  return current;
}

/** Read again after something on a screen changed the account, such as a password set or a provider linked. */
export function reloadSignedIn(): Promise<void> {
  ended = false;
  loading = null;

  return load();
}

function load(): Promise<void> {
  loading ??= Promise.all([api.me(), api.organisations(), remembered()])
    .then(([account, organisations, id]) => {
      set({ account, organisations, organisation: chooseOrganisation(organisations, id) });
    })
    .catch(() => {
      loading = null;
      router.replace('/sign-in');
    });

  return loading;
}

export function switchOrganisation(id: string): void {
  const organisation = state.organisations.find((membership) => membership.id === id);
  if (organisation == null) return;

  set({ ...state, organisation });
  void AsyncStorage.setItem(REMEMBERED, id).catch(() => {});
}

/** "Sign out" on the Settings list and on the "This device" row: no confirmation, straight to sign-in. */
export function signOutHere(): void {
  void api.signOut().finally(() => {
    forget();
    router.replace('/sign-in');
  });
}

/** This device's session already ended elsewhere: only the tokens are left to clear. */
export function endedHere(): void {
  void Promise.resolve(tokens.clear()).finally(() => {
    forget();
    router.replace('/sign-in');
  });
}

function forget(): void {
  ended = true;
  loading = null;
  set({ account: null, organisations: [], organisation: null });
}

async function remembered(): Promise<string | null> {
  return AsyncStorage.getItem(REMEMBERED).catch(() => null);
}
