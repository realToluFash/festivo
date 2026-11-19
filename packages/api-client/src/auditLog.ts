/** Data and control › Audit log, as the API answers it (sc-611): the organisation's entries for 365 days, newest first. */

export const AUDIT_TYPES = [
  'events',
  'event_access',
  'members',
  'security',
  'organisation',
  'audit_log',
] as const;

export type AuditType = (typeof AUDIT_TYPES)[number];

export const AUDIT_FORMATS = ['csv', 'jsonl'] as const;

export type AuditFormat = (typeof AUDIT_FORMATS)[number];

/** Up to this many download at once; more are prepared and emailed, up to `AUDIT_AT_MOST`. */
export const AUDIT_AT_ONCE = 10_000;

export const AUDIT_AT_MOST = 1_000_000;

export interface AuditWho {
  /** `support` reads "Soirely support" and `system` "System"; the client words both. */
  kind: 'person' | 'support' | 'system';
  /** The name recorded with the entry; null for support and the System. */
  name: string | null;
  /** The person's current address; null once their account is deleted. */
  email: string | null;
}

export interface AuditOn {
  name: string;
  /** Linked while it exists, to the event's own page. */
  eventId: string | null;
  gone: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  /** In the reader's own zone, or UTC for an account with none (sc-868): the day it falls on, its time, and the detail's stamp to the second. */
  day: string;
  time: string;
  when: string;
  who: AuditWho;
  /** In the reader's language: "Removed Ada Obi from Ada's Wedding". */
  what: string;
  on: AuditOn | null;
  /** One line per field that changed: "Everyone needs two-factor: Off → On". */
  changes: string[];
  type: AuditType;
  /** sc-73's code, `membership.role_changed`. */
  action: string;
  /** Sign-in and security entries only. */
  address: string | null;
  device: string | null;
  reference: string;
}

export interface AuditPerson {
  id: string;
  name: string;
  email: string | null;
  left: boolean;
}

export interface AuditEvent {
  id: string;
  name: string;
  gone: boolean;
}

export interface AuditFilters {
  person?: string | null;
  type?: AuditType | null;
  event?: string | null;
  /** YYYY-MM-DD, in the reader's zone. */
  from?: string | null;
  to?: string | null;
}

export interface AuditLogPage {
  organisation: string;
  /** The reader's zone, or null when the times are UTC. */
  zone: string | null;
  entries: AuditEntry[];
  /** Passed back as `before` for the next page; null at the end. */
  next: string | null;
  people: AuditPerson[];
  events: AuditEvent[];
  /** Set while the reader's own large export is being prepared: the address its link goes to. */
  preparing: string | null;
}

/** A small export arrives as its file; a large one is prepared and emailed. More than a million is refused `audit_export_too_many`. */
export type AuditExportOutcome =
  | { kind: 'file'; type: string; bytes: Uint8Array<ArrayBuffer> }
  | { kind: 'preparing'; count: number; email: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function asWho(raw: unknown): AuditWho | null {
  if (!isRecord(raw) || !text(raw.name) || !text(raw.email)) return null;
  if (raw.kind !== 'person' && raw.kind !== 'support' && raw.kind !== 'system') return null;

  return { kind: raw.kind, name: raw.name, email: raw.email };
}

function asOn(raw: unknown): AuditOn | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || !text(raw.eventId)) return null;
  if (typeof raw.gone !== 'boolean') return null;

  return { name: raw.name, eventId: raw.eventId, gone: raw.gone };
}

function asLines(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.every((line) => typeof line === 'string') ? (raw as string[]) : null;
}

function asEntry(raw: unknown): AuditEntry | null {
  if (!isRecord(raw)) return null;
  const type = AUDIT_TYPES.find((one) => one === raw.type);
  const who = asWho(raw.who);
  const on = raw.on === null ? null : asOn(raw.on);
  const changes = asLines(raw.changes);

  if (
    type == null ||
    who == null ||
    changes == null ||
    (raw.on !== null && on == null) ||
    typeof raw.id !== 'string' ||
    typeof raw.at !== 'string' ||
    typeof raw.day !== 'string' ||
    typeof raw.time !== 'string' ||
    typeof raw.when !== 'string' ||
    typeof raw.what !== 'string' ||
    typeof raw.action !== 'string' ||
    typeof raw.reference !== 'string' ||
    !text(raw.address) ||
    !text(raw.device)
  )
    return null;

  return {
    id: raw.id,
    at: raw.at,
    day: raw.day,
    time: raw.time,
    when: raw.when,
    who,
    what: raw.what,
    on,
    changes,
    type,
    action: raw.action,
    address: raw.address,
    device: raw.device,
    reference: raw.reference,
  };
}

function asPerson(raw: unknown): AuditPerson | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  if (!text(raw.email) || typeof raw.left !== 'boolean') return null;

  return { id: raw.id, name: raw.name, email: raw.email, left: raw.left };
}

function asEvent(raw: unknown): AuditEvent | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  if (typeof raw.gone !== 'boolean') return null;

  return { id: raw.id, name: raw.name, gone: raw.gone };
}

function every<T>(raw: unknown, read: (one: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const items: T[] = [];

  for (const one of raw) {
    const item = read(one);
    if (item == null) return null;
    items.push(item);
  }

  return items;
}

export function asAuditLogPage(raw: unknown): AuditLogPage | null {
  if (!isRecord(raw) || typeof raw.organisation !== 'string') return null;
  if (!text(raw.zone) || !text(raw.next) || !text(raw.preparing)) return null;
  const entries = every(raw.entries, asEntry);
  const people = every(raw.people, asPerson);
  const events = every(raw.events, asEvent);

  if (entries == null || people == null || events == null) return null;

  return {
    organisation: raw.organisation,
    zone: raw.zone,
    entries,
    next: raw.next,
    people,
    events,
    preparing: raw.preparing,
  };
}

/** The filters as the API reads them, leaving out the ones not set. */
export function auditQuery(filters: AuditFilters): Record<string, string> {
  const query: Record<string, string> = {};

  for (const key of ['person', 'type', 'event', 'from', 'to'] as const) {
    const value = filters[key];
    if (value != null && value !== '') query[key] = value;
  }

  return query;
}
