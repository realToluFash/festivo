import {
  type Account,
  ApiUnreachableError,
  type Awaiting,
  type Membership,
  awaiting,
  primaryEmailAddress,
} from '@soirely/api-client';
import { useSyncExternalStore } from 'react';

import { followAccount } from './accountLanguage.ts';
import { GATED, SIGNED_OUT, api } from './api.ts';

export interface Session {
  name: string;
  email: string;
  verified: boolean;
  /** Through the details screen; the product stays behind the gate until it is. */
  complete: boolean;
  /** The gate it is behind, or null once it is through both. */
  awaiting: Awaiting | null;
  /** The providers that vouch for this account, such as Google. */
  providers: readonly string[];
  /** False for an account that has only ever signed in with Google or Apple. */
  hasPassword: boolean;
  needsOrganisation: boolean;
  /** The one this device is working in; null for an account in no organisation. */
  organisation: Membership | null;
  organisations: readonly Membership[];
}

export type SessionState =
  | { status: 'unknown' }
  | { status: 'checking' }
  | { status: 'signedIn'; session: Session }
  | { status: 'unreachable'; retrying: boolean }
  | { status: 'signedOut'; ended: boolean };

/** Per device, as the switcher promises: "Soirely remembers your choice on this device". */
const ACTIVE_ORGANISATION = 'soirely.organisation';

let state: SessionState = { status: 'unknown' };
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

/** Owner holds every permission; until sc-66 gives other roles theirs, nobody else holds any. */
export function can(session: Session, permission: string): boolean {
  return permission !== '' && session.organisation?.role.seededAs === 'owner';
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
  try {
    await adoptAccount(await api.me());
  } catch (error) {
    set(
      error instanceof ApiUnreachableError
        ? { status: 'unreachable', retrying: false }
        : { status: 'signedOut', ended: false },
    );
  }
}

/** The account, with its organisations; one behind the onboarding gate is not asked for them. */
export async function adoptAccount(account: Account): Promise<void> {
  const organisations = account.verified && account.complete ? await api.organisations() : [];
  await followAccount(account);

  set({ status: 'signedIn', session: sessionFrom(account, organisations) });
}

/** After a gate has been passed, or the API says one has closed: the account read afresh. */
export async function refreshAccount(): Promise<void> {
  await askForAccount();
}

/** Where a signed-in account belongs: the gate it is behind, or the product. */
export function landingFor(gate: Awaiting | null): string {
  if (gate === 'email') return '/verify-email';
  if (gate === 'phone') return '/verify-phone?from=onboarding';

  return gate === 'details' ? '/complete-profile' : '/app';
}

/** Remembered on this device, so the next visit opens where this one left off. */
export function switchOrganisation(id: string): void {
  if (state.status !== 'signedIn') return;

  const organisation = state.session.organisations.find((membership) => membership.id === id);

  if (organisation == null) return;

  remember(id);
  set({ status: 'signedIn', session: { ...state.session, organisation } });
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

export function forgetSession(ended = false): void {
  set({ status: 'signedOut', ended });
}

export function __setSessionState(next: SessionState): void {
  set(next);
}

function sessionFrom(account: Account, organisations: readonly Membership[]): Session {
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
    organisation:
      organisations.find((membership) => membership.id === remembered) ?? organisations[0] ?? null,
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
  window.addEventListener(SIGNED_OUT, () => {
    forgetSession(true);
  });

  // The API said the account is behind a gate this session did not know about, so read it again.
  window.addEventListener(GATED, () => {
    if (state.status === 'signedIn') void refreshAccount();
  });
}
