/** An event's roster (sc-3906), with its jobs and shifts (sc-3908), as the API answers and the hub publishes it. Every time is an instant with the event's offset. */

export type StaffLink = 'none' | 'no_mobile' | 'erased';

export type StaffAccess = 'view' | 'check_in' | 'floor' | 'pass' | 'run';

export const STAFF_ACCESS: readonly StaffAccess[] = ['view', 'check_in', 'floor', 'pass', 'run'];

export interface StaffEntryShift {
  id: string;
  startsAt: string;
  endsAt: string;
}

export type StationKind = 'place' | 'section';

/** A seating table, by the seating plan's id and name. */
export interface StationTable {
  id: string;
  name: string;
}

/** A section's `name` is bare ("Section A"); the client writes its table count beside it. A place has no tables. */
export interface StationRef {
  id: string;
  name: string;
  kind: StationKind;
  tables: StationTable[];
}

export interface StaffEntry {
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  job: { id: string; name: string } | null;
  station: StationRef | null;
  stations: StationRef[];
  stationRemoved: string | null;
  leads: boolean;
  floorLead: boolean;
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

export interface StationPlace {
  id: string;
  name: string;
  pass: boolean;
  people: string[];
  lead: string | null;
  dishes: number;
}

export interface StationSection {
  id: string;
  name: string;
  tables: StationTable[];
  people: string[];
  lead: string | null;
}

/** `dishedAt` is a place id, the Pass's when the item has none. */
export interface StationCourse {
  id: string;
  name: string;
  items: { name: string; dishedAt: string }[];
}

/** Places come Pass first; `walk` is the kitchen places after the Pass, never the Pass itself. */
export interface StaffStations {
  places: StationPlace[];
  sections: StationSection[];
  floorLead: string | null;
  courses: StationCourse[];
  walk: string[];
}

export interface StaffPlan {
  staff: StaffEntry[];
  jobs: StaffJob[];
  shifts: StaffShift[];
  stations: StaffStations;
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

/** The API's station place name limit, in visible characters (sc-3910). */
export const STATION_NAME_MAXIMUM = 60;

/** The API's StaffShift::NEEDED_MAXIMUM. */
export const SHIFT_NEEDED_MAXIMUM = 50;

const LINKS: readonly StaffLink[] = ['none', 'no_mobile', 'erased'];

const KINDS: readonly StationKind[] = ['place', 'section'];

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

function asStationTable(raw: unknown): StationTable | null {
  if (!isRecord(raw)) return null;
  const { id, name } = raw;

  return typeof id === 'string' && typeof name === 'string' ? { id, name } : null;
}

function asStationRef(raw: unknown): StationRef | null {
  if (!isRecord(raw)) return null;
  const { id, name, kind } = raw;
  const tables = every(raw.tables, asStationTable);

  return typeof id === 'string' &&
    typeof name === 'string' &&
    KINDS.includes(kind as StationKind) &&
    tables != null
    ? { id, name, kind: kind as StationKind, tables }
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
  const { id, fullName, mobile, email, stationRemoved, leads, floorLead, link, contactsErased } =
    raw;
  const job = asJobRef(raw.job);
  const station = raw.station === null ? null : asStationRef(raw.station);
  const stations = every(raw.stations, asStationRef);
  const shifts = Array.isArray(raw.shifts) ? raw.shifts.map(asEntryShift) : null;

  if (
    typeof id !== 'string' ||
    typeof fullName !== 'string' ||
    !text(mobile) ||
    !text(email) ||
    job === undefined ||
    (raw.station !== null && station == null) ||
    stations == null ||
    !text(stationRemoved) ||
    typeof leads !== 'boolean' ||
    typeof floorLead !== 'boolean' ||
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
    stations,
    stationRemoved,
    leads,
    floorLead,
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

function asStationPlace(raw: unknown): StationPlace | null {
  if (!isRecord(raw)) return null;
  const { id, name, pass, people, lead, dishes } = raw;

  return typeof id === 'string' &&
    typeof name === 'string' &&
    typeof pass === 'boolean' &&
    strings(people) &&
    text(lead) &&
    typeof dishes === 'number'
    ? { id, name, pass, people, lead, dishes }
    : null;
}

function asStationSection(raw: unknown): StationSection | null {
  if (!isRecord(raw)) return null;
  const { id, name, people, lead } = raw;
  const tables = every(raw.tables, asStationTable);

  return typeof id === 'string' &&
    typeof name === 'string' &&
    tables != null &&
    strings(people) &&
    text(lead)
    ? { id, name, tables, people, lead }
    : null;
}

function asCourseItem(raw: unknown): { name: string; dishedAt: string } | null {
  if (!isRecord(raw)) return null;
  const { name, dishedAt } = raw;

  return typeof name === 'string' && typeof dishedAt === 'string' ? { name, dishedAt } : null;
}

function asStationCourse(raw: unknown): StationCourse | null {
  if (!isRecord(raw)) return null;
  const { id, name } = raw;
  const items = every(raw.items, asCourseItem);

  return typeof id === 'string' && typeof name === 'string' && items != null
    ? { id, name, items }
    : null;
}

export function asStaffStations(raw: unknown): StaffStations | null {
  if (!isRecord(raw)) return null;
  const places = every(raw.places, asStationPlace);
  const sections = every(raw.sections, asStationSection);
  const courses = every(raw.courses, asStationCourse);
  const { floorLead, walk } = raw;

  return places == null || sections == null || courses == null || !text(floorLead) || !strings(walk)
    ? null
    : { places, sections, floorLead, courses, walk };
}

/** The roster, jobs, shifts and stations, or null when any row is not one this client knows. */
export function asStaffPlan(raw: unknown): StaffPlan | null {
  if (!isRecord(raw)) return null;
  const staff = every(raw.staff, asStaffEntry);
  const jobs = every(raw.jobs, asStaffJob);
  const shifts = every(raw.shifts, asStaffShift);
  const stations = asStaffStations(raw.stations);

  return staff == null || jobs == null || shifts == null || stations == null
    ? null
    : { staff, jobs, shifts, stations };
}

/** The whole roster in roster order, or null when any row is not one this client knows. */
export function asStaffRoster(raw: unknown): StaffEntry[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.staff)) return null;
  const rows = raw.staff.map(asStaffEntry);

  return rows.every((row) => row != null) ? (rows as StaffEntry[]) : null;
}
