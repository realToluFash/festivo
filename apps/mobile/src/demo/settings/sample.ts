import { type SettingsGroup, type SettingsSection, settingsGroups } from '../../kit/appNav.ts';
import { SAMPLE } from '../samples.ts';

/** Settings' three arrangements, from the app's layout kinds. */
export type SettingsLayout = 'phone' | 'portrait' | 'landscape';

/** Who is looking: an owner sees every section, a member only their own and Sign-in rules, and somebody with no organisation only their own. */
export type Viewer = 'owner' | 'member' | 'noOrg';

export const VIEWERS: readonly Viewer[] = ['owner', 'member', 'noOrg'];

/** `as=planner` is the link the demo gave a member before sc-29859 left three roles. */
export function viewerOf(name: string | undefined): Viewer {
  if (name === 'planner') return 'member';

  return VIEWERS.find((viewer) => viewer === name) ?? 'owner';
}

/** sc-29859 leaves no Roles section: what each role does is fixed. sc-30441 adds Personalisation, ahead of the app. */
export type DemoSection = Exclude<SettingsSection, 'roles'> | 'personalisation';

export const SECTIONS: readonly DemoSection[] = [
  'account',
  'security',
  'notifications',
  'personalisation',
  'organisation',
  'members',
  'signInRules',
];

export function isSection(name: string | undefined): name is DemoSection {
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

/** settingsGroups, ahead of the app as sc-29859 and sc-30441 have it: no Roles, Personalisation after Notifications for everyone, and the organisation's own row only for whoever manages it. */
export function demoGroups(
  viewer: Viewer,
): { heading: SettingsGroup['heading']; sections: DemoSection[] }[] {
  const organisation = VIEWER_ORGANISATION[viewer];
  const manages = organisation?.permissions.includes('organisation.manage') === true;

  return settingsGroups(organisation).map(({ heading, sections }) => ({
    heading,
    sections: sections
      .filter(
        (section): section is Exclude<DemoSection, 'personalisation'> =>
          section !== 'roles' && (manages || section !== 'organisation'),
      )
      .flatMap((section): DemoSection[] =>
        section === 'notifications' ? [section, 'personalisation'] : [section],
      ),
  }));
}

/** Who the card at the top of Settings is: the member is Priya, as the board draws her. */
export const VIEWER_PERSON: Record<Viewer, { name: string; initials: string; email: string }> = {
  owner: YOU,
  member: { name: 'Priya Shah', initials: 'PS', email: 'priya@ire.events' },
  noOrg: YOU,
};

/** Who is looking, as the Settings card and the sidebar's foot show them: no role outside an organisation. */
export interface Looking {
  name: string;
  initials: string;
  email: string;
  role: string | null;
}

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
