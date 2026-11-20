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
  kind: 'person' | 'support' | 'system';
  name: string | null;
  email: string | null;
}

export interface AuditOn {
  name: string;
  eventId: string | null;
  gone: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  /** `day` (YYYY-MM-DD), `time` (HH:mm) and `when` are in the reader's zone, or UTC for an account with none. */
  day: string;
  time: string;
  when: string;
  who: AuditWho;
  what: string;
  on: AuditOn | null;
  changes: string[];
  type: AuditType;
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
  from?: string | null;
  to?: string | null;
}

export interface AuditLogPage {
  organisation: string;
  zone: string | null;
  entries: AuditEntry[];
  next: string | null;
  people: AuditPerson[];
  events: AuditEvent[];
  /** Set while the reader's own large export is being prepared: the address its link goes to. */
  preparing: string | null;
}

/** A small export arrives as its file; a large one is prepared and emailed. More than a million is refused `audit_export_too_many`. */
export type AuditExportOutcome =
  | { kind: 'file'; type: string; name: string | null; bytes: Uint8Array<ArrayBuffer> }
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
