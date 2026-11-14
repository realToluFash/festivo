import {
  ApiError,
  GUEST_GROUPS_MOST,
  GUEST_GROUP_NAME_MAXIMUM,
  type GroupChoice,
  type GuestGroup,
} from '@soirely/api-client';
import { type GroupProblem, groupProblem, sameGroup } from '@soirely/domain';
import { type TFunction } from 'i18next';

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
