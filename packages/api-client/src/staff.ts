/** An event's roster (sc-3906), with its jobs and shifts (sc-3908), as the API answers and the hub publishes it. Every time is an instant with the event's offset. */

export type StaffLink = 'none' | 'no_mobile' | 'erased';

export type StaffAccess = 'view' | 'check_in' | 'floor' | 'pass' | 'run';

export const STAFF_ACCESS: readonly StaffAccess[] = ['view', 'check_in', 'floor', 'pass', 'run'];

export interface StaffEntryShift {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface StaffEntry {
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  job: { id: string; name: string } | null;
  station: string | null;
  shifts: StaffEntryShift[];
  link: StaffLink;
  contactsErased: boolean;
}

export interface StaffJob {
  id: string;
  name: string;
  access: StaffAccess;
}

export interface StaffShift {
  id: string;
  job: string;
  startsAt: string;
  endsAt: string;
  needed: number;
  people: string[];
}

export interface StaffPlan {
  staff: StaffEntry[];
  jobs: StaffJob[];
  shifts: StaffShift[];
}

/** `job` and `shift` by id; on an edit, `job` left out keeps the person's. */
export interface StaffDetails {
  fullName: string;
  mobile?: { countryCode: string; number: string } | null;
  email?: string | null;
  job?: string | null;
  shift?: string | null;
  allowShared?: boolean;
}

/** Times are wall-clock in the event's zone, `2026-11-07T16:00`. */
export interface ShiftDetails {
  startsAt: string;
  endsAt: string;
  needed: number;
}

export interface StaffAnswer {
  staff: StaffEntry;
  member: string | null;
}

/** The API's StaffMember::NAME_MAXIMUM, in visible characters. */
export const STAFF_NAME_MAXIMUM = 200;

/** The API's StaffJob::NAME_MAXIMUM, in visible characters. */
export const JOB_NAME_MAXIMUM = 60;

/** The API's StaffShift::NEEDED_MAXIMUM. */
export const SHIFT_NEEDED_MAXIMUM = 50;

const LINKS: readonly StaffLink[] = ['none', 'no_mobile', 'erased'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((one) => typeof one === 'string');

function asEntryShift(raw: unknown): StaffEntryShift | null {
  if (!isRecord(raw)) return null;
  const { id, startsAt, endsAt } = raw;

  return typeof id === 'string' && typeof startsAt === 'string' && typeof endsAt === 'string'
    ? { id, startsAt, endsAt }
    : null;
}

function asJobRef(raw: unknown): { id: string; name: string } | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string')
    return undefined;

  return { id: raw.id, name: raw.name };
}

export function asStaffEntry(raw: unknown): StaffEntry | null {
  if (!isRecord(raw)) return null;
  const { id, fullName, mobile, email, station, link, contactsErased } = raw;
  const job = asJobRef(raw.job);
  const shifts = Array.isArray(raw.shifts) ? raw.shifts.map(asEntryShift) : null;

  if (
    typeof id !== 'string' ||
    typeof fullName !== 'string' ||
    !text(mobile) ||
    !text(email) ||
    job === undefined ||
    !text(station) ||
    shifts == null ||
    shifts.some((one) => one == null) ||
    !LINKS.includes(link as StaffLink) ||
    typeof contactsErased !== 'boolean'
  )
    return null;

  return {
    id,
    fullName,
    mobile,
    email,
    job,
    station,
    shifts: shifts as StaffEntryShift[],
    link: link as StaffLink,
    contactsErased,
  };
}

function asStaffJob(raw: unknown): StaffJob | null {
  if (!isRecord(raw)) return null;
  const { id, name, access } = raw;

  return typeof id === 'string' &&
    typeof name === 'string' &&
    STAFF_ACCESS.includes(access as StaffAccess)
    ? { id, name, access: access as StaffAccess }
    : null;
}

function asStaffShift(raw: unknown): StaffShift | null {
  if (!isRecord(raw)) return null;
  const { id, job, startsAt, endsAt, needed, people } = raw;

  return typeof id === 'string' &&
    typeof job === 'string' &&
    typeof startsAt === 'string' &&
    typeof endsAt === 'string' &&
    typeof needed === 'number' &&
    strings(people)
    ? { id, job, startsAt, endsAt, needed, people }
    : null;
}

function every<T>(raw: unknown, read: (one: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw.map(read);

  return rows.every((row) => row != null) ? (rows as T[]) : null;
}

/** The roster, jobs and shifts, or null when any row is not one this client knows. */
export function asStaffPlan(raw: unknown): StaffPlan | null {
  if (!isRecord(raw)) return null;
  const staff = every(raw.staff, asStaffEntry);
  const jobs = every(raw.jobs, asStaffJob);
  const shifts = every(raw.shifts, asStaffShift);

  return staff == null || jobs == null || shifts == null ? null : { staff, jobs, shifts };
}

/** The whole roster in roster order, or null when any row is not one this client knows. */
export function asStaffRoster(raw: unknown): StaffEntry[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.staff)) return null;
  const rows = raw.staff.map(asStaffEntry);

  return rows.every((row) => row != null) ? (rows as StaffEntry[]) : null;
}
