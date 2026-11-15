/** The API's LinkedContacts::MOST: an account holds this many addresses, and as many numbers, primary included. */
export const CONTACTS_MOST = 2;

export interface ContactFacts {
  verified: boolean;
  primary: boolean;
  /** A replacement number waiting for its code (sc-62): not listed, and not counted. */
  pending?: boolean;
}

export interface ContactActions {
  /** Opens the existing code screen for this address or number. */
  verify: boolean;
  /** Only a verified one: the primary is where recovery goes, and a text to an unproved number may reach somebody else. */
  makePrimary: boolean;
  /** Never the primary: another is made primary first. */
  remove: boolean;
  /** A verified one asks before it goes; an unverified one goes at once. */
  askBeforeRemoving: boolean;
}

/** What a row offers (sc-113). The server refuses the same things, so these are never invitations to a refusal. */
export function contactActions(row: ContactFacts): ContactActions {
  return {
    verify: !row.verified,
    makePrimary: row.verified && !row.primary,
    remove: !row.primary,
    askBeforeRemoving: row.verified,
  };
}

export function listedContacts<T extends ContactFacts>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.pending !== true);
}

/** How many more can be added; the add control goes at 0. */
export function contactsLeft(rows: readonly ContactFacts[]): number {
  return Math.max(0, CONTACTS_MOST - listedContacts(rows).length);
}

const LIST_CHANGED_REFUSALS = new Set([
  'primary_address',
  'last_verified_address',
  'address_not_verified',
  'address_limit_reached',
  'already_linked',
]);

/** Another tab or device changed the list (sc-2304): read it again before the reason shows, which a failed read never holds back. */
export async function rereadAfterRefusal(
  code: string | null,
  read: () => Promise<void>,
): Promise<boolean> {
  if (code == null || !LIST_CHANGED_REFUSALS.has(code)) return false;

  await read().catch(() => {});

  return true;
}

/** The row a verify screen sent Account back for, while it is listed and verified. */
export function justVerified<T extends ContactFacts & { id: string }>(
  rows: readonly T[],
  id: string | null | undefined,
): T | null {
  return listedContacts(rows).find((row) => row.id === id && row.verified) ?? null;
}

export function primaryFirst<T extends ContactFacts>(rows: readonly T[]): T[] {
  return [...rows].sort((one, other) => Number(other.primary) - Number(one.primary));
}

export function primaryOf<T extends ContactFacts>(rows: readonly T[]): T | null {
  return rows.find((row) => row.primary) ?? null;
}

/** The card's one step on Your account: the first address not verified yet, the primary first, else the first number. */
export function firstUnverified<T extends ContactFacts>(
  emails: readonly T[],
  phones: readonly T[],
): { kind: 'email' | 'phone'; row: T } | null {
  const email = primaryFirst(emails).find((row) => !row.verified);
  if (email != null) return { kind: 'email', row: email };
  const phone = primaryFirst(phones).find((row) => !row.verified);

  return phone == null ? null : { kind: 'phone', row: phone };
}

/** The addresses Soirely stopped sending to (sc-4332), one Change email line each, in the rows' order (sc-44949). */
export function undeliverableAddresses<T extends ContactFacts & { undeliverable?: boolean }>(
  emails: readonly T[],
): T[] {
  return primaryFirst(listedContacts(emails)).filter((row) => row.undeliverable === true);
}

export type ChangeEmail = { to: 'add' } | { to: 'row'; id: string };

/** Adds an address while there is room; with the most held, opens the one address that can make room (pm, 13 Nov). */
export function changeEmail<T extends ContactFacts & { id: string }>(
  emails: readonly T[],
): ChangeEmail {
  const other = listedContacts(emails).find((row) => !row.primary);
  if (contactsLeft(emails) > 0 || other == null) return { to: 'add' };

  return { to: 'row', id: other.id };
}
