/** An event's roster as the API answers and the hub publishes it (sc-3906). */

export type StaffLink = 'none' | 'no_mobile' | 'erased';

export interface StaffEntry {
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  job: string | null;
  station: string | null;
  shift: string | null;
  link: StaffLink;
  contactsErased: boolean;
}

export interface StaffDetails {
  fullName: string;
  mobile?: { countryCode: string; number: string } | null;
  email?: string | null;
  allowShared?: boolean;
}

export interface StaffAnswer {
  staff: StaffEntry;
  member: string | null;
}

/** The API's StaffMember::NAME_MAXIMUM, in visible characters. */
export const STAFF_NAME_MAXIMUM = 200;

const LINKS: readonly StaffLink[] = ['none', 'no_mobile', 'erased'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

export function asStaffEntry(raw: unknown): StaffEntry | null {
  if (!isRecord(raw)) return null;
  const { id, fullName, mobile, email, job, station, shift, link, contactsErased } = raw;

  if (
    typeof id !== 'string' ||
    typeof fullName !== 'string' ||
    !text(mobile) ||
    !text(email) ||
    !text(job) ||
    !text(station) ||
    !text(shift) ||
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
    shift,
    link: link as StaffLink,
    contactsErased,
  };
}

/** The whole roster in roster order, or null when any row is not one this client knows. */
export function asStaffRoster(raw: unknown): StaffEntry[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.staff)) return null;
  const rows = raw.staff.map(asStaffEntry);

  return rows.every((row) => row != null) ? (rows as StaffEntry[]) : null;
}
