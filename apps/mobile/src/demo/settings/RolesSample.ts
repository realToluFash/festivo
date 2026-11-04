import {
  extrasOf,
  HOLDERS_SHOWN,
  type Level,
  levelOf,
  lockedAreas,
  MARGIN,
  replacementsFor,
  roleNameProblem,
  ROLE_NAME_MAXIMUM,
  settableLevels,
  whatTheySee,
  withLevel,
} from '@soirely/domain';

import { MEMBERS, ROLES, YOU } from './sample.ts';

export interface Area {
  area: string;
  name: string;
  means: string;
  permissions: readonly string[];
}

const READ_AND_CHANGE = (area: string) => [`${area}.read`, `${area}.manage`];

/** The app's thirteen areas in its order, with en.json's words. */
export const AREAS: readonly Area[] = [
  {
    area: 'events',
    name: 'Events',
    means: 'Create, publish, pause and conclude events.',
    permissions: [...READ_AND_CHANGE('events'), 'events.create'],
  },
  {
    area: 'guests',
    name: 'Guests',
    means: 'Names, contact details, replies and imports. Read still shows phone numbers.',
    permissions: READ_AND_CHANGE('guests'),
  },
  {
    area: 'seating',
    name: 'Seating',
    means: 'Rooms, tables and who sits where.',
    permissions: READ_AND_CHANGE('seating'),
  },
  {
    area: 'menu',
    name: 'Menu',
    means: 'Courses, dishes, variants and picks.',
    permissions: READ_AND_CHANGE('menu'),
  },
  {
    area: 'run_of_show',
    name: 'Run of show',
    // The owner's words (3 Nov): en.json still says "on the night" until the linguist's change lands.
    means: 'The schedule, and marking items done on the day.',
    permissions: READ_AND_CHANGE('run_of_show'),
  },
  {
    area: 'staff',
    name: 'Staff',
    means: 'Who works an event and what they do there.',
    permissions: READ_AND_CHANGE('staff'),
  },
  {
    area: 'messages',
    name: 'Messages',
    means: 'Compose and send. Read includes the delivery record.',
    permissions: READ_AND_CHANGE('messages'),
  },
  {
    area: 'reports',
    name: 'Reports',
    means: 'Change means exporting.',
    permissions: READ_AND_CHANGE('reports'),
  },
  {
    area: 'budget',
    name: 'Budget',
    means: 'Planned and actual costs, line by line.',
    permissions: [...READ_AND_CHANGE('budget'), MARGIN],
  },
  {
    area: 'vendors',
    name: 'Vendors',
    means: 'Suppliers on each event and what was agreed with them.',
    permissions: READ_AND_CHANGE('vendors'),
  },
  {
    area: 'members',
    name: 'Members and roles',
    means: 'Invite, approve, suspend, change roles.',
    permissions: READ_AND_CHANGE('members'),
  },
  {
    area: 'billing',
    name: 'Billing',
    means: 'Plan, cards and invoices.',
    permissions: READ_AND_CHANGE('billing'),
  },
  {
    area: 'organisation',
    name: 'Organisation',
    means: 'The name, country, contact address and the defaults new events start with.',
    permissions: ['organisation.manage'],
  },
];

export interface Extra {
  permission: string;
  name: string;
  means: string;
  off: string;
  on: string;
}

const ORGANISATION = YOU.organisation;

export const EXTRAS: Record<string, Extra> = {
  [MARGIN]: {
    permission: MARGIN,
    name: 'Margin',
    means: `What ${ORGANISATION} adds on top of costs. Hidden means the budget opens with costs only.`,
    off: 'Hidden',
    on: 'Shown',
  },
  'events.create': {
    permission: 'events.create',
    name: 'Create events',
    means: `Start a new event in ${ORGANISATION}. It begins as a draft.`,
    off: 'Not allowed',
    on: 'Allowed',
  },
};

export const LEVEL_WORDS: Record<Level, string> = {
  nothing: 'Nothing',
  read: 'Read',
  change: 'Change',
};

export function extrasFor(area: Area): Extra[] {
  return extrasOf(area.area, area.permissions).flatMap((permission) => {
    const extra = EXTRAS[permission];

    return extra == null ? [] : [extra];
  });
}

export function grantOf(
  change: readonly string[],
  read: readonly string[] = [],
  extras: readonly string[] = [],
): string[] {
  const levelled = AREAS.reduce<string[]>((held, { area, permissions }) => {
    const level: Level = change.includes(area)
      ? 'change'
      : read.includes(area)
        ? 'read'
        : 'nothing';

    return withLevel(held, area, level, permissions);
  }, []);

  return [...levelled, ...extras];
}

const EVERY_AREA = AREAS.map(({ area }) => area);
const RUNNING = ['events', 'guests', 'seating', 'menu', 'run_of_show', 'messages'];
const UP_TO_BUDGET = [...RUNNING, 'staff', 'reports', 'budget'];

export interface DemoRole {
  id: string;
  name: string;
  builtIn: boolean;
  owner: boolean;
  grant: string[];
  holders: string[];
}

const GRANTS: Record<string, string[]> = {
  Owner: grantOf(EVERY_AREA, [], ['events.create', MARGIN]),
  // In this sample an Administrator holds nothing in Billing, so Julien's Billing rows lock.
  Administrator: grantOf(
    EVERY_AREA.filter((area) => area !== 'billing'),
    [],
    ['events.create', MARGIN],
  ),
  'Event manager': grantOf(UP_TO_BUDGET, [], ['events.create']),
  Coordinator: grantOf(RUNNING, ['staff', 'reports', 'budget']),
  'Read-only': grantOf([], UP_TO_BUDGET),
  'Door staff': grantOf(['guests'], ['events', 'seating', 'run_of_show', 'members']),
};

export function idOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/gu, '-');
}

export function sampleRoles(): DemoRole[] {
  return ROLES.map((role) => ({
    id: idOf(role.name),
    name: role.name,
    builtIn: role.builtIn,
    owner: role.name === 'Owner',
    grant: GRANTS[role.name] ?? [],
    holders: MEMBERS.filter(
      (member) => member.role === role.name && member.status !== 'former',
    ).map(({ name }) => name),
  }));
}

export function grantFor(roleName: string): string[] {
  return GRANTS[roleName] ?? [];
}

export function suspendedHolder(name: string): boolean {
  return MEMBERS.some(
    (member) =>
      member.name === name &&
      (member.status === 'suspended' || member.status === 'domainSuspended'),
  );
}

export function people(count: number): string {
  return count === 1 ? '1 person' : `${count} people`;
}

export function describeRole(role: Pick<DemoRole, 'owner' | 'builtIn'> | null): string {
  if (role == null) return 'Starts from nothing. Switch on what they need.';
  if (role.owner) return 'Everything, including whatever Soirely adds later.';
  if (role.builtIn) return 'Built in, so it cannot be removed. What it holds is yours to change.';

  return `Made by ${ORGANISATION}. It can be removed.`;
}

/** English's list, with the serial comma Intl.ListFormat gives en. */
export function andList(words: readonly string[]): string {
  if (words.length <= 2) return words.join(' and ');

  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1) ?? ''}`;
}

const AREA_NAMES = new Map(AREAS.map(({ area, name }) => [area, name]));

export function areaName(area: string): string {
  return AREA_NAMES.get(area) ?? EXTRAS[area]?.name ?? area;
}

export function unsavedLine(creating: boolean, role: string, holders: number): string {
  if (creating) return 'New role, not saved yet. Nobody holds it until somebody is given it.';
  if (holders === 0) return `Unsaved changes to ${role}. Nobody holds this role yet.`;
  if (holders === 1)
    return `Unsaved changes to ${role}. 1 person gets them on their next request; nobody is signed out.`;

  return `Unsaved changes to ${role}. ${holders} people get them on their next request; nobody is signed out.`;
}

/** What they will see, as three sentences: hidden, read only and the margin. */
export function seeLines(grant: readonly string[]): { hidden: string; read: string } {
  const { hidden, readOnly } = whatTheySee(grant, EVERY_AREA);
  const named = (areas: string[]) => andList(areas.map(areaName));
  const margin =
    levelOf(grant, 'budget') === 'nothing'
      ? ''
      : grant.includes(MARGIN)
        ? ' The budget shows the margin.'
        : ' The budget opens with costs only, no margin.';

  return {
    hidden:
      hidden.length > 0
        ? `Not in their menus at all: ${named(hidden)}.`
        : 'Every area is in their menus.',
    read:
      (readOnly.length > 0
        ? `Open but with no buttons: ${named(readOnly)}.`
        : 'They can change everything they can open.') + margin,
  };
}

export function lockedIntro(
  grant: readonly string[],
  held: readonly string[],
  heldRole: string,
): string | null {
  const locked = lockedAreas(grant, held, AREAS).map(areaName);
  if (locked.length === 0) return null;
  const stays = locked.length === 1 ? 'stays as it is' : 'stay as they are';

  return `You can change only what your role, ${heldRole}, holds. ${andList(locked)} ${stays} when you save.`;
}

export function lockedLine(name: string): string {
  return `Only someone who can change ${name} can set this. It stays as it is when you save.`;
}

export function levelsFor(grant: readonly string[], held: readonly string[], area: Area): Level[] {
  return settableLevels(grant, held, area.area, area.permissions);
}

export function holdersLine(holders: readonly string[]): {
  shown: readonly string[];
  more: string | null;
} {
  if (holders.length <= HOLDERS_SHOWN) return { shown: holders, more: null };

  return {
    shown: holders.slice(0, HOLDERS_SHOWN),
    more: `and ${holders.length - HOLDERS_SHOWN} more`,
  };
}

const NAME_PROBLEMS = {
  nameBlank: 'Give the role a name.',
  nameTooLong: `Shorten the name to ${ROLE_NAME_MAXIMUM} characters or fewer.`,
  nameTaken: 'A role with that name already exists.',
} as const;

export function nameProblem(typed: string, roles: readonly DemoRole[], except: string | null) {
  const problem = roleNameProblem(
    typed,
    roles.filter((role) => role.id !== except).map(({ name }) => name),
  );

  return problem == null ? null : NAME_PROBLEMS[problem];
}

export function replacements(roles: readonly DemoRole[], removing: DemoRole, held: string[]) {
  return replacementsFor(
    roles.map((role) => ({
      ...role,
      seededAs: role.owner ? 'owner' : null,
      permissions: role.grant,
    })),
    removing,
    held,
  );
}

export function removeLine(holders: number): string {
  if (holders === 0) return 'Nobody has this role.';
  if (holders === 1) return '1 person has this role. Move them to:';

  return `${holders} people have this role. Move them to:`;
}

/** Who is looking: Folake, the owner, unless a link names Julien, an Administrator. */
export interface RolesViewer {
  name: string;
  role: string;
  held: string[];
}

export const FOLAKE: RolesViewer = { name: YOU.name, role: 'Owner', held: grantFor('Owner') };
export const JULIEN: RolesViewer = {
  name: 'Julien Moreau',
  role: 'Administrator',
  held: grantFor('Administrator'),
};

export const ROLES_STATES = [
  'list',
  'eventManager',
  'saved',
  'unsaved',
  'owner',
  'newRole',
  'newBlank',
  'locked',
  'doorStaff',
  'removing',
  'loading',
  'failed',
] as const;

export type RolesState = (typeof ROLES_STATES)[number];

export function rolesStateOf(name: string | undefined): RolesState {
  return ROLES_STATES.find((state) => state === name) ?? 'list';
}

export type Load = 'loaded' | 'loading' | 'retrying' | 'failed';

export interface RolesStart {
  viewer: RolesViewer;
  load: Load;
  roles: DemoRole[];
  /** A role's id, `new`, or null for the list (on its side, the first role you can change). */
  open: string | null;
  grant: string[] | null;
  saved: boolean;
  removing: boolean;
  nameRefused: boolean;
}

export function rolesStart(state: RolesState): RolesStart {
  const roles = sampleRoles();
  const base: RolesStart = {
    viewer: FOLAKE,
    load: 'loaded',
    roles,
    open: null,
    grant: null,
    saved: false,
    removing: false,
    nameRefused: false,
  };
  const eventManager = idOf('Event manager');

  switch (state) {
    case 'list':
      return base;
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    case 'eventManager':
      return { ...base, open: eventManager };
    case 'saved':
      return { ...base, open: eventManager, saved: true };
    case 'unsaved':
      return { ...base, open: eventManager, grant: [...grantFor('Event manager'), MARGIN] };
    case 'owner':
      return { ...base, open: idOf('Owner') };
    case 'newRole':
      return { ...base, open: 'new' };
    case 'newBlank':
      return { ...base, open: 'new', nameRefused: true };
    case 'locked':
      return { ...base, viewer: JULIEN, open: idOf('Coordinator') };
    case 'doorStaff':
      return { ...base, open: idOf('Door staff') };
    case 'removing':
      return { ...base, open: idOf('Door staff'), removing: true };
  }
}

export function firstEditable(roles: readonly DemoRole[]): string | null {
  return roles.find((role) => !role.owner)?.id ?? null;
}
