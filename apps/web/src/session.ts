/**
 * Who is signed in — a stand-in, and marked as one.
 *
 * There is no sign-in yet. Accounts & sign-in replaces the body of this file;
 * what it must NOT change is the shape, because the shell, the navigation and
 * the permission guard are all written against it. Building those against
 * `undefined` and widening later is how a shell ends up with a permission check
 * that was never once exercised.
 *
 * The permissions deliberately do not include everything, so the forbidden page
 * is reachable in the running application rather than only in a test.
 */
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

const STAND_IN: Session = {
  name: 'Ada Okonkwo',
  email: 'ada@example.com',
  organisation: { id: 'org_1', name: 'Okonkwo Events' },
  organisations: [
    { id: 'org_1', name: 'Okonkwo Events' },
    { id: 'org_2', name: 'Lagos Hall' },
  ],
  permissions: ['events.view', 'guests.view'],
};

export function useSession(): Session {
  return STAND_IN;
}

export function can(session: Session, permission: string): boolean {
  return session.permissions.includes(permission);
}
