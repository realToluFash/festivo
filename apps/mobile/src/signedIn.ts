import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Account,
  InvitationPreview,
  Membership,
  PausedOrganisation,
} from '@soirely/api-client';
import {
  type InvitationOutcome,
  chooseOrganisation,
  choosePaused,
  forgetEventsTab,
} from '@soirely/domain';
import { router } from 'expo-router';
import i18next from 'i18next';
import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { currentLocale } from './i18n/index.ts';
import { tokens } from './tokens.ts';

const REMEMBERED = 'soirely.organisation';

export interface SignedIn {
  account: Account | null;
  organisations: readonly Membership[];
  organisation: Membership | null;
  /** Shown in place of every screen: the organisation this device was in, whose access is now paused (sc-564). */
  pausedIn?: PausedOrganisation | null;
  invitations: readonly InvitationPreview[];
  invitationOutcomes: Readonly<Record<string, InvitationOutcome>>;
}

const SIGNED_OUT: SignedIn = {
  account: null,
  organisations: [],
  organisation: null,
  invitations: [],
  invitationOutcomes: {},
};

let state: SignedIn = SIGNED_OUT;
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
  return launchSignedIn().then(() => {});
}

/** The account alone, read again; a failed read rejects and leaves the screen where it is. */
export async function rereadAccount(): Promise<void> {
  const account = await api.me();

  set({ ...state, account });
}

let rereads = 0;

/** Read again in a newly picked language, so the dates the server wrote follow it; a failed read leaves them as they were (sc-9267). */
export async function rereadOrganisations(): Promise<void> {
  if (state.account == null) return;

  const account = state.account;
  const known = state.organisations;
  rereads += 1;
  const reread = rereads;
  const read = await api.organisationsWithPaused().catch(() => null);
  if (
    read == null ||
    reread !== rereads ||
    state.account?.id !== account.id ||
    state.organisations !== known
  )
    return;

  const organisation =
    read.organisations.find((membership) => membership.id === state.organisation?.id) ??
    state.organisation;
  const pausedIn =
    state.pausedIn == null
      ? null
      : (read.paused.find((paused) => paused.id === state.pausedIn?.id) ?? state.pausedIn);

  set({ ...state, organisations: read.organisations, organisation, pausedIn });
}

i18next.on('languageChanged', () => void rereadOrganisations());

/** False when the account could not be read and sign-in has opened instead. */
export function launchSignedIn(): Promise<boolean> {
  ended = false;
  loading = null;

  return load();
}

let loading: Promise<boolean> | null = null;

function load(): Promise<boolean> {
  const askedIn = currentLocale();
  loading ??= Promise.all([
    api.me(),
    api.organisationsWithPaused(),
    remembered(),
    api.myInvitations().catch(() => state.invitations),
  ])
    .then(([account, { organisations, paused }, id, invitations]) => {
      set({
        ...state,
        account,
        organisations,
        organisation: chooseOrganisation(organisations, id),
        pausedIn: choosePaused(paused, id, organisations.length),
        invitations,
      });
      // The account's language, followed at launch while this read was on its way (sc-9267).
      if (currentLocale() !== askedIn) void rereadOrganisations();

      return true;
    })
    .catch(() => {
      loading = null;
      router.replace('/sign-in');

      return false;
    });

  return loading;
}

/** Before the organisations are read, so the next read opens in this one: an invitation accepted while onboarding. */
export function rememberOrganisation(id: string): Promise<void> {
  return AsyncStorage.setItem(REMEMBERED, id).catch(() => {});
}

let switchHeld: ((go: () => void) => void) | null = null;

/** A screen with unsaved work asks before the organisation changes under it, and calls `go` to switch anyway. */
export function holdSwitches(ask: (go: () => void) => void): () => void {
  switchHeld = ask;

  return () => {
    if (switchHeld === ask) switchHeld = null;
  };
}

export function switchOrganisation(id: string, landed?: () => void): boolean {
  const organisation = state.organisations.find((membership) => membership.id === id);
  if (organisation == null) return false;

  const go = (): void => {
    forgetEventsTab();
    set({ ...state, organisation, pausedIn: null });
    void AsyncStorage.setItem(REMEMBERED, id).catch(() => {});
    landed?.();
  };

  if (switchHeld == null) go();
  else switchHeld(go);

  return true;
}

/** An invitation accepted in the app: the organisation joins the list, and nobody is moved into it. */
export function joinOrganisation(joined: Membership): void {
  set({
    ...state,
    organisations: [
      ...state.organisations.filter((membership) => membership.id !== joined.id),
      joined,
    ],
  });
}

export function settleInvitation(id: string, outcome: InvitationOutcome): void {
  set({ ...state, invitationOutcomes: { ...state.invitationOutcomes, [id]: outcome } });
}

export function replaceOrganisation(saved: Membership): void {
  const organisations = state.organisations.map((membership) =>
    membership.id === saved.id ? saved : membership,
  );

  set({
    ...state,
    organisations,
    organisation: state.organisation?.id === saved.id ? saved : state.organisation,
  });
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
  set(SIGNED_OUT);
}

async function remembered(): Promise<string | null> {
  return AsyncStorage.getItem(REMEMBERED).catch(() => null);
}
