/**
 * Who is signed in, and how the rest of the application finds out.
 *
 * A store rather than a context, for one reason that matters: `useSession()`
 * is called by the shell, the navigation and the permission guard, and a
 * context would mean every test that renders any of them has to wrap a
 * provider around it. The shape it hands back is the one those three were
 * written against, which is what this file promised not to change.
 *
 * The identity half is real now — `GET /api/auth/me`, reached through the
 * client, which renews from the refresh cookie on the way if the access token
 * in memory has gone. The ORGANISATION half is still a stand-in and is marked
 * as one below: organisations are epic 28 and the API has no record of them
 * yet.
 */
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
  /** Nothing has been asked yet. */
  | { status: 'unknown' }
  | { status: 'checking' }
  | { status: 'signedIn'; session: Session }
  /** `ended` separates a session that died from never having had one. */
  | { status: 'signedOut'; ended: boolean };

/**
 * The permissions the shell was built against, until epic 28 gives them a
 * record. They are deliberately not everything, so the refused page stays
 * reachable by clicking rather than only in a test.
 */
const STAND_IN_PERMISSIONS: readonly string[] = ['events.view', 'guests.view'];

let state: SessionState = { status: 'unknown' };
const listeners = new Set<() => void>();

export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, () => state);
}

/**
 * The session, for everything inside the signed-in tree.
 *
 * Throws rather than returning null, because every caller is already behind
 * the guard in AppLayout — and a nullable session would put a `?.` in the
 * navigation, the switcher and the permission check, where the branch that
 * handles "nobody" would never once be exercised.
 */
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

/**
 * Ask the API who this is, once.
 *
 * The first call of a page load goes out with no access token, comes back
 * `401`, and the client renews from the refresh cookie and retries it — which
 * is why a reload keeps the session without a sign-in screen. A failure here
 * means there is no session to renew, which is not an error worth showing.
 *
 * Asked ONCE, from `unknown` only. Once the answer is known it does not change
 * without this file being told: signing in sets it, the client's signed-out
 * event clears it, and a page load starts over. Re-asking on every mount would
 * put a request behind every navigation into /app and leave one in flight
 * after the screen that caused it had gone.
 */
export async function restoreSession(): Promise<void> {
  if (state.status !== 'unknown') return;

  set({ status: 'checking' });

  try {
    adoptAccount(await api.me());
  } catch {
    set({ status: 'signedOut', ended: false });
  }
}

/** After signing in, when the account has just been read. */
export function adoptAccount(account: Account): void {
  set({ status: 'signedIn', session: sessionFrom(account) });
}

/** `ended` is true when a session was lost rather than never held. */
export function forgetSession(ended = false): void {
  set({ status: 'signedOut', ended });
}

/** For tests, and for nothing else. */
export function __setSessionState(next: SessionState): void {
  set(next);
}

function sessionFrom(account: Account): Session {
  // STAND-IN: one organisation, named after the business the person
  // registered. Real data rather than an invented company, and the shape the
  // switcher needs — but there is no organisations table behind it until
  // epic 28, and nothing here can switch to a second one.
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

// The client has no router and no store, so it says the session is over by
// raising an event and lets this file decide what that means.
if (typeof window !== 'undefined') {
  window.addEventListener(SIGNED_OUT, () => {
    forgetSession(true);
  });
}
