import { type Account, primaryEmailAddress } from '@soirely/api-client';
import { useSyncExternalStore } from 'react';

import { SIGNED_OUT, api } from './api.ts';

export interface Organisation {
  id: string;
  name: string;
}

export interface Session {
  name: string;
  email: string;
  organisation: Organisation;
  organisations: readonly Organisation[];
  permissions: readonly string[];
}

export type SessionState =
  | { status: 'unknown' }
  | { status: 'checking' }
  | { status: 'signedIn'; session: Session }
  | { status: 'signedOut'; ended: boolean };

const STAND_IN_PERMISSIONS: readonly string[] = ['events.view', 'guests.view'];

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

export function can(session: Session, permission: string): boolean {
  return session.permissions.includes(permission);
}

export async function restoreSession(): Promise<void> {
  if (state.status !== 'unknown') return;

  set({ status: 'checking' });

  try {
    adoptAccount(await api.me());
  } catch {
    set({ status: 'signedOut', ended: false });
  }
}

export function adoptAccount(account: Account): void {
  set({ status: 'signedIn', session: sessionFrom(account) });
}

export function forgetSession(ended = false): void {
  set({ status: 'signedOut', ended });
}

export function __setSessionState(next: SessionState): void {
  set(next);
}

function sessionFrom(account: Account): Session {
  // A stand-in until epic 28: one organisation, named after the registered business.
  const organisation: Organisation = {
    id: account.id,
    name: account.businessName ?? account.name,
  };

  return {
    name: account.name,
    email: primaryEmailAddress(account) ?? '',
    organisation,
    organisations: [organisation],
    permissions: STAND_IN_PERMISSIONS,
  };
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
}
