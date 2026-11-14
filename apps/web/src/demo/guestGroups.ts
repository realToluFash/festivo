import type { Guest } from './guests.ts';
import { figure } from './guestsWords.ts';

/** sc-3775: an event's groups (Bride's side, Work), one per guest, their companions following them; the checks, the counts and the words. */
export interface GuestGroup {
  id: string;
  name: string;
}

export type GroupPick = { id: string } | { name: string } | null;

export type GroupFilter = string | typeof NO_GROUP;

export const NO_GROUP = 'none';
export const GROUP_NAME_MOST = 60;
export const GROUPS_MOST = 50;

const plural = (count: number, one: string, many: string) =>
  `${figure(count)} ${count === 1 ? one : many}`;

export const GGW = {
  groups: 'Groups',
  groupsCount: (count: number) => `Groups · ${figure(count)}`,
  group: 'Group',
  noGroup: 'No group',
  inGroup: (name: string) => `Group: ${name}`,
  newGroup: 'New group',
  placeholder: 'Like Bride’s side or Work',
  createGroup: 'Create group',
  createNamed: (name: string) => `Create “${name}”`,
  chooserHint: 'Choose a group, or type a new name.',
  madeOnSave: (name: string) => `${name} is a new group. It’s made when you save.`,
  clearGroup: 'Clear the group',
  groupList: 'Groups on this event',
  noMatch: (typed: string) => `No group called “${typed}”.`,
  options: (count: number) => plural(count, 'group to choose', 'groups to choose'),
  blank: 'Enter a name for the group.',
  tooLong: `A group name can be up to ${figure(GROUP_NAME_MOST)} characters.`,
  taken: (name: string) => `There’s already a group called ${name}.`,
  limit: `This event has ${figure(GROUPS_MOST)} groups, the most it can have. Delete one to make another.`,
  limitForm: `This event has ${figure(GROUPS_MOST)} groups, the most it can have. Choose one of them, or delete one in Groups to make another.`,
  ofMost: (count: number) => `${figure(count)} of ${figure(GROUP_NAME_MOST)} characters`,
  created: (name: string) => `${name} created.`,
  renamed: (name: string) => `Renamed to ${name}.`,
  deleted: (name: string) => `${name} deleted.`,
  rename: 'Rename',
  renameLabel: (name: string) => `New name for ${name}`,
  save: 'Save',
  cancel: 'Cancel',
  done: 'Done',
  delete: 'Delete',
  deleteNamed: (name: string) => `Delete ${name}`,
  renameNamed: (name: string) => `Rename ${name}`,
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteLine: (guests: number) =>
    guests === 0
      ? 'No one is in it, so no guest changes group.'
      : `${plural(guests, 'guest is', 'guests are')} in it, with their companions. They stay on the guest list, with no group. No guest is deleted.`,
  deleteGo: 'Delete group',
  peopleLine: (people: number, guests: number, companions: number) =>
    `${plural(people, 'person', 'people')} · ${plural(guests, 'guest', 'guests')} and ${
      companions === 0 ? 'no companions' : plural(companions, 'companion', 'companions')
    }`,
  addsUp: (people: number) =>
    `The groups and No group add up to ${plural(people, 'person', 'people')}, everyone on the list.`,
  readOnly:
    'You can see the groups. Making, renaming and deleting them is for people who manage guests.',
  noneYet: 'No groups yet',
  noneYetLine:
    'Make one in New group, or from a guest’s form with Create. A guest is in one group at most.',
  noneYetViewer: 'People who manage guests can make them.',
  chips: 'Groups',
} as const;

/** Case and accents aside, as the API compares names within an event. */
export function foldedName(name: string): string {
  return name
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[’‘`]/gu, "'")
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** Counted in code points after trimming, as the API counts it. */
export function groupNameLength(name: string): number {
  return [...name.trim()].length;
}

export function sortedGroups(groups: readonly GuestGroup[]): GuestGroup[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function sameGroup(
  groups: readonly GuestGroup[],
  name: string,
  except: string | null = null,
): GuestGroup | null {
  const folded = foldedName(name);

  return groups.find((one) => one.id !== except && foldedName(one.name) === folded) ?? null;
}

export type GroupProblem = 'blank' | 'tooLong' | 'taken' | 'limit';

/** The checks in their order: blank, over 60, a name already used, then 50 groups (when making one; a rename keeps the count). */
export function groupProblem(
  groups: readonly GuestGroup[],
  name: string,
  renaming: string | null = null,
): GroupProblem | null {
  if (name.trim() === '') return 'blank';
  if (groupNameLength(name) > GROUP_NAME_MOST) return 'tooLong';
  if (sameGroup(groups, name, renaming) != null) return 'taken';
  if (renaming == null && groups.length >= GROUPS_MOST) return 'limit';

  return null;
}

export function groupLine(
  groups: readonly GuestGroup[],
  name: string,
  problem: GroupProblem,
  where: 'groups' | 'form' = 'groups',
): string {
  if (problem === 'blank') return GGW.blank;
  if (problem === 'tooLong') return GGW.tooLong;
  if (problem === 'taken') return GGW.taken(sameGroup(groups, name)?.name ?? name.trim());

  return where === 'form' ? GGW.limitForm : GGW.limit;
}

let made = 0;

export function makeGroup(
  groups: readonly GuestGroup[],
  name: string,
): { groups: GuestGroup[]; group: GuestGroup } {
  made += 1;
  const group = { id: `g-new-${made}`, name: name.trim() };

  return { groups: [...groups, group], group };
}

/** One name everywhere at once: guests hold the group's id, so the list, the chips and the details all read the new name. */
export function renameGroup(groups: readonly GuestGroup[], id: string, name: string): GuestGroup[] {
  return groups.map((one) => (one.id === id ? { ...one, name: name.trim() } : one));
}

export function deleteGroup(
  groups: readonly GuestGroup[],
  list: readonly Guest[],
  id: string,
): { groups: GuestGroup[]; list: Guest[] } {
  return {
    groups: groups.filter((one) => one.id !== id),
    list: list.map((one) => {
      if (one.group !== id) return one;
      const left = { ...one };

      delete left.group;

      return left;
    }),
  };
}

export function settleGroup(
  groups: readonly GuestGroup[],
  pick: GroupPick,
): { groups: GuestGroup[]; id: string | null } {
  if (pick == null) return { groups: [...groups], id: null };
  if ('id' in pick) return { groups: [...groups], id: pick.id };
  const found = sameGroup(groups, pick.name);

  if (found != null) return { groups: [...groups], id: found.id };
  const fresh = makeGroup(groups, pick.name);

  return { groups: fresh.groups, id: fresh.group.id };
}

export function withGroup(one: Guest, id: string | null): Guest {
  if (id != null) return { ...one, group: id };
  const left = { ...one };

  delete left.group;

  return left;
}

export function groupOptions(
  groups: readonly GuestGroup[],
  typed: string,
): { groups: GuestGroup[]; create: string | null } {
  const words = typed.trim();
  const folded = foldedName(words);
  const found = sortedGroups(groups).filter((one) => foldedName(one.name).includes(folded));

  return { groups: found, create: words === '' || sameGroup(groups, words) != null ? null : words };
}

export interface GroupCount {
  group: GuestGroup | null;
  people: number;
  guests: number;
  companions: number;
}

/** sc-99's counts by group: guests and their companions, No group as a group of its own, so they add up to everyone on the list. */
export function groupCounts(
  list: readonly Guest[],
  groups: readonly GuestGroup[],
): { rows: GroupCount[]; none: GroupCount; total: number } {
  const known = new Set(groups.map((one) => one.id));
  const countOf = (group: GuestGroup | null): GroupCount => {
    const guests = list.filter((one) =>
      group == null ? one.group == null || !known.has(one.group) : one.group === group.id,
    );
    const companions = guests.reduce((sum, one) => sum + one.companions.length, 0);

    return { group, people: guests.length + companions, guests: guests.length, companions };
  };

  return {
    rows: sortedGroups(groups).map(countOf),
    none: countOf(null),
    total: list.reduce((sum, one) => sum + 1 + one.companions.length, 0),
  };
}

export function groupNameOf(groups: readonly GuestGroup[], id: string | undefined): string | null {
  return id == null ? null : (groups.find((one) => one.id === id)?.name ?? null);
}

export function inGroupFilter(one: Guest, filter: GroupFilter | null): boolean {
  if (filter == null) return true;

  return filter === NO_GROUP ? one.group == null : one.group === filter;
}

/** The wedding's groups in the sample: four with people in them; the rest of the list has none. */
export const WEDDING_GROUPS: readonly GuestGroup[] = [
  { id: 'g-bride', name: 'Bride’s side' },
  { id: 'g-groom', name: 'Groom’s side' },
  { id: 'g-work', name: 'Work' },
  { id: 'g-school', name: 'Old school friends' },
];

const WEDDING_MEMBERS: Readonly<Record<string, string>> = {
  musa: 'g-bride',
  amaka: 'g-bride',
  folasade: 'g-bride',
  ngozi: 'g-bride',
  emeka: 'g-bride',
  kwame: 'g-groom',
  yusuf: 'g-groom',
  seun: 'g-groom',
  joaquin: 'g-groom',
  camille: 'g-work',
  sophie: 'g-work',
  ines: 'g-work',
  marta: 'g-school',
  lucia: 'g-school',
  tomas: 'g-school',
};

export function groupedWedding(list: readonly Guest[]): Guest[] {
  return list.map((one) => {
    const id = WEDDING_MEMBERS[one.id];

    return id == null ? one : { ...one, group: id };
  });
}

export function fullGroups(): GuestGroup[] {
  return [
    ...WEDDING_GROUPS,
    ...Array.from({ length: GROUPS_MOST - WEDDING_GROUPS.length }, (_, at) => ({
      id: `g-table-${at + 1}`,
      name: `Table ${figure(at + 1)} friends`,
    })),
  ];
}

export interface GroupsStart {
  typed?: string;
  tried?: boolean;
  renaming?: { id: string; typed: string; tried?: boolean };
  deleting?: string;
  said?: string;
}

export interface GroupFieldStart {
  typed?: string;
  open?: boolean;
  refused?: GroupProblem;
}
