/** The audit log's types, exactly as sc-611 has them; Guests arrives with sc-30193. */
export const AUDIT_TYPES = [
  'Events',
  'Event access',
  'Members and invitations',
  'Sign-in and security',
  'Organisation',
  'Audit log',
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export interface AuditEntry {
  id: string;
  at: string;
  what: string;
  who: string;
  /** The person's address now; none for System. */
  whoEmail: string | null;
  type: AuditType;
  action: string;
  on: { name: string; eventId: string | null; gone: boolean };
  /** The event it is on, for the Event filter. */
  event: string | null;
  changes: string | null;
  address: string | null;
  device: string | null;
  reference: string;
}

const FOLAKE = { who: 'Folake Adeyemi', whoEmail: 'folake@ire.events' };
const JULIEN = { who: 'Julien Moreau', whoEmail: 'julien@ire.events' };
const PRIYA = { who: 'Priya Shah', whoEmail: 'priya@ire.events' };
const ORGANISATION = { name: 'Ire Events', eventId: null, gone: false };
const quiet = { event: null, changes: null, address: null, device: null };

export const WEDDING = 'Adaeze & Tunde’s wedding';
export const IRETI = 'Ireti at 40';
export const TOLA = 'Tola & Seun’s wedding';
export const BISI = 'Bisi & Kola’s engagement';

/** Newest first, the instants in UTC: Lagos is an hour ahead. */
export const ENTRIES: readonly AuditEntry[] = [
  {
    ...quiet,
    ...FOLAKE,
    id: 'downloaded',
    at: '2026-10-19T09:05:18Z',
    what: 'Downloaded Ire Events’ data',
    type: 'Organisation',
    action: 'data_export.downloaded',
    on: ORGANISATION,
    reference: '5e2b7c90-1d4a-4f6e-8b3c-2a9d7e1f4c58',
  },
  {
    ...quiet,
    ...FOLAKE,
    id: 'asked',
    at: '2026-10-19T08:30:02Z',
    what: 'Asked for an export of Ire Events’ data',
    type: 'Organisation',
    action: 'data_export.requested',
    on: ORGANISATION,
    reference: '9a4f1e27-6c3b-4d8a-b5e2-7f0c3d9a1b64',
  },
  {
    ...quiet,
    ...PRIYA,
    id: 'access',
    at: '2026-10-19T07:15:41Z',
    what: `Added Tom Becker to ${WEDDING} as Can check guests in`,
    type: 'Event access',
    action: 'event_access.granted',
    on: { name: WEDDING, eventId: 'evt-wed-4', gone: false },
    event: WEDDING,
    reference: 'd7c3a815-2e9f-4b6d-a1c4-8e5b2f7d0a93',
  },
  {
    ...quiet,
    ...FOLAKE,
    id: 'retention',
    at: '2026-10-17T13:20:09Z',
    what: 'Turned on deleting guest data 90 days after an event',
    type: 'Organisation',
    action: 'retention.turned_on',
    on: ORGANISATION,
    reference: '3b8e6d24-7f1a-4c9e-9d2b-5a4c1e8f7b06',
  },
  {
    ...quiet,
    ...FOLAKE,
    id: 'live',
    at: '2026-10-17T08:12:44Z',
    what: `Made ${IRETI} live`,
    type: 'Events',
    action: 'event.made_live',
    on: { name: IRETI, eventId: 'evt-ireti-2', gone: false },
    event: IRETI,
    changes: 'Live: Off → On',
    reference: 'c41e9a7b-2f6d-4b1e-9a53-7d0e6c2b8f14',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'invited',
    at: '2026-10-16T17:05:27Z',
    what: 'Invited nnamdi.eze@ire.events as Member',
    type: 'Members and invitations',
    action: 'invitation.sent',
    on: ORGANISATION,
    reference: '6f1d9b3e-8a2c-4e7f-b0d5-3c6a9e2f1d87',
  },
  {
    ...quiet,
    ...FOLAKE,
    id: 'rules',
    at: '2026-10-16T15:48:13Z',
    what: 'Changed the sign-in rules: everyone needs two-factor',
    type: 'Sign-in and security',
    action: 'sign_in_rules.changed',
    on: { name: 'Ire Events’ sign-in rules', eventId: null, gone: false },
    changes: 'Everyone needs two-factor: Off → On',
    address: '102.89.34.17',
    device: 'Safari on macOS',
    reference: 'a2e7f4c1-5b9d-4a3e-8c6f-1d0b7e4a9c25',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'added',
    at: '2026-10-16T15:45:06Z',
    what: 'Added ireevents.com to Email domains',
    type: 'Sign-in and security',
    action: 'email_domain.added',
    on: { name: 'ireevents.com', eventId: null, gone: false },
    address: '102.89.34.17',
    reference: 'e8b1c6d3-4f2a-4b7e-a9d0-6c5e3f1b8a72',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'held',
    at: '2026-10-16T10:05:52Z',
    what: `Held back ${TOLA} from deleting guest data`,
    type: 'Organisation',
    action: 'retention.event_held',
    on: { name: TOLA, eventId: null, gone: false },
    event: TOLA,
    reference: '1c9f5a8e-3d7b-4e2c-b6a1-9f4d2e7c0b38',
  },
  {
    ...quiet,
    id: 'proved',
    at: '2026-10-06T10:02:00Z',
    what: 'Proved ire.events',
    who: 'System',
    whoEmail: null,
    type: 'Sign-in and security',
    action: 'email_domain.proved',
    on: { name: 'ire.events', eventId: null, gone: false },
    reference: '7d4a2e9c-6b1f-4c8d-a3e5-0f9b8c2d6e41',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'deleted',
    at: '2026-10-06T09:40:35Z',
    what: `Deleted ${BISI}`,
    type: 'Events',
    action: 'event.deleted',
    on: { name: BISI, eventId: null, gone: true },
    event: BISI,
    reference: 'b5f0e3a7-9c2d-4f6b-8e1a-4d7c9b3f2e60',
  },
];

/** The Person menu: Anyone, then the members, then anybody gone, marked as left. */
export const AUDIT_PEOPLE: readonly { name: string; left: boolean }[] = [
  { name: 'Folake Adeyemi', left: false },
  { name: 'Julien Moreau', left: false },
  { name: 'Priya Shah', left: false },
  { name: 'Ana Souza', left: false },
  { name: 'Tom Becker', left: false },
  { name: 'Marta Silva', left: true },
];

export const AUDIT_EVENTS: readonly string[] = [WEDDING, BISI, IRETI, TOLA];
