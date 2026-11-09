import { CLOCK, ORG, dayOf } from './dataControl.ts';
import { writtenTime } from './clock.ts';
import { type ReaderZone, zoneWord } from './dataSettings.ts';
import { SAMPLE } from './rules.ts';
import { VIEWERS } from './settings.ts';

export const TYPES = [
  'Events',
  'Event access',
  'Members and invitations',
  'Sign-in and security',
  'Organisation',
  'Audit log',
] as const;

export type EntryType = (typeof TYPES)[number];

export interface Entry {
  id: string;
  at: string;
  what: string;
  who: string;
  type: EntryType;
  action: string;
  reference: string;
  on?: { name: string; event?: string; gone?: boolean };
  changes?: string;
  address?: string;
  device?: string;
}

export const SYSTEM = 'System';
export const PEOPLE = [
  { name: VIEWERS.folake.name, email: VIEWERS.folake.id, left: false },
  { name: VIEWERS.julien.name, email: VIEWERS.julien.id, left: false },
  { name: 'Priya Shah', email: 'priya@ire.events', left: false },
  { name: VIEWERS.ana.name, email: VIEWERS.ana.id, left: false },
  { name: 'Tom Becker', email: 'tom.becker@gmail.com', left: false },
  { name: 'Marta Silva', email: 'marta.silva@ire.events', left: true },
] as const;

export const EVENTS = [
  { name: 'Adaeze & Tunde’s wedding', id: 'evt-wed-4' },
  { name: 'Ireti at 40', id: 'evt-ireti-2' },
  { name: 'Tola & Seun’s wedding', id: null },
] as const;

const FOLAKE = VIEWERS.folake.name;
const JULIEN = VIEWERS.julien.name;
const ADDRESS = '203.0.113.17';

/** Newest first, as the boards list them; the seconds, codes and references the spec leaves out are the sample's. */
export const ENTRIES: readonly Entry[] = [
  {
    id: 'download',
    at: '2026-10-19T10:05:31+01:00',
    what: `Downloaded ${ORG}’ data`,
    who: FOLAKE,
    type: 'Organisation',
    action: 'organisation.export_downloaded',
    reference: '5b0e2d71-8c4a-4f3e-b1d9-2e6a7c90f413',
  },
  {
    id: 'asked',
    at: '2026-10-19T09:30:08+01:00',
    what: `Asked for an export of ${ORG}’ data`,
    who: FOLAKE,
    type: 'Organisation',
    action: 'organisation.export_requested',
    reference: '9e47c1a2-3d5f-4b80-a6e2-71c9f0d84b26',
  },
  {
    id: 'access',
    at: '2026-10-19T08:15:52+01:00',
    what: 'Added Tom Becker to Adaeze & Tunde’s wedding as Can check guests in',
    who: 'Priya Shah',
    type: 'Event access',
    action: 'event_access.granted',
    reference: '2f8a6c03-71e4-4d9b-8c5a-0b3e9f6d1a72',
    on: { name: 'Adaeze & Tunde’s wedding', event: 'evt-wed-4' },
  },
  {
    id: 'retention',
    at: '2026-10-17T14:20:03+01:00',
    what: 'Turned on deleting guest data 90 days after an event',
    who: FOLAKE,
    type: 'Organisation',
    action: 'organisation.retention_changed',
    reference: 'd61b9e4f-0a27-4c83-9f15-6e8d2b7a3c50',
    changes: 'Delete guest data after an event: Off → 90 days',
  },
  {
    id: 'live',
    at: '2026-10-17T09:12:44+01:00',
    what: 'Made Ireti at 40 live',
    who: FOLAKE,
    type: 'Events',
    action: 'event.made_live',
    reference: 'c41e9a7b-2f6d-4b1e-9a53-7d0e6c2b8f14',
    on: { name: 'Ireti at 40', event: 'evt-ireti-2' },
    changes: 'Live: Off → On',
  },
  {
    id: 'invited',
    at: '2026-10-16T18:05:17+01:00',
    what: 'Invited nnamdi.eze@ire.events as Member',
    who: JULIEN,
    type: 'Members and invitations',
    action: 'invitation.created',
    reference: '7a3d5e90-b6c1-4f28-8d47-c0e2a19f6b35',
  },
  {
    id: 'signIn',
    at: '2026-10-16T16:48:26+01:00',
    what: 'Changed the sign-in rules: everyone needs two-factor',
    who: FOLAKE,
    type: 'Sign-in and security',
    action: 'sign_in_rules.changed',
    reference: '0c9f2b18-4e6a-4d73-b25e-8a1f7d3c6e09',
    on: { name: `${ORG}’ sign-in rules` },
    changes: 'Everyone needs two-factor: Off → On',
    address: ADDRESS,
    device: 'Safari on macOS',
  },
  {
    id: 'domainAdded',
    at: '2026-10-16T16:45:09+01:00',
    what: 'Added ireevents.com to Email domains',
    who: JULIEN,
    type: 'Sign-in and security',
    action: 'email_domain.added',
    reference: 'e83a7f25-6b9d-4c10-a4e8-3f5b2d0c9a61',
    address: ADDRESS,
  },
  {
    id: 'held',
    at: '2026-10-16T11:05:40+01:00',
    what: 'Held back Tola & Seun’s wedding from deleting guest data',
    who: JULIEN,
    type: 'Organisation',
    action: 'organisation.retention_held',
    reference: '4d2c8e6a-9f17-4b35-8e0d-a7b1c3f59e28',
    on: { name: 'Tola & Seun’s wedding' },
  },
  {
    id: 'proved',
    at: '2026-10-06T11:02:00+01:00',
    what: 'Proved ire.events',
    who: SYSTEM,
    type: 'Sign-in and security',
    action: 'email_domain.proved',
    reference: 'a95f0c3e-2d81-4e6b-9c7a-1b8e4d2f0c37',
  },
  {
    id: 'deleted',
    at: '2026-10-06T10:40:22+01:00',
    what: 'Deleted Bisi & Kola’s engagement',
    who: JULIEN,
    type: 'Events',
    action: 'event.deleted',
    reference: '6f1e3b9d-c4a7-4082-b6f5-9d2a0e7c8b14',
    on: { name: 'Bisi & Kola’s engagement', gone: true },
  },
];

export interface Filters {
  person: string | null;
  type: EntryType | null;
  event: string | null;
  from: string;
  to: string;
}

export const NO_FILTERS: Filters = { person: null, type: null, event: null, from: '', to: '' };

export const AUDIT_WORDS = {
  title: 'Audit log',
  says: `Who did what in ${ORG}`,
  line: 'Kept for 365 days. Nobody can change or delete an entry.',
  exportStep: 'Export these entries',
  anyone: 'Anyone',
  allTypes: 'All types',
  allEvents: 'All events',
  lastYear: 'Last 365 days',
  person: 'Person',
  type: 'Type',
  event: 'Event',
  clear: 'Clear filters',
  noMatch: 'No entry matches these filters.',
  dates: 'Dates',
  from: 'From',
  to: 'To',
  apply: 'Apply',
  backwards: 'The start date must be on or before the end date.',
  entry: 'Entry',
  done: 'Done',
  when: 'When',
  who: 'Who',
  what: 'What',
  on: 'On',
  changes: 'Changes',
  typeAndAction: 'Type and action',
  address: 'Network address',
  device: 'Device',
  reference: 'Reference',
  fixed: 'Nobody can change or delete an entry.',
  gone: 'no longer exists',
  left: 'left',
  format: 'Format',
  export: 'Export',
  exportLine: 'Up to 10,000 entries download at once. More are prepared, and we email you a link.',
  preparing: 'Preparing your export',
  preparingLine: `We’ll email ${SAMPLE.email} a link when it’s ready. It works once, for 24 hours.`,
  tooMany: 'More than 1,000,000 entries match. Narrow the filters, then export again.',
  locked: 'Available on Enterprise',
  lockedLine: `See who did what in ${ORG}, for 365 days, and export it.`,
  loading: 'Loading the audit log…',
  failed: 'We could not load the audit log.',
} as const;

export const FORMATS = ['CSV', 'JSON Lines'] as const;
export type Format = (typeof FORMATS)[number];

export const AT_ONCE = 10_000;
export const AT_MOST = 1_000_000;

/** Up to 10,000 download at once; up to a million are prepared and emailed; more start nothing. */
export function exportOutcome(count: number): 'download' | 'prepare' | 'tooMany' {
  if (count <= AT_ONCE) return 'download';

  return count <= AT_MOST ? 'prepare' : 'tooMany';
}

export function downloading(format: Format): string {
  return `Downloading the audit log as ${format}.`;
}

/** The day an instant falls on in the reader's zone, as YYYY-MM-DD. */
export function dayIn(at: string, zone: ReaderZone): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone ?? 'UTC' }).format(new Date(at));
}

export function datesFault(from: string, to: string): string | null {
  return from !== '' && to !== '' && from > to ? AUDIT_WORDS.backwards : null;
}

export function matching(
  entries: readonly Entry[],
  filters: Filters,
  zone: ReaderZone = 'Africa/Lagos',
): Entry[] {
  return entries.filter(
    (entry) =>
      (filters.person == null || entry.who === filters.person) &&
      (filters.type == null || entry.type === filters.type) &&
      (filters.event == null || entry.on?.name === filters.event) &&
      (filters.from === '' || dayIn(entry.at, zone) >= filters.from) &&
      (filters.to === '' || dayIn(entry.at, zone) <= filters.to),
  );
}

export function filtered(filters: Filters): boolean {
  return (
    filters.person != null ||
    filters.type != null ||
    filters.event != null ||
    filters.from !== '' ||
    filters.to !== ''
  );
}

export interface Day {
  day: string;
  heading: string;
  entries: Entry[];
}

/** The entries by day, newest first, today's heading saying so. */
export function byDay(entries: readonly Entry[], locale: string, zone: ReaderZone): Day[] {
  const today = dayIn(CLOCK.now, zone);
  const days: Day[] = [];

  for (const entry of entries) {
    const day = dayIn(entry.at, zone);
    const last = days.at(-1);

    if (last?.day === day) last.entries.push(entry);
    else
      days.push({
        day,
        heading:
          day === today
            ? `Today · ${dayOf(entry.at, locale, zone)}`
            : dayOf(entry.at, locale, zone),
        entries: [entry],
      });
  }

  return days;
}

export function timeOf(entry: Entry, locale: string, zone: ReaderZone): string {
  return writtenTime(entry.at, locale, zone ?? 'UTC');
}

export function rangeWords(filters: Pick<Filters, 'from' | 'to'>, locale: string): string {
  if (filters.from === '' && filters.to === '') return AUDIT_WORDS.lastYear;

  const day = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${date}T00:00Z`),
    );

  return `${filters.from === '' ? '…' : day(filters.from)} to ${filters.to === '' ? '…' : day(filters.to)}`;
}

export interface Fact {
  label: string;
  value: string;
  code?: boolean;
  link?: string;
}

/** An entry's detail: what it records, and only what it records. */
export function factsOf(entry: Entry, locale: string, zone: ReaderZone): Fact[] {
  const seconds = String(new Date(entry.at).getUTCSeconds()).padStart(2, '0');
  const stamp = `${dayOf(entry.at, locale, zone, true)} at ${timeOf(entry, locale, zone)}:${seconds} ${zoneWord(entry.at, zone)}`;
  const person = PEOPLE.find((one) => one.name === entry.who);
  const facts: Fact[] = [
    { label: AUDIT_WORDS.when, value: stamp },
    {
      label: AUDIT_WORDS.who,
      value: person == null ? entry.who : `${entry.who} · ${person.email}`,
    },
    { label: AUDIT_WORDS.what, value: entry.what },
  ];

  if (entry.on != null)
    facts.push({
      label: AUDIT_WORDS.on,
      value: entry.on.gone === true ? `${entry.on.name} · ${AUDIT_WORDS.gone}` : entry.on.name,
      ...(entry.on.event == null ? {} : { link: `/demo/events/${entry.on.event}` }),
    });
  if (entry.changes != null) facts.push({ label: AUDIT_WORDS.changes, value: entry.changes });
  facts.push({ label: AUDIT_WORDS.typeAndAction, value: `${entry.type} · ${entry.action}` });
  if (entry.address != null)
    facts.push({ label: AUDIT_WORDS.address, value: entry.address, code: true });
  if (entry.device != null) facts.push({ label: AUDIT_WORDS.device, value: entry.device });
  facts.push({ label: AUDIT_WORDS.reference, value: entry.reference, code: true });

  return facts;
}

export type AuditMenu = 'person' | 'type' | 'event';

export interface AuditStart {
  load: 'loaded' | 'loading' | 'failed';
  locked: boolean;
  filters: Filters;
  menu: AuditMenu | null;
  dates: { from: string; to: string } | null;
  detail: string | null;
  exporting: 'asking' | 'tooMany' | null;
  preparing: boolean;
  told: string | null;
}

export const AUDIT_STATES = [
  'list',
  'filter_person',
  'filter_type',
  'filter_event',
  'dates',
  'date_invalid',
  'filtered',
  'empty_filter',
  'detail',
  'detail_gone',
  'detail_signin',
  'detail_old',
  'detail_system',
  'export',
  'export_small',
  'export_preparing',
  'export_too_many',
  'locked',
  'loading',
  'failed',
] as const;

const DETAILS: Record<string, string> = {
  detail: 'live',
  detail_gone: 'deleted',
  detail_signin: 'signIn',
  detail_old: 'domainAdded',
  detail_system: 'proved',
};

export function auditStart(state: string): AuditStart {
  const start: AuditStart = {
    load: 'loaded',
    locked: false,
    filters: NO_FILTERS,
    menu: null,
    dates: null,
    detail: null,
    exporting: null,
    preparing: false,
    told: null,
  };

  switch (state) {
    case 'filter_person':
      return { ...start, menu: 'person' };
    case 'filter_type':
      return { ...start, menu: 'type' };
    case 'filter_event':
      return { ...start, menu: 'event' };
    case 'dates':
      return {
        ...start,
        filters: { ...NO_FILTERS, from: '2026-10-01', to: '2026-10-19' },
        dates: { from: '2026-10-01', to: '2026-10-19' },
      };
    case 'date_invalid':
      return { ...start, dates: { from: '2026-10-19', to: '2026-10-01' } };
    case 'filtered':
      return { ...start, filters: { ...NO_FILTERS, type: 'Sign-in and security' } };
    case 'empty_filter':
      return { ...start, filters: { ...NO_FILTERS, person: VIEWERS.ana.name, type: 'Events' } };
    case 'export':
      return { ...start, exporting: 'asking' };
    case 'export_small':
      return { ...start, told: downloading('CSV') };
    case 'export_too_many':
      return { ...start, exporting: 'tooMany' };
    case 'export_preparing':
      return { ...start, preparing: true };
    case 'locked':
      return { ...start, locked: true };
    case 'loading':
    case 'failed':
      return { ...start, load: state };
    default:
      return { ...start, detail: DETAILS[state] ?? null };
  }
}
