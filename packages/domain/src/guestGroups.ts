import {
  GUEST_GROUPS_MOST,
  GUEST_GROUP_NAME_MAXIMUM,
  type GroupChoice,
  type GuestGroup,
} from '@soirely/api-client';

/** Case, accents and the curl of an apostrophe aside, as the API compares names within an event (sc-3775). */
export function foldedName(name: string): string {
  return name
    .normalize('NFKD')
    .replaceAll(/\p{Mn}/gu, '')
    .replaceAll(/[’‘`]/gu, "'")
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** Counted in code points after trimming, as the API counts it. */
export function groupNameLength(name: string): number {
  return [...name.trim().replaceAll(/\s+/gu, ' ')].length;
}

export function sortedGroups<T extends GuestGroup>(groups: readonly T[]): T[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function sameGroup<T extends GuestGroup>(
  groups: readonly T[],
  name: string,
  except: string | null = null,
): T | null {
  const folded = foldedName(name);

  return groups.find((one) => one.id !== except && foldedName(one.name) === folded) ?? null;
}

export type GroupProblem = 'blank' | 'tooLong' | 'taken' | 'limit';

/** The API's checks in its order: blank, over 60, a name already used, then 50 groups when making one. */
export function groupProblem(
  groups: readonly GuestGroup[],
  name: string,
  renaming: string | null = null,
): GroupProblem | null {
  if (name.trim() === '') return 'blank';
  if (groupNameLength(name) > GUEST_GROUP_NAME_MAXIMUM) return 'tooLong';
  if (sameGroup(groups, name, renaming) != null) return 'taken';
  if (renaming == null && groups.length >= GUEST_GROUPS_MOST) return 'limit';

  return null;
}

/** Typing on the Group field: the groups whose names hold the text, A to Z, then Create while no group is called that. */
export function groupOptions<T extends GuestGroup>(
  groups: readonly T[],
  typed: string,
): { groups: T[]; create: string | null } {
  const words = typed.trim().replaceAll(/\s+/gu, ' ');
  const folded = foldedName(words);
  const found = sortedGroups(groups).filter((one) => foldedName(one.name).includes(folded));

  return { groups: found, create: words === '' || sameGroup(groups, words) != null ? null : words };
}

export function groupChoiceOf(groups: readonly GuestGroup[], typed: string): GroupChoice {
  const words = typed.trim().replaceAll(/\s+/gu, ' ');

  if (words === '') return null;
  const found = sameGroup(groups, words);

  return found == null ? { name: words } : { id: found.id };
}

/** Whether a pick differs from the guest's group; left alone, it is undefined and the group stays. */
export function groupChanged(
  current: { id: string } | null,
  choice: GroupChoice | undefined,
): boolean {
  if (choice === undefined) return false;
  if (choice === null) return current != null;

  return !('id' in choice) || choice.id !== current?.id;
}
