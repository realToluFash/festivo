/** An event's guest list as the API answers it (sc-1468). A companion is a guest of their own, listed under their host. */

export type GuestReply = 'noReply' | 'coming' | 'maybe' | 'notComing';

/** Derived from the host's reply and never stored: Held until the host is Coming. */
export type CompanionState = 'held' | 'coming';

export interface Companion {
  id: string;
  /** Null when the host left it blank: shown as "Guest of <host>". */
  fullName: string | null;
  state: CompanionState;
}

export interface Guest {
  id: string;
  fullName: string;
  /** Null for none, and for anyone without guests.manage, whom the API never sends it (sc-3773). */
  email: string | null;
  /** E.164; null as `email` is. */
  mobile: string | null;
  reply: GuestReply;
  companions: Companion[];
}

/** `people` counts guests and companions together. */
export interface GuestCounts {
  people: number;
  guests: number;
  companions: number;
}

export interface GuestList {
  guests: Guest[];
  counts: GuestCounts;
}

export interface NewGuest {
  fullName: string;
  email?: string | null;
  /** As the account's Mobile number field sends it: the country picked and the number typed. Answered as E.164. */
  mobile?: { countryCode: string; number: string } | null;
  companions?: { fullName?: string | null }[];
  /** Sent once the host pressed Add anyway on "<name> is already on the list". */
  allowDuplicate?: boolean;
}

/** One guest as their details show them (sc-3773). */
export interface GuestDetails extends Guest {
  added: { at: string; by: string | null };
}

/** The whole guest as Edit saves it: each companion kept by `id`, one with no id added, one left out removed. */
export interface GuestEdit extends Omit<NewGuest, 'companions'> {
  companions: { id?: string | null; fullName?: string | null }[];
}

/** A guest with the `ETag` an edit sends back as `If-Match`. */
export interface TaggedGuest {
  guest: GuestDetails;
  tag: string;
}

/** The API's Guest limits, which the form checks before sending. */
export const GUEST_NAME_MAXIMUM = 200;
export const COMPANIONS_MAXIMUM = 10;

const REPLIES: readonly GuestReply[] = ['noReply', 'coming', 'maybe', 'notComing'];

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asCompanion(value: unknown): Companion | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  if (id == null || (row.state !== 'held' && row.state !== 'coming')) return null;

  return { id, fullName: text(row.fullName), state: row.state };
}

export function asGuest(value: unknown): Guest | null {
  if (typeof value !== 'object' || value == null) return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const fullName = text(row.fullName);
  const reply = REPLIES.find((known) => known === row.reply);
  if (id == null || fullName == null || reply == null || !Array.isArray(row.companions))
    return null;
  const companions = row.companions.map(asCompanion);
  if (companions.some((companion) => companion == null)) return null;

  return {
    id,
    fullName,
    email: text(row.email),
    mobile: text(row.mobile),
    reply,
    companions: companions as Companion[],
  };
}

export function asGuestList(value: unknown): GuestList | null {
  if (typeof value !== 'object' || value == null) return null;
  const body = value as Record<string, unknown>;
  const counts = body.counts as Record<string, unknown> | null | undefined;
  if (!Array.isArray(body.guests) || typeof counts !== 'object' || counts == null) return null;
  if (
    typeof counts.people !== 'number' ||
    typeof counts.guests !== 'number' ||
    typeof counts.companions !== 'number'
  ) {
    return null;
  }
  const guests = body.guests.map(asGuest);
  if (guests.some((guest) => guest == null)) return null;

  return {
    guests: guests as Guest[],
    counts: { people: counts.people, guests: counts.guests, companions: counts.companions },
  };
}

export function asGuestDetails(value: unknown): GuestDetails | null {
  const guest = asGuest(value);
  const added = (value as { added?: unknown } | null)?.added as Record<string, unknown> | undefined;
  const at = typeof added === 'object' && added != null ? text(added.at) : null;

  if (guest == null || at == null) return null;

  return { ...guest, added: { at, by: text(added?.by) } };
}
