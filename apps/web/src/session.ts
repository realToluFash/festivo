import {
  type Account,
  ApiError,
  ApiUnreachableError,
  type Awaiting,
  type JoinRequest,
  type LinkedProvider,
  type Membership,
  type PausedOrganisation,
  type Problem,
  awaiting,
  primaryEmailAddress,
} from '@soirely/api-client';
import { chooseOrganisation, choosePaused, forgetEventsTab, roleHolds } from '@soirely/domain';
import i18next from 'i18next';
import { useSyncExternalStore } from 'react';

import { followAccount } from './accountLanguage.ts';
import { GATED, SIGNED_OUT, api } from './api.ts';
import { currentLocale } from './i18n/index.ts';

export interface Session {
  name: string;
  email: string;
  verified: boolean;
  /** Through the details screen; the product stays behind the gate until it is. */
  complete: boolean;
  /** The gate it is behind, or null once it is through both. */
  awaiting: Awaiting | null;
  /** The providers that vouch for this account, such as Google, each with its address. */
  providers: readonly LinkedProvider[];
  /** False for an account that has only ever signed in with Google or Apple. */
  hasPassword: boolean;
  needsOrganisation: boolean;
  /** The one this device is working in; null for an account in no organisation. */
  organisation: Membership | null;
  /** The organisation's country from `/me`, which the gate lets through where `/api/orgs` is not. */
  organisationCountry: string | null;
  organisations: readonly Membership[];
  /** Shown in place of the product: the organisation this device was in, whose access is now paused (sc-564). */
  pausedIn?: PausedOrganisation | null;
  /** The account's IANA zone; null while times reach the person in UTC (sc-868). */
  timezone: string | null;
  /** The request to join at its domain that an account in no organisation is waiting on (sc-561). */
  waitingFor: JoinRequest | null;
}

export type SessionState =
  | { status: 'unknown' }
  | { status: 'checking' }
  | { status: 'signedIn'; session: Session }
  | { status: 'unreachable'; retrying: boolean }
  | { status: 'signedOut'; ended: boolean; timedOut?: TimedOut; providerOnly?: ProviderOnly };

/** An organisation's inactivity rule ended the session (sc-69): sign-in names it and keeps the address. */
export interface TimedOut {
  organisation: string;
  days: number;
  email: string;
}

/** An organisation's Google-or-Apple-only rule turned a password away (sc-69): sign-in names it, keeps the address and shows the linked buttons. */
export interface ProviderOnly {
  organisation: string;
  providers: string[];
  email: string;
}

/** Per device, as the switcher promises: "Soirely remembers your choice on this device". */
const ACTIVE_ORGANISATION = 'soirely.organisation';

let state: SessionState = { status: 'unknown' };
let generation = 0;
const listeners = new Set<() => void>();

export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useSession(): Session {
  const current = useSessionState();

  if (current.status !== 'signedIn') {
    throw new Error(
      'useSession() was called outside the signed-in tree. Render it under AppLayout, which guards it.',
    );
  }

  return current.session;
}

export function can(session: Session, permission: string): boolean {
  return session.organisation != null && roleHolds(session.organisation, permission);
}

export async function restoreSession(): Promise<void> {
  if (state.status !== 'unknown') return;

  set({ status: 'checking' });
  await askForAccount();
}

/** Stays on the unreachable screen while asking, so the button can say it is trying. */
export async function retrySession(): Promise<void> {
  if (state.status !== 'unreachable' || state.retrying) return;

  set({ status: 'unreachable', retrying: true });
  await askForAccount();
}

async function askForAccount(): Promise<void> {
  const asked = generation;

  try {
    await adoptAccount(await api.me(), asked);
  } catch (error) {
    if (generation !== asked) return;

    set(
      error instanceof ApiUnreachableError
        ? { status: 'unreachable', retrying: false }
        : { status: 'signedOut', ended: false },
    );
  }
}

/** The account, with its organisations; one behind the onboarding gate is not asked for them. */
export async function adoptAccount(account: Account, asked = generation): Promise<void> {
  const askedIn = currentLocale();
  const { organisations, paused } =
    account.verified && account.complete
      ? await api.organisationsWithPaused()
      : { organisations: [], paused: [] };
  await followAccount(account);
  if (generation !== asked) return;

  set({ status: 'signedIn', session: sessionFrom(account, organisations, paused) });
  // The account's language, followed after this read and before the session was set (sc-9267).
  if (currentLocale() !== askedIn) void rereadOrganisations();
}

/** After a gate has been passed, or the API says one has closed: the account read afresh. */
export async function refreshAccount(): Promise<void> {
  await askForAccount();
}

/** The password and linked providers, read again; a failed read rejects and leaves the page where it is. */
export async function rereadCredentials(): Promise<void> {
  const asked = generation;
  const { hasPassword, providers } = await api.me();
  if (generation !== asked || state.status !== 'signedIn') return;

  set({ status: 'signedIn', session: { ...state.session, hasPassword, providers } });
}

let rereads = 0;

/** Read again in a newly picked language, so the dates the server wrote follow it; a failed read leaves them as they were (sc-9267). */
export async function rereadOrganisations(): Promise<void> {
  if (state.status !== 'signedIn' || state.session.awaiting != null) return;

  const asked = generation;
  const known = state.session.organisations;
  rereads += 1;
  const reread = rereads;
  const read = await api.organisationsWithPaused().catch(() => null);
  if (
    read == null ||
    generation !== asked ||
    reread !== rereads ||
    state.status !== 'signedIn' ||
    state.session.organisations !== known
  )
    return;

  const current = state.session;
  const organisation =
    read.organisations.find((membership) => membership.id === current.organisation?.id) ??
    current.organisation;
  const pausedIn =
    current.pausedIn == null
      ? null
      : (read.paused.find((paused) => paused.id === current.pausedIn?.id) ?? current.pausedIn);

  set({
    status: 'signedIn',
    session: { ...current, organisations: read.organisations, organisation, pausedIn },
  });
}

/** Where a signed-in account belongs: the gate it is behind, or the product. */
export function landingFor(gate: Awaiting | null): string {
  if (gate === 'email') return '/verify-email';
  if (gate === 'phone') return '/verify-phone?from=onboarding';

  return gate === 'details' || gate === 'approval' ? '/complete-profile' : '/app';
}

/** Before the organisations are read, so the next read opens in this one: an invitation accepted while onboarding. */
export function rememberOrganisation(id: string): void {
  remember(id);
}

/** Remembered on this device, so the next visit opens where this one left off. */
export function switchOrganisation(id: string): void {
  if (state.status !== 'signedIn') return;

  const organisation = state.session.organisations.find((membership) => membership.id === id);

  if (organisation == null) return;

  remember(id);
  forgetEventsTab();
  set({ status: 'signedIn', session: { ...state.session, organisation, pausedIn: null } });
}

/** An invitation accepted in the product: the organisation joins the list, and nobody is moved into it. */
export function joinOrganisation(joined: Membership): void {
  if (state.status !== 'signedIn') return;

  const current = state.session;
  const organisations = [
    ...current.organisations.filter((membership) => membership.id !== joined.id),
    joined,
  ];

  set({ status: 'signedIn', session: { ...current, organisations } });
}

/** After an edit, so the switcher and every page read the new name at once. */
export function replaceOrganisation(next: Membership): void {
  if (state.status !== 'signedIn') return;

  const current = state.session;
  const organisations = current.organisations.map((membership) =>
    membership.id === next.id ? next : membership,
  );
  const organisation =
    organisations.find((membership) => membership.id === current.organisation?.id) ?? null;

  set({ status: 'signedIn', session: { ...current, organisations, organisation } });
}

export function forgetSession(ended = false, why?: Problem): void {
  const timedOut = timedOutBy(why);
  const providerOnly = providerOnlyBy(why);

  generation += 1;
  set({
    status: 'signedOut',
    ended,
    ...(timedOut == null ? {} : { timedOut }),
    ...(providerOnly == null ? {} : { providerOnly }),
  });
}

/** A test starts afresh: an answer still in flight from the test before it is dropped, not adopted. */
export function __setSessionState(next: SessionState): void {
  generation += 1;
  set(next);
}

function timedOutBy(why: Problem | undefined): TimedOut | undefined {
  if (why == null || !new ApiError(why).is('session_timed_out')) return undefined;
  if (why.organisation == null || why.days == null) return undefined;

  return { organisation: why.organisation, days: why.days, email: why.email ?? '' };
}

/** The `oauth_only` refusal, from a sign-in, a completed reset or a session the rule ended. */
export function providerOnlyBy(why: Problem | undefined): ProviderOnly | undefined {
  if (why == null || !new ApiError(why).is('oauth_only') || why.organisation == null)
    return undefined;

  return { organisation: why.organisation, providers: why.providers ?? [], email: why.email ?? '' };
}

function sessionFrom(
  account: Account,
  organisations: readonly Membership[],
  paused: readonly PausedOrganisation[],
): Session {
  const remembered = recalled();

  return {
    name: account.name,
    email: primaryEmailAddress(account) ?? '',
    verified: account.verified,
    complete: account.complete,
    awaiting: awaiting(account),
    providers: account.providers,
    hasPassword: account.hasPassword,
    needsOrganisation: account.needsOrganisation,
    organisations,
    organisationCountry: account.organisationCountry,
    timezone: account.timezone,
    waitingFor: account.waitingFor,
    organisation: chooseOrganisation(organisations, remembered),
    pausedIn: choosePaused(paused, remembered, organisations.length),
  };
}

function recalled(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_ORGANISATION);
  } catch {
    return null;
  }
}

function remember(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_ORGANISATION, id);
  } catch {
    // Private windows refuse storage; the choice then lasts as long as the page.
  }
}

function set(next: SessionState): void {
  state = next;

  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener(SIGNED_OUT, (event) => {
    forgetSession(true, (event as CustomEvent<Problem | undefined>).detail);
  });

  i18next.on('languageChanged', () => void rereadOrganisations());

  // The API said the account is behind a gate this session did not know about, so read it again.
  window.addEventListener(GATED, () => {
    if (state.status === 'signedIn') void refreshAccount();
  });
}
