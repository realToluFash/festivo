import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type Account,
  type InvitationPreview,
  type Membership,
  type PausedOrganisation,
  heldByDevice,
} from '@soirely/api-client';
import {
  type InvitationOutcome,
  chooseOrganisation,
  choosePaused,
  forgetEventsTab,
  rememberedEntry,
  rememberedFor,
} from '@soirely/domain';
import { router } from 'expo-router';
import i18next from 'i18next';
import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { registerAppPush } from './appPush.ts';
import { currentLocale } from './i18n/index.ts';
import { forgetDoor } from './kit/doorStore.ts';
import { leaveThen, leaveWithoutAsking } from './leaveHeld.ts';
import { takeDownRunOfShowCards } from './runOfShowCards.ts';
import { tokens } from './tokens.ts';

/** Per device and for the account that left it, so the next account to sign in opens in its own (sc-86373). */
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

const NO_ORGANISATIONS: { organisations: Membership[]; paused: PausedOrganisation[] } = {
  organisations: [],
  paused: [],
};

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

/** Home tapped from the frame, which pushes the launch screen again, is not a launch while somebody is signed in here (sc-28178). */
export function resumesSession(tapped: string | undefined): boolean {
  return tapped === '1' && state.account != null && !ended;
}

/** Read again after something on a screen changed the account, such as a password set or a provider linked. */
export function reloadSignedIn(): Promise<void> {
  return launchSignedIn().then(() => {});
}

/** The account alone, read again; a failed read rejects and leaves the screen where it is. */
export async function rereadAccount(): Promise<void> {
  if (state.account == null) return;
  const account = await api.me();

  set({ ...state, account });
}

let rereads = 0;
const movedOn = new Set<(organisation: Membership) => void>();

/** Told when a read finds the organisation being worked in gone, and moves on into another (sc-28178). */
export function onMovedOn(listener: (organisation: Membership) => void): () => void {
  movedOn.add(listener);

  return () => {
    movedOn.delete(listener);
  };
}

/** Read again on a language pick (sc-9267) and at each move (sc-28178); a failed read leaves everything as it was. */
export async function rereadOrganisations(): Promise<void> {
  if (state.account == null || heldByDevice(state.account)) return;

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

  const kept = read.organisations.find((membership) => membership.id === state.organisation?.id);

  // The organisation being worked in is gone from the list: what a relaunch would open in its place (sc-28178).
  if (kept == null && state.organisation != null && state.pausedIn == null) {
    const lost = state.organisation.id;
    const organisation = chooseOrganisation(read.organisations, lost);
    const pausedIn = choosePaused(read.paused, lost, read.organisations.length);

    forgetEventsTab();
    set({ ...state, organisations: read.organisations, organisation, pausedIn });
    void rememberWorkingIn(account.id, organisation, pausedIn, lost);
    if (pausedIn != null) return;
    if (organisation == null) router.replace('/');
    else for (const listener of movedOn) listener(organisation);

    return;
  }

  const organisation = kept ?? state.organisation;
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
    api.organisationsWithPaused().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    ),
    remembered(),
    api.myInvitations().catch(() => state.invitations),
  ])
    .then(([account, read, stored, invitations]) => {
      // A door code's account reaches only its events and itself (sc-72), so it has no organisations to read.
      const device = heldByDevice(account);
      if (!device && 'error' in read) throw read.error;
      const { organisations, paused } = 'value' in read ? read.value : NO_ORGANISATIONS;
      const id = rememberedFor(stored, account.id);
      const organisation = chooseOrganisation(organisations, id);
      const pausedIn = choosePaused(paused, id, organisations.length);
      set({ ...state, account, organisations, organisation, pausedIn, invitations });
      void rememberWorkingIn(account.id, organisation, pausedIn, id);
      if (!device) void registerAppPush().catch(() => {});
      // The account's language, followed at launch while this read was on its way (sc-9267).
      if (currentLocale() !== askedIn) void rereadOrganisations();

      return true;
    })
    .catch(() => {
      loading = null;
      router.replace('/welcome');

      return false;
    });

  return loading;
}

/** Before the organisations are read, so the next read opens in this one: an invitation accepted while onboarding. */
export function rememberOrganisation(account: string, id: string): Promise<void> {
  return AsyncStorage.setItem(REMEMBERED, rememberedEntry(account, id)).catch(() => {});
}

export function switchOrganisation(id: string, landed?: () => void): boolean {
  const organisation = state.organisations.find((membership) => membership.id === id);
  const account = state.account?.id;
  if (organisation == null || account == null) return false;

  const go = (): void => {
    forgetEventsTab();
    set({ ...state, organisation, pausedIn: null });
    void rememberOrganisation(account, id);
    landed?.();
  };

  leaveThen(go);

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

/** Only a phone code signs it in: no password, Apple or Google (sc-4235). */
export function onlyAPhoneCode(account: Account): boolean {
  return !account.hasPassword && account.providers.length === 0;
}

/** Every "Sign out": no confirmation of its own, though a form holding a change asks first (sc-82245). It lands where this account signs back in: welcome, or an empty door code for an account only a phone code signs in (sc-4235). */
export function signOutHere(): void {
  leaveThen(() => {
    const account = state.account;
    void api.signOut().finally(() => {
      forget();
      if (account != null && onlyAPhoneCode(account))
        router.replace({ pathname: '/d', params: { signedOut: '1' } });
      else router.replace('/welcome');
    });
  });
}

/** Sign out where a door code's step stays on screen, signed out (sc-72). */
export function signOutThen(then: () => void): void {
  leaveThen(() => {
    void api.signOut().finally(() => {
      forget();
      then();
    });
  });
}

/** This device's session already ended elsewhere: only the tokens are left to clear, and a form holding a change does not ask. */
export function endedHere(): void {
  leaveWithoutAsking();
  void Promise.resolve(tokens.clear()).finally(() => {
    forget();
    router.replace('/welcome');
  });
}

function forget(): void {
  void takeDownRunOfShowCards().catch(() => undefined);
  void forgetDoor();
  ended = true;
  loading = null;
  set(SIGNED_OUT);
}

/** Opened by default as much as by choice, so a pause there shows its page at the next launch rather than another organisation (sc-86056); another account's is let go, so it does not come back after this one (sc-86373). */
function rememberWorkingIn(
  account: string,
  organisation: Membership | null,
  pausedIn: PausedOrganisation | null,
  ownRemembered: string | null,
): Promise<void> {
  if (organisation != null && pausedIn == null)
    return rememberOrganisation(account, organisation.id);
  if (ownRemembered == null) return AsyncStorage.removeItem(REMEMBERED).catch(() => {});

  return Promise.resolve();
}

async function remembered(): Promise<string | null> {
  return AsyncStorage.getItem(REMEMBERED).catch(() => null);
}
