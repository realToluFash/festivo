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

export const LEVEL_FILLED: Record<Level, 0 | 1 | 2> = { nothing: 0, read: 1, change: 2 };

export function levelLine(level: Level, area: Pick<Area, 'name'>): string {
  if (level === 'nothing') return 'Not in their menus at all.';
  if (level === 'read') return 'Open, with no buttons.';

  return `Everything in ${area.name}.`;
}

export function levelCounts(grant: readonly string[]): Record<Level, number> {
  const counts: Record<Level, number> = { change: 0, read: 0, nothing: 0 };
  for (const { area } of AREAS) counts[levelOf(grant, area)] += 1;

  return counts;
}

export function extrasFor(area: Area): Extra[] {
  return extrasOf(area.area, area.permissions).flatMap((permission) => {
    const extra = EXTRAS[permission];

    return extra == null ? [] : [extra];
  });
}

export function extrasLine(grant: readonly string[], area: Area): string | undefined {
  if (levelOf(grant, area.area) === 'nothing') return undefined;
  const words = extrasFor(area).map(
    (extra) => `${extra.name} · ${grant.includes(extra.permission) ? extra.on : extra.off}`,
  );

  return words.length === 0 ? undefined : words.join(', ');
}

export function changedAreas(saved: readonly string[], grant: readonly string[]): number {
  return AREAS.filter(({ permissions }) =>
    permissions.some((permission) => saved.includes(permission) !== grant.includes(permission)),
  ).length;
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

/** Who held which built-in role before sc-29859 left three; nothing on screen reads it. */
const HELD_BEFORE: Record<string, string> = {
  'Folake Adeyemi': 'Owner',
  'Julien Moreau': 'Administrator',
  'Priya Shah': 'Event manager',
  'Ana Souza': 'Coordinator',
  'Tom Becker': 'Door staff',
  'Kofi Mensah': 'Read-only',
  'Marta Silva': 'Coordinator',
  'Daniel Kim': 'Coordinator',
};

export function sampleRoles(): DemoRole[] {
  return ROLES.map((role) => ({
    id: idOf(role.name),
    name: role.name,
    builtIn: role.builtIn,
    owner: role.name === 'Owner',
    grant: GRANTS[role.name] ?? [],
    holders: MEMBERS.filter(
      (member) => HELD_BEFORE[member.name] === role.name && member.status !== 'former',
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

export function kindOf(role: Pick<DemoRole, 'owner' | 'builtIn'>): string {
  if (role.owner) return 'everything';

  return role.builtIn ? 'built in' : `made by ${ORGANISATION}`;
}

export function roleLine(role: DemoRole): string {
  return `${people(role.holders.length)} · ${kindOf(role)}`;
}

export function heldLine(role: DemoRole): string {
  if (role.owner) return describeRole(role);
  const held = role.holders.length === 0 ? 'nobody' : people(role.holders.length);

  return `${role.builtIn ? 'Built in' : `Made by ${ORGANISATION}`} · held by ${held}`;
}

export function rolesCount(roles: readonly DemoRole[]): { says: string; line: string } {
  const built = roles.filter((role) => role.builtIn).length;
  const made = roles.length - built;

  return {
    says: roles.length === 1 ? '1 role' : `${roles.length} roles`,
    line: [`${built} built in`, ...(made > 0 ? [`${made} made by ${ORGANISATION}`] : [])].join(
      ' · ',
    ),
  };
}

export interface Removed {
  name: string;
  holders: number;
  movedTo: string | null;
}

export function removedCard({ name, holders, movedTo }: Removed): {
  says: string;
  line: string | null;
} {
  const line =
    holders === 0 || movedTo == null
      ? null
      : holders === 1
        ? `Its 1 person is now ${movedTo}.`
        : `Its ${holders} people are now ${movedTo}.`;

  return { says: `${name} was removed`, line };
}

export const APPLIES = "Changes apply on each person's next request. Nobody is signed out.";
export const SAVED_LINE = "Applies on each person's next request.";

export function changesLine(
  changes: number,
  holders: readonly string[],
): { count: string; rest: string } {
  const count = changes === 1 ? '1 change.' : `${changes} changes.`;
  const it = changes === 1 ? 'it' : 'them';
  if (holders.length === 0) return { count, rest: 'Nobody holds this role yet.' };
  const who =
    holders.length === 1 ? `${holders[0] ?? ''} gets ${it}` : `${people(holders.length)} get ${it}`;

  return { count, rest: `${who} on their next request. Nobody is signed out.` };
}

export function discardTitle(changes: number): string {
  return changes === 1 ? 'Discard your change?' : 'Discard your changes?';
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

/** Owner is never offered: it is given one person at a time, with a recent proof (owner, 4 Nov 2026). */
export function replacements(roles: readonly DemoRole[], removing: DemoRole, held: string[]) {
  return replacementsFor(
    roles.map((role) => ({ ...role, permissions: role.grant })),
    removing,
    held,
  ).filter((role) => !role.owner);
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
  editing: boolean;
  area: string | null;
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
    editing: false,
    area: null,
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
      return {
        ...base,
        open: eventManager,
        grant: [...grantFor('Event manager'), MARGIN],
        editing: true,
        area: 'budget',
      };
    case 'owner':
      return { ...base, open: idOf('Owner') };
    case 'newRole':
      return { ...base, open: 'new' };
    case 'newBlank':
      return { ...base, open: 'new', nameRefused: true };
    case 'locked':
      return { ...base, viewer: JULIEN, open: idOf('Coordinator'), editing: true };
    case 'doorStaff':
      return { ...base, open: idOf('Door staff') };
    case 'removing':
      return { ...base, open: idOf('Door staff'), removing: true };
  }
}

export function firstEditable(roles: readonly DemoRole[]): string | null {
  return roles.find((role) => !role.owner)?.id ?? null;
}
