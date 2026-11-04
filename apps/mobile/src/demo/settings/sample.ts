import { SAMPLE } from '../samples.ts';

/** Settings' three arrangements, from the app's layout kinds. */
export type SettingsLayout = 'phone' | 'portrait' | 'landscape';

/** Who is looking: an owner sees every section, a planner only what the role holds, and somebody with no organisation only their own. */
export type Viewer = 'owner' | 'planner' | 'noOrg';

export const VIEWERS: readonly Viewer[] = ['owner', 'planner', 'noOrg'];

export function isViewer(name: string | undefined): name is Viewer {
  return VIEWERS.some((viewer) => viewer === name);
}

export const YOU = {
  name: SAMPLE.name,
  initials: 'FA',
  email: SAMPLE.email,
  organisation: SAMPLE.organisation,
} as const;

/** What each viewer's role holds, for settingsGroups to decide the sections as the app does. */
export const VIEWER_ORGANISATION: Record<Viewer, { role: string; permissions: string[] } | null> = {
  owner: { role: 'Owner', permissions: ['members.read', 'members.manage', 'organisation.manage'] },
  planner: { role: 'Planner', permissions: [] },
  noOrg: null,
};

export type MemberStatus =
  'active' | 'pendingApproval' | 'suspended' | 'domainSuspended' | 'former';

export interface SampleMember {
  name: string;
  initials: string;
  email: string;
  role: string | null;
  status: MemberStatus;
  how: string;
  when: string;
}

/** The people in Ire Events, as the boards drew them. */
export const MEMBERS: readonly SampleMember[] = [
  {
    name: SAMPLE.name,
    initials: 'FA',
    email: SAMPLE.email,
    role: 'Owner',
    status: 'active',
    how: 'Created Ire Events',
    when: '2025-03-02',
  },
  {
    name: 'Julien Moreau',
    initials: 'JM',
    email: 'julien@ire.events',
    role: 'Administrator',
    status: 'active',
    how: 'Invitation from Folake Adeyemi',
    when: '2025-04-14',
  },
  {
    name: 'Priya Shah',
    initials: 'PS',
    email: 'priya@ire.events',
    role: 'Event manager',
    status: 'active',
    how: 'Company email address',
    when: '2025-06-03',
  },
  {
    name: 'Ana Souza',
    initials: 'AS',
    email: 'ana.souza@ire.events',
    role: 'Coordinator',
    status: 'active',
    how: 'Join code',
    when: '2025-08-21',
  },
  {
    name: 'Tom Becker',
    initials: 'TB',
    email: 'tom.becker@gmail.com',
    role: 'Door staff',
    status: 'active',
    how: 'Asked to join',
    when: '2026-02-09',
  },
  {
    name: 'Kofi Mensah',
    initials: 'KM',
    email: 'kofi@ire.events',
    role: 'Read-only',
    status: 'active',
    how: 'Company directory',
    when: '2026-09-15',
  },
  {
    name: 'Marta Silva',
    initials: 'MS',
    email: 'marta.silva@ire.events',
    role: 'Coordinator',
    status: 'domainSuspended',
    how: 'Company email address',
    when: '2026-10-28',
  },
  {
    name: 'Lucía Gómez',
    initials: 'LG',
    email: 'lucia.gomez@outlook.com',
    role: null,
    status: 'pendingApproval',
    how: 'Asked to join',
    when: '2026-11-02',
  },
  {
    name: 'Daniel Kim',
    initials: 'DK',
    email: 'daniel.kim@ire.events',
    role: 'Coordinator',
    status: 'former',
    how: 'Invitation',
    when: '2026-09-30',
  },
];

export interface SampleRole {
  name: string;
  builtIn: boolean;
  people: number;
}

export const ROLES: readonly SampleRole[] = [
  { name: 'Owner', builtIn: true, people: 1 },
  { name: 'Administrator', builtIn: true, people: 1 },
  { name: 'Event manager', builtIn: true, people: 1 },
  { name: 'Coordinator', builtIn: true, people: 2 },
  { name: 'Read-only', builtIn: true, people: 1 },
  { name: 'Door staff', builtIn: false, people: 1 },
];

/** Addresses from the documentation ranges (RFC 5737), never a real network. */
export const IPS = ['203.0.113.24', '198.51.100.7', '192.0.2.61'] as const;
