import { type SettingsGroup, settingsGroups } from '../../kit/appNav.ts';
import type { Looking, ShellSection, Viewer } from '../../components/settingsShell.ts';
import { SAMPLE } from '../samples.ts';

export const VIEWERS: readonly Viewer[] = ['owner', 'member', 'noOrg'];

/** `as=planner` is the link the demo gave a member before sc-29859 left three roles. */
export function viewerOf(name: string | undefined): Viewer {
  if (name === 'planner') return 'member';

  return VIEWERS.find((viewer) => viewer === name) ?? 'owner';
}

export const SECTIONS: readonly ShellSection[] = [
  'account',
  'security',
  'notifications',
  'personalisation',
  'organisation',
  'members',
  'signInRules',
];

export function isSection(name: string | undefined): name is ShellSection {
  return SECTIONS.some((section) => section === name);
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
  member: { role: 'Member', permissions: [] },
  noOrg: null,
};

/** settingsGroups, ahead of the app as sc-29859 has it: no Roles. A member keeps Organisation, read only, to leave (sc-29915). */
export function demoGroups(
  viewer: Viewer,
): { heading: SettingsGroup['heading']; sections: ShellSection[] }[] {
  return settingsGroups(VIEWER_ORGANISATION[viewer]).map(({ heading, sections }) => ({
    heading,
    sections: sections.filter((section): section is ShellSection => section !== 'roles'),
  }));
}

/** Who may change the organisation's details, joining and ownership, by the role's permission as the app decides it. */
export function managesOrganisation(viewer: Viewer): boolean {
  return VIEWER_ORGANISATION[viewer]?.permissions.includes('organisation.manage') === true;
}

/** Who the card at the top of Settings is: the member is Priya, as the board draws her. */
export const VIEWER_PERSON: Record<Viewer, { name: string; initials: string; email: string }> = {
  owner: YOU,
  member: { name: 'Priya Shah', initials: 'PS', email: 'priya@ire.events' },
  noOrg: YOU,
};

export function lookingAs(viewer: Viewer): Looking {
  return { ...VIEWER_PERSON[viewer], role: VIEWER_ORGANISATION[viewer]?.role ?? null };
}

/** The sections follow the role: an admin manages as an owner does. */
export function viewerOfRole(role: string | null): Viewer {
  if (role == null) return 'noOrg';

  return role === 'Member' ? 'member' : 'owner';
}

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
    role: 'Admin',
    status: 'active',
    how: 'Invitation from Folake Adeyemi',
    when: '2025-04-14',
  },
  {
    name: 'Priya Shah',
    initials: 'PS',
    email: 'priya@ire.events',
    role: 'Member',
    status: 'active',
    how: 'Company email address',
    when: '2025-06-03',
  },
  {
    name: 'Ana Souza',
    initials: 'AS',
    email: 'ana.souza@ire.events',
    role: 'Member',
    status: 'active',
    how: 'Join code',
    when: '2025-08-21',
  },
  {
    name: 'Tom Becker',
    initials: 'TB',
    email: 'tom.becker@gmail.com',
    role: 'Member',
    status: 'active',
    how: 'Asked to join',
    when: '2026-02-09',
  },
  {
    name: 'Kofi Mensah',
    initials: 'KM',
    email: 'kofi@ire.events',
    role: 'Member',
    status: 'active',
    how: 'Company directory',
    when: '2026-09-15',
  },
  {
    name: 'Marta Silva',
    initials: 'MS',
    email: 'marta.silva@ire.events',
    role: 'Member',
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
    role: 'Member',
    status: 'former',
    how: 'Invitation',
    when: '2026-09-30',
  },
];

/** A member of Ire Events as the one looking, for a page whose sample someone else sees. */
export function memberLooking(email: string): Looking {
  const member = MEMBERS.find((one) => one.email === email);
  if (member == null) throw new Error(`${email} is not one of the sample’s members.`);

  return { name: member.name, initials: member.initials, email: member.email, role: member.role };
}

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
