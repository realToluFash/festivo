import {
  ApiError,
  GUEST_GROUPS_MOST,
  GUEST_GROUP_NAME_MAXIMUM,
  type GroupChoice,
  type GuestGroup,
} from '@soirely/api-client';
import { type TFunction } from 'i18next';

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
export function groupOptions(
  groups: readonly GuestGroup[],
  typed: string,
): { groups: GuestGroup[]; create: string | null } {
  const words = typed.trim().replaceAll(/\s+/gu, ' ');
  const folded = foldedName(words);
  const found = sortedGroups(groups).filter((one) => foldedName(one.name).includes(folded));

  return { groups: found, create: words === '' || sameGroup(groups, words) != null ? null : words };
}

export function choiceOf(groups: readonly GuestGroup[], typed: string): GroupChoice {
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

/** Escape in an open Group list closes the list, not the form around it. */
export function listOpen(key: KeyboardEvent): boolean {
  return key.target instanceof Element && key.target.getAttribute('aria-expanded') === 'true';
}

export function problemLine(
  t: TFunction,
  groups: readonly GuestGroup[],
  name: string,
  problem: GroupProblem,
  where: 'groups' | 'form',
): string {
  if (problem === 'blank') return t('guestGroups.blank');
  if (problem === 'tooLong') return t('guestGroups.tooLong', { most: GUEST_GROUP_NAME_MAXIMUM });
  if (problem === 'taken')
    return t('guestGroups.taken', { name: sameGroup(groups, name)?.name ?? name.trim() });

  return t(where === 'form' ? 'guestGroups.limitForm' : 'guestGroups.limit', {
    most: GUEST_GROUPS_MOST,
  });
}

export function refusedLine(error: unknown, ...paths: string[]): string | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;

  return error.problem.violations?.find((one) => paths.includes(one.propertyPath))?.message ?? null;
}

/** What the API said of a guest's group on save: a new name refused, or a group deleted meanwhile. */
export function groupRefusal(error: unknown): string | null {
  return refusedLine(error, 'group.name', 'group.id');
}

/** The problem a pick would meet on save: a new name over 60, or a new group past the event's 50. */
export function choiceLine(
  t: TFunction,
  groups: readonly GuestGroup[],
  choice: GroupChoice | undefined,
): string | undefined {
  if (choice == null || !('name' in choice)) return undefined;
  const problem = groupProblem(groups, choice.name);

  return problem == null || problem === 'taken'
    ? undefined
    : problemLine(t, groups, choice.name, problem, 'form');
}
