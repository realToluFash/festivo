import { type PhoneHint, asPhoneHint } from './phoneHint.ts';

/** An event's roster (sc-3906), with its jobs and shifts (sc-3908), as the API answers and the hub publishes it. Every time is an instant with the event's offset. */

/** How far a person's own link got (sc-3912), or why none can be given. */
export type StaffLink = 'none' | 'copied' | 'sent' | 'opened' | 'no_mobile' | 'erased';

/** Where a person's briefing stands (sc-3917): Changed since sent is a briefed person whose station, shift or lead moved since. */
export type StaffBriefing = 'none' | 'sent' | 'read' | 'changed';

/** The last copy of a person's link from the briefing, and whether it was then marked as sent; `by` is who copied or marked it. */
export interface StaffBriefingCopy {
  by: string | null;
  at: string;
  marked: boolean;
}

export type StaffChangeKind =
  | 'start_time'
  | 'end_time'
  | 'shift_added'
  | 'shift_removed'
  | 'shift_retimed'
  | 'more_changes'
  | 'no_shift_left'
  | 'job'
  | 'date'
  | 'venue';

const CHANGE_KINDS: readonly StaffChangeKind[] = [
  'start_time',
  'end_time',
  'shift_added',
  'shift_removed',
  'shift_retimed',
  'more_changes',
  'no_shift_left',
  'job',
  'date',
  'venue',
];

/** One line of a change notice waiting to go (sc-4333): shift lines carry instants, a start or end time line its new time in `start` and its old in `oldStart`, the job and venue lines names, the date line days, More changes a count. */
export interface StaffChange {
  kind: StaffChangeKind;
  start: string | null;
  end: string | null;
  oldStart: string | null;
  oldEnd: string | null;
  /** The start of the shift a start or end time line belongs to, which a time on another day names. */
  on: string | null;
  new: string | null;
  old: string | null;
  count: number;
}

/** Where a person's change notice stands (sc-4333), for the roster's Briefing column; null before their briefing went and whenever push has not reached them, so the row stays sc-3917's. */
export type StaffNotice =
  | { state: 'waiting'; goesAt: string; changes: StaffChange[] }
  | { state: 'told'; at: string; channel: string; ending: StaffNoticeEnding | null };

/** The call-off's or End now's notice, when that is what told them. */
export type StaffNoticeEnding = 'called_off' | 'ended';

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
  /** Who copied or marked it as sent; null for Opened and No link yet. */
  linkBy: string | null;
  linkAt: string | null;
  briefing: StaffBriefing;
  briefingCopy: StaffBriefingCopy | null;
  contactsErased: boolean;
  notice: StaffNotice | null;
  /** Signed in to the app with notifications allowed, so a change notice reaches them by push (sc-4333). */
  inApp: boolean;
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
  /** The house rules (sc-3917), shown as Before you start on everyone's shift page. */
  rules: string | null;
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

/** The API's Event::STAFF_RULES_MAXIMUM, in code points (sc-3917). */
export const STAFF_RULES_MAXIMUM = 2000;

/** The API's StaffShift::NEEDED_MAXIMUM. */
export const SHIFT_NEEDED_MAXIMUM = 50;

const LINKS: readonly StaffLink[] = ['none', 'copied', 'sent', 'opened', 'no_mobile', 'erased'];

const KINDS: readonly StationKind[] = ['place', 'section'];

const BRIEFINGS: readonly StaffBriefing[] = ['none', 'sent', 'read', 'changed'];

function asBriefingCopy(raw: unknown): StaffBriefingCopy | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const { by, at, marked } = raw;

  return text(by) && typeof at === 'string' && typeof marked === 'boolean'
    ? { by, at, marked }
    : undefined;
}

function asChange(raw: unknown): StaffChange | null {
  if (!isRecord(raw)) return null;
  const { kind, start, end, oldStart, oldEnd, count } = raw;
  const on = raw.on ?? null;

  return CHANGE_KINDS.includes(kind as StaffChangeKind) &&
    text(start) &&
    text(end) &&
    text(oldStart) &&
    text(oldEnd) &&
    text(raw.new) &&
    text(raw.old) &&
    text(on) &&
    typeof count === 'number'
    ? {
        kind: kind as StaffChangeKind,
        start,
        end,
        oldStart,
        oldEnd,
        new: raw.new,
        old: raw.old,
        count,
        on,
      }
    : null;
}

function asNotice(raw: unknown): StaffNotice | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return undefined;

  switch (raw.state) {
    case 'waiting': {
      const changes = every(raw.changes, asChange);

      return typeof raw.goesAt === 'string' && changes != null
        ? { state: 'waiting', goesAt: raw.goesAt, changes }
        : undefined;
    }
    case 'told': {
      const ending = raw.ending ?? null;

      return typeof raw.at === 'string' &&
        typeof raw.channel === 'string' &&
        (ending === null || ending === 'called_off' || ending === 'ended')
        ? { state: 'told', at: raw.at, channel: raw.channel, ending }
        : undefined;
    }
    default:
      return undefined;
  }
}

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
  const {
    id,
    fullName,
    mobile,
    email,
    stationRemoved,
    leads,
    floorLead,
    link,
    linkBy,
    linkAt,
    briefing,
    contactsErased,
    inApp,
  } = raw;
  const job = asJobRef(raw.job);
  const briefingCopy = asBriefingCopy(raw.briefingCopy);
  const notice = asNotice(raw.notice);
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
    !text(linkBy) ||
    !text(linkAt) ||
    !BRIEFINGS.includes(briefing as StaffBriefing) ||
    briefingCopy === undefined ||
    notice === undefined ||
    typeof contactsErased !== 'boolean' ||
    typeof inApp !== 'boolean'
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
    linkBy,
    linkAt,
    briefing: briefing as StaffBriefing,
    briefingCopy,
    contactsErased,
    notice,
    inApp,
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
  const { rules } = raw;

  return staff == null || jobs == null || shifts == null || stations == null || !text(rules)
    ? null
    : { staff, jobs, shifts, stations, rules };
}

/** The whole roster in roster order, or null when any row is not one this client knows. */
export function asStaffRoster(raw: unknown): StaffEntry[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.staff)) return null;
  const rows = raw.staff.map(asStaffEntry);

  return rows.every((row) => row != null) ? (rows as StaffEntry[]) : null;
}

/** Who a link's open page is read by (sc-4235): the entry's own account, another one, or nobody signed in. */
export type StaffLinkReader = 'yours' | 'other' | null;

/** An open link before its code (sc-4235): the event and the job, the number masked, and the roster entry's name only for another signed-in account. */
export interface OpenStaffLink {
  state: 'open';
  event: string;
  job: string | null;
  mobile: PhoneHint | null;
  reader: StaffLinkReader;
  name: string | null;
  /** Read by the entry's own account in a browser: when its session ends, in the event's offset (sc-4235). */
  signedOutAt: string | null;
  /** The event's zone, for the entry's own account alone. */
  timeZone: string | null;
  /** Past the person's access while still clocked in (sc-234): the link opens their clock card alone. */
  pastAccess: boolean;
}

/** Where a person's own link stands (sc-3912). Nothing about the person or the event reaches a caller before sign-in (sc-4235) beyond what an open link shows, and when one opens, in the event's offset; `from` is null while they have no shift. */
export type StaffLinkWindow =
  OpenStaffLink | { state: 'ended' } | { state: 'not_yet'; from: string | null };

export function asStaffLinkWindow(raw: unknown): StaffLinkWindow | null {
  if (typeof raw !== 'object' || raw == null || !('state' in raw)) return null;
  if (raw.state === 'open') return asOpenStaffLink(raw as Record<string, unknown>);
  if (raw.state === 'ended') return { state: raw.state };
  if (raw.state === 'not_yet') {
    if (!('from' in raw)) return { state: 'not_yet', from: null };
    if (typeof raw.from === 'string') return { state: 'not_yet', from: raw.from };
  }

  return null;
}

function asOpenStaffLink(raw: Record<string, unknown>): OpenStaffLink | null {
  const event = raw.event as Record<string, unknown> | null | undefined;
  if (typeof event?.name !== 'string') return null;
  const reader = raw.reader === 'yours' || raw.reader === 'other' ? raw.reader : null;

  return {
    state: 'open',
    event: event.name,
    job: typeof raw.job === 'string' ? raw.job : null,
    mobile: asPhoneHint(raw.mobile),
    reader,
    name: reader === 'other' && typeof raw.name === 'string' ? raw.name : null,
    signedOutAt: reader === 'yours' && typeof raw.signedOutAt === 'string' ? raw.signedOutAt : null,
    timeZone: reader === 'yours' && typeof raw.timeZone === 'string' ? raw.timeZone : null,
    pastAccess: raw.pastAccess === true,
  };
}

/** The staffing page's Reminder the day before card (sc-4333): days are the event's calendar days, `next.date` the day the reminder goes, and `sent` only once the last day's reminder has gone. */
export interface StaffReminder {
  on: boolean;
  time: string;
  next: { date: string; count: number } | null;
  notBriefed: number;
  unreachable: number;
  sent: { date: string; count: number } | null;
  concluded: 'called_off' | 'ended' | null;
}

function asDayCount(raw: unknown): { date: string; count: number } | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;

  return typeof raw.date === 'string' && typeof raw.count === 'number'
    ? { date: raw.date, count: raw.count }
    : undefined;
}

export function asStaffReminder(raw: unknown): StaffReminder | null {
  if (!isRecord(raw)) return null;
  const { on, time, notBriefed, unreachable, concluded } = raw;
  const next = asDayCount(raw.next);
  const sent = asDayCount(raw.sent);

  if (
    typeof on !== 'boolean' ||
    typeof time !== 'string' ||
    next === undefined ||
    sent === undefined ||
    typeof notBriefed !== 'number' ||
    typeof unreachable !== 'number' ||
    !(concluded === null || concluded === 'called_off' || concluded === 'ended')
  )
    return null;

  return { on, time, next, notBriefed, unreachable, sent, concluded };
}
