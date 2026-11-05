import { SAMPLE } from './rules.ts';
import type { EventKey } from './today.ts';

export type Section =
  'account' | 'security' | 'notifications' | 'general' | 'members' | 'roles' | 'signInRules';

/** The sections the boards draw; the others, Roles among them, each have their own design. */
export type Drawn = 'account' | 'general' | 'members' | 'signInRules';

const PATHS: Record<Drawn, string> = {
  account: 'account',
  general: 'general',
  members: 'members',
  signInRules: 'sign-in-rules',
};

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
  return (
    section === 'account' ||
    section === 'general' ||
    section === 'members' ||
    section === 'signInRules'
  );
}

export function settingsPath(section: Drawn, viewer: Pick<Viewer, 'key'>, state?: string): string {
  const query = new URLSearchParams();
  if (viewer.key !== 'folake') query.set('as', viewer.key);
  if (state != null) query.set('state', state);
  const search = query.toString();

  return `/demo/settings/${PATHS[section]}${search === '' ? '' : `?${search}`}`;
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
  {
    name: 'Members',
    states: [
      members('menu', 'The filter menu open'),
      members('nobodySuspended', 'Nobody is suspended'),
      members('nobodyLeft', 'Nobody has left'),
      members('invited', 'Invited'),
      members('revoked', 'After Revoke'),
      members('loading', 'Loading'),
      members('failed', 'Failed'),
      members('invite', 'Invite somebody'),
      members('inviteBlank', 'Invite, nothing typed'),
      members('inviteShape', 'Invite, not an address'),
      members('sent', 'Invitation sent'),
    ],
  },
  {
    name: 'A request to join',
    states: [
      members('request', 'Lucía’s request'),
      members('turningDown', 'Turning down'),
      members('requestDiscard', 'Cancel after a change'),
      members('approved', 'Approved'),
      members('turnedDown', 'Turned down'),
      members('removed', 'Removed'),
      members('former', 'See Former'),
    ],
  },
  {
    name: 'A person',
    states: [
      members('priya', 'Priya Shah (from 1536 wide, beside the list)'),
      members('role', 'Priya’s role, just opened'),
      members('roleCoordinator', 'Priya’s role, Coordinator picked'),
      members('roleDiscard', 'Priya’s role, cancel after a change'),
      members('removing', 'Removing Priya'),
      members('priya', 'Read only, Tom sees Priya', VIEWERS.tom),
      members('self', 'Your own page, an owner'),
      members('self', 'Your own page, not an owner', VIEWERS.tom),
      members('folake', 'Julien sees Folake, the only owner', VIEWERS.julien),
    ],
  },
  {
    name: 'Owners, suspending and restoring',
    states: [
      members('makeOwner', 'Make Ana an owner'),
      members('makeOwnerBlank', 'Make owner, nothing typed'),
      members('makeOwnerWrong', 'Make owner, a wrong code'),
      members('marta', 'Marta Silva, suspended by the domain'),
      members('martaNo', 'Marta, may not restore', VIEWERS.julien),
      members('suspending', 'Suspending Priya'),
      members('justSuspended', 'Priya, just suspended'),
      members('suspended', 'Priya, suspended by hand'),
      members('restored', 'Priya, restored'),
    ],
  },
  {
    name: 'No active owner',
    states: [
      members('noOwner', 'No active owner', VIEWERS.julien),
      members('claim', 'Become the owner', VIEWERS.julien),
      members('claimCopied', 'The value copied', VIEWERS.julien),
      members('claimChecking', 'Checking the record', VIEWERS.julien),
      members('claimMissing', 'Not found yet', VIEWERS.julien),
      members('claimOpen', 'Your claim is open', VIEWERS.julien),
      members('withdrawing', 'Withdrawing', VIEWERS.julien),
      members('withdrawn', 'Withdrawn', VIEWERS.julien),
      members('found', 'Record found', VIEWERS.julien),
      members('lapsed', 'A claim lapsed', VIEWERS.julien),
      members('stopped', 'The claim was stopped', VIEWERS.julien),
    ],
  },
];

function members(state: string, name: string, viewer: Viewer = VIEWERS.folake): DemoLink {
  return { to: settingsPath('members', viewer, state), name };
}
