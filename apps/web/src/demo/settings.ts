import { SAMPLE } from './rules.ts';
import type { EventKey } from './today.ts';

export type Section =
  'account' | 'security' | 'notifications' | 'general' | 'members' | 'roles' | 'signInRules';

/** The one section the boards draw; the others, Roles among them, each have their own design. */
export type Drawn = 'members';

export const SECTION_NAMES: Record<Section, string> = {
  account: 'Account',
  security: 'Security',
  notifications: 'Notifications',
  general: 'General',
  members: 'Members',
  roles: 'Roles',
  signInRules: 'Sign-in rules',
};

export interface SectionGroup {
  name: string;
  sections: readonly Section[];
}

const GROUPS: readonly SectionGroup[] = [
  { name: 'Your account', sections: ['account', 'security', 'notifications'] },
  { name: 'Organisation settings', sections: ['general', 'members', 'roles', 'signInRules'] },
];

export type ViewerKey = 'folake' | 'julien' | 'tom' | 'ana';

export interface Viewer {
  key: ViewerKey;
  id: string;
  name: string;
  initials: string;
  role: string;
  owns: boolean;
  manages: boolean;
  reads: boolean;
}

/** Who is looking, from `?as=`: an owner, an administrator, door staff who read Members, and a coordinator who does not. */
export const VIEWERS: Record<ViewerKey, Viewer> = {
  folake: {
    key: 'folake',
    id: SAMPLE.email,
    name: SAMPLE.name,
    initials: 'FA',
    role: 'Owner',
    owns: true,
    manages: true,
    reads: true,
  },
  julien: {
    key: 'julien',
    id: 'julien@ire.events',
    name: 'Julien Moreau',
    initials: 'JM',
    role: 'Administrator',
    owns: false,
    manages: true,
    reads: true,
  },
  tom: {
    key: 'tom',
    id: 'tom.becker@gmail.com',
    name: 'Tom Becker',
    initials: 'TB',
    role: 'Door staff',
    owns: false,
    manages: false,
    reads: true,
  },
  ana: {
    key: 'ana',
    id: 'ana.souza@ire.events',
    name: 'Ana Souza',
    initials: 'AS',
    role: 'Coordinator',
    owns: false,
    manages: false,
    reads: false,
  },
};

export function viewerOf(name: string | null): Viewer {
  return Object.values(VIEWERS).find((viewer) => viewer.key === name) ?? VIEWERS.folake;
}

/** Members and Roles only for a role that reads them. */
export function groupsFor(viewer: Pick<Viewer, 'reads'>): SectionGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter(
      (section) => viewer.reads || (section !== 'members' && section !== 'roles'),
    ),
  }));
}

export function isDrawn(section: Section): section is Drawn {
  return section === 'members';
}

export function settingsPath(section: Drawn, viewer: Pick<Viewer, 'key'>, state?: string): string {
  const query = new URLSearchParams();
  if (viewer.key !== 'folake') query.set('as', viewer.key);
  if (state != null) query.set('state', state);
  const search = query.toString();

  return `/demo/settings/${section}${search === '' ? '' : `?${search}`}`;
}

export const SIDEBAR_EVENTS: readonly EventKey[] = ['wed', 'ireti', 'party', 'draft'];

/** Dates as the server writes them for the organisation, in the reader's English. */
export interface SettingsSay {
  date(day: string): string;
  day(day: string): string;
  deadline(at: string): string;
}

export function settingsSayIn(locale: string): SettingsSay {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  const date = format({ month: 'short', day: 'numeric', year: 'numeric' });
  const dayOnly = format({ month: 'short', day: 'numeric' });
  const weekday = format({ weekday: 'long', month: 'short', day: 'numeric' });
  const clock = format({ hour: 'numeric', minute: '2-digit' });

  return {
    date: (day) => date.format(new Date(`${day}T00:00Z`)),
    day: (day) => dayOnly.format(new Date(`${day}T00:00Z`)),
    // The sample's deadlines are wall clock in Lagos, so they are read in UTC and named WAT.
    deadline: (at) =>
      `${weekday.format(new Date(`${at}Z`))} at ${clock.format(new Date(`${at}Z`))} WAT`,
  };
}

export interface DemoLink {
  to: string;
  name: string;
}

/** The states the boards draw, each opened from the demo's home, a group per board. */
export const SETTINGS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The list beside the page',
    states: [
      { to: settingsPath('members', VIEWERS.folake), name: 'Owner, Members open' },
      { to: settingsPath('members', VIEWERS.tom), name: 'Reads Members, manages nothing' },
      { to: settingsPath('members', VIEWERS.ana), name: 'Does not read Members' },
    ],
  },
];
