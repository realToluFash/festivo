/** sc-611's six with sc-71986's six between them, in the AC's order. */
export const AUDIT_TYPES = [
  'Events',
  'Event access',
  'Guests',
  'Menu',
  'Seating',
  'Schedule',
  'Staff',
  'Budget',
  'Members and invitations',
  'Sign-in and security',
  'Organisation',
  'Audit log',
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export const TYPE_LANGS = ['en', 'es', 'fr', 'pt'] as const;
export type TypeLang = (typeof TYPE_LANGS)[number];

/** The six new types read as the event's sections do (eventNav); sc-611's six outside English are proposals for the linguist. */
export const TYPE_WORDS: Record<TypeLang, Record<AuditType, string>> = {
  en: Object.fromEntries(AUDIT_TYPES.map((type) => [type, type])) as Record<AuditType, string>,
  es: {
    Events: 'Eventos',
    'Event access': 'Acceso a eventos',
    Guests: 'Invitados',
    Menu: 'Menú',
    Seating: 'Mesas',
    Schedule: 'Programa',
    Staff: 'Personal',
    Budget: 'Presupuesto',
    'Members and invitations': 'Miembros e invitaciones',
    'Sign-in and security': 'Inicio de sesión y seguridad',
    Organisation: 'Organización',
    'Audit log': 'Registro de auditoría',
  },
  fr: {
    Events: 'Événements',
    'Event access': 'Accès aux événements',
    Guests: 'Invités',
    Menu: 'Menu',
    Seating: 'Plan de table',
    Schedule: 'Programme',
    Staff: 'Équipe',
    Budget: 'Budget',
    'Members and invitations': 'Membres et invitations',
    'Sign-in and security': 'Connexion et sécurité',
    Organisation: 'Organisation',
    'Audit log': 'Journal d’audit',
  },
  pt: {
    Events: 'Eventos',
    'Event access': 'Acesso a eventos',
    Guests: 'Convidados',
    Menu: 'Menu',
    Seating: 'Mesas',
    Schedule: 'Programa',
    Staff: 'Equipa',
    Budget: 'Orçamento',
    'Members and invitations': 'Membros e convites',
    'Sign-in and security': 'Início de sessão e segurança',
    Organisation: 'Organização',
    'Audit log': 'Registo de auditoria',
  },
};

export interface AuditEntry {
  id: string;
  at: string;
  what: string;
  who: string;
  /** The person's address now; none for System. */
  whoEmail: string | null;
  type: AuditType;
  action: string;
  /** What it was done to; `href` is where it is seen while it exists, null where the app shows it nowhere. */
  on: { name: string; href: string | null; gone: boolean };
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
const ORGANISATION = { name: 'Ire Events', href: null, gone: false };
const quiet = { event: null, changes: null, address: null, device: null };

export const WEDDING = 'Adaeze & Tunde’s wedding';
export const IRETI = 'Ireti at 40';
export const TOLA = 'Tola & Seun’s wedding';
export const BISI = 'Bisi & Kola’s engagement';
const WEDDING_ID = 'evt-wed-4';
/** As eventHref writes them, kept here so the sample needs nothing from the events demo. */
const eventHref = (id: string, query: { area?: string; state?: string } = {}) => {
  const search = Object.entries(query)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return search === '' ? `/demo/events/${id}` : `/demo/events/${id}?${search}`;
};
const section = (type: AuditType, area: string) => ({
  name: `${WEDDING} · ${type}`,
  href: eventHref(WEDDING_ID, { area }),
  gone: false,
});

/** Newest first, the instants in UTC: Lagos is an hour ahead. */
export const ENTRIES: readonly AuditEntry[] = [
  {
    ...quiet,
    ...FOLAKE,
    id: 'downloaded',
    at: '2026-10-19T09:05:18Z',
    what: 'Downloaded Ire Events’s data',
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
    what: 'Asked for an export of Ire Events’s data',
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
    on: { name: WEDDING, href: eventHref(WEDDING_ID), gone: false },
    event: WEDDING,
    reference: 'd7c3a815-2e9f-4b6d-a1c4-8e5b2f7d0a93',
  },
  {
    ...quiet,
    ...PRIYA,
    id: 'skipped',
    at: '2026-10-18T18:42:09Z',
    what: 'Skipped Toasts during the event',
    type: 'Schedule',
    action: 'run_of_show.item_skipped',
    on: section('Schedule', 'schedule'),
    event: WEDDING,
    reference: '8c2e5f17-4a9b-4d36-b0e8-1f7a3c6d92e5',
  },
  {
    ...quiet,
    ...PRIYA,
    id: 'floorLead',
    at: '2026-10-18T15:10:31Z',
    what: 'Made Ifeoma Nduka the floor lead',
    type: 'Staff',
    action: 'stations.floor_lead_set',
    on: section('Staff', 'staff'),
    event: WEDDING,
    changes: 'Floor lead: None → Ifeoma Nduka',
    reference: '3f9d1b6e-7c24-4a85-9e0b-5d8c2a7f1e43',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'budgetLine',
    at: '2026-10-18T13:25:12Z',
    what: 'Added Lighting to the budget',
    type: 'Budget',
    action: 'budget_line.added',
    on: section('Budget', 'budget'),
    event: WEDDING,
    reference: 'b7a40e2c-1d68-4f93-a5c1-8e2f6b9d0a74',
  },
  {
    ...quiet,
    ...FOLAKE,
    id: 'seatMoved',
    at: '2026-10-18T11:03:47Z',
    what: 'Moved Dr Emeka Nwosu to Table 4',
    type: 'Seating',
    action: 'seating.guest_moved',
    on: {
      name: 'Dr Emeka Nwosu',
      href: eventHref(WEDDING_ID, { area: 'guests', state: 'guest' }),
      gone: false,
    },
    event: WEDDING,
    changes: 'Table: Table 2 → Table 4',
    reference: '0e6b9c3a-5f12-4d7e-8a49-c3d1f7b2e586',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'guestRemoved',
    at: '2026-10-18T10:20:05Z',
    what: 'Removed a guest',
    type: 'Guests',
    action: 'guest.removed',
    on: section('Guests', 'guests'),
    event: WEDDING,
    reference: '6d3a8f05-2b71-4e9c-b4d6-7a0e1c5f3b28',
  },
  {
    ...quiet,
    ...JULIEN,
    id: 'guestGone',
    at: '2026-10-18T08:48:55Z',
    what: 'Changed a guest’s needs',
    type: 'Guests',
    action: 'guest.needs_changed',
    on: { name: 'A guest', href: null, gone: true },
    event: WEDDING,
    reference: 'f1c7e4a9-8d35-4b02-9f6e-2a5b8d1c7e30',
  },
  {
    ...quiet,
    ...FOLAKE,
    id: 'dish',
    at: '2026-10-18T07:30:22Z',
    what: 'Added Jollof rice to Ire Events’s dishes',
    type: 'Menu',
    action: 'dish.added',
    on: { name: 'Jollof rice', href: null, gone: false },
    reference: '9b5f2d8e-6a13-4c7f-a0d4-e8c3b1f6a952',
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
    on: { name: IRETI, href: eventHref('evt-ireti-2'), gone: false },
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
    on: { name: 'Ire Events’s sign-in rules', href: null, gone: false },
    changes: 'Everyone needs two-factor: Off → On',
    address: '203.0.113.17',
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
    on: { name: 'ireevents.com', href: null, gone: false },
    address: '203.0.113.17',
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
    on: { name: TOLA, href: null, gone: false },
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
    on: { name: 'ire.events', href: null, gone: false },
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
    on: { name: BISI, href: null, gone: true },
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
