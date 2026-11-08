import { writtenTime } from './clock.ts';
import { SAMPLE } from './rules.ts';
import type { EventKey } from './today.ts';

export type Section =
  | 'account'
  | 'security'
  | 'notifications'
  | 'personalisation'
  | 'general'
  | 'members'
  | 'signInRules'
  | 'vendors'
  | 'data';

/** The sections the boards draw; the others each have their own design. */
export type Drawn =
  | 'account'
  | 'security'
  | 'notifications'
  | 'personalisation'
  | 'general'
  | 'members'
  | 'signInRules'
  | 'vendors'
  | 'data';

const PATHS: Record<Drawn, string> = {
  account: 'account',
  security: 'security',
  notifications: 'notifications',
  personalisation: 'personalisation',
  general: 'general',
  members: 'members',
  signInRules: 'sign-in-rules',
  vendors: 'vendors',
  data: 'data',
};

export const SECTION_NAMES: Record<Section, string> = {
  account: 'Account',
  security: 'Security',
  notifications: 'Notifications',
  personalisation: 'Personalisation',
  general: 'General',
  members: 'Members',
  signInRules: 'Sign-in rules',
  vendors: 'Vendors',
  data: 'Data',
};

export interface SectionGroup {
  name: string;
  sections: readonly Section[];
}

const GROUPS: readonly SectionGroup[] = [
  { name: 'Your account', sections: ['account', 'security', 'notifications', 'personalisation'] },
  {
    name: 'Organisation settings',
    sections: ['general', 'members', 'signInRules', 'vendors', 'data'],
  },
];

export type ViewerKey = 'folake' | 'julien' | 'ana';

export interface Viewer {
  key: ViewerKey;
  id: string;
  name: string;
  initials: string;
  role: 'Owner' | 'Admin' | 'Member';
  owns: boolean;
  manages: boolean;
}

/** Who is looking, from `?as=`: an owner, an admin, and a member, who sees no Members (sc-29915). */
export const VIEWERS: Record<ViewerKey, Viewer> = {
  folake: {
    key: 'folake',
    id: SAMPLE.email,
    name: SAMPLE.name,
    initials: 'FA',
    role: 'Owner',
    owns: true,
    manages: true,
  },
  julien: {
    key: 'julien',
    id: 'julien@ire.events',
    name: 'Julien Moreau',
    initials: 'JM',
    role: 'Admin',
    owns: false,
    manages: true,
  },
  ana: {
    key: 'ana',
    id: 'ana.souza@ire.events',
    name: 'Ana Souza',
    initials: 'AS',
    role: 'Member',
    owns: false,
    manages: false,
  },
};

export function viewerOf(name: string | null): Viewer {
  return Object.values(VIEWERS).find((viewer) => viewer.key === name) ?? VIEWERS.folake;
}

/** Members, Vendors and Data only for an owner or an admin: a member sees General and Sign-in rules, read only. */
export function groupsFor(viewer: Pick<Viewer, 'manages'>): SectionGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter(
      (section) =>
        viewer.manages || (section !== 'members' && section !== 'vendors' && section !== 'data'),
    ),
  }));
}

export function isDrawn(section: Section): section is Drawn {
  return (
    section === 'account' ||
    section === 'security' ||
    section === 'notifications' ||
    section === 'personalisation' ||
    section === 'general' ||
    section === 'members' ||
    section === 'signInRules' ||
    section === 'vendors' ||
    section === 'data'
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

  return {
    date: (day) => date.format(new Date(`${day}T00:00Z`)),
    day: (day) => dayOnly.format(new Date(`${day}T00:00Z`)),
    // The sample's deadlines are wall clock in Lagos, so they are read in UTC and named WAT.
    deadline: (at) => `${weekday.format(new Date(`${at}Z`))} at ${writtenTime(at, locale)} WAT`,
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
      { to: settingsPath('members', VIEWERS.julien), name: 'Admin, Members open' },
      { to: settingsPath('members', VIEWERS.ana), name: 'Member, no Members' },
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
    name: 'Requests to get back in',
    states: [
      members('recovery', 'Kofi’s and Priya’s requests'),
      members('recovery', 'Kofi’s and Priya’s requests, an admin looking', VIEWERS.julien),
      members('recoveryApprove', 'Approving Kofi'),
      members('recoveryTurnDown', 'Turning Kofi down'),
      members('recoveryApproved', 'Kofi’s two-factor is off'),
      members('recoveryTurnedDown', 'Kofi’s request turned down'),
      members('recoveryClosed', 'Kofi’s request answered elsewhere'),
      members('recoverySending', 'Kofi’s answer on its way'),
      members('recoveryFailed', 'Kofi’s answer failed'),
      members('recoveryDone', 'None left'),
      members('recoveryOwn', 'Your own request, an admin', VIEWERS.julien),
    ],
  },
  {
    name: 'A person',
    states: [
      members('priya', 'Priya Shah (from 1536 wide, beside the list)'),
      members('role', 'Priya’s role, just opened'),
      members('roleAdmin', 'Priya’s role, Admin picked'),
      members('role', 'Priya’s role, an admin choosing', VIEWERS.julien),
      members('roleDiscard', 'Priya’s role, cancel after a change'),
      members('removing', 'Removing Priya'),
      members('self', 'Your own page, an owner'),
      members('self', 'Your own page, an admin', VIEWERS.julien),
      members('folake', 'Julien sees Folake, the only owner', VIEWERS.julien),
    ],
  },
  {
    name: 'Owners, suspending and restoring',
    states: [
      members('makeOwner', 'Make Ana an owner'),
      members('makeOwnerBlank', 'Make owner, nothing typed'),
      members('makeOwnerWrong', 'Make owner, a wrong code'),
      members('marta', 'Marta Silva, suspended by the domain: Leads 2 events'),
      members('suspending', 'Suspending Priya'),
      members('justSuspended', 'Priya, just suspended'),
      members('suspended', 'Priya, suspended by hand: Leads 3 events'),
      members('restored', 'Priya, restored'),
    ],
  },
  {
    name: 'Handing over a departing member’s work',
    states: [
      members('handover', 'Remove Priya: her 3 events, starting on you'),
      members('handoverMenu', 'The menu of people open'),
      members('handoverPicked', 'Ana Souza picked'),
      members('handoverLong', 'Julien leads 8: the first 5, then “and 3 more”'),
      members('handoverSearch', '18 members: “jo” in the search'),
      members('handoverSearchNobody', 'Nobody matches “kemi”'),
      members('removingNoWork', 'Tom leads nothing: today’s confirm'),
      members('handoverSending', 'Removing…'),
      members('handoverFailed', 'Removing did not work'),
      members('handoverDone', 'Removed, the card after'),
      members('handoverNow', 'Hand over now, on Marta’s page'),
      members('handoverNowSending', 'Handing over…'),
      members('handoverNowFailed', 'Handing over did not work'),
      members('handoverNowDone', 'Handed over, the list gone'),
      members('handoverReadOnly', 'Julien reads Marta, an owner: no Hand over now', VIEWERS.julien),
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

/** Rejects where the browser has no clipboard, as over plain http, so nothing says it copied what it did not. */
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
