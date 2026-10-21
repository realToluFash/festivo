import { roleName } from './organisations.ts';

export type Level = 'nothing' | 'read' | 'change';

export const ROLE_NAME_MAXIMUM = 40;

export const MARGIN = 'budget.margin';

/** The levels an area offers: Read only where the registry has a read permission for it. */
export function levelsOf(permissions: readonly string[]): Level[] {
  return permissions.some((permission) => permission.endsWith('.read'))
    ? ['nothing', 'read', 'change']
    : ['nothing', 'change'];
}

export function levelOf(held: readonly string[], area: string): Level {
  if (held.includes(`${area}.manage`)) return 'change';
  if (held.includes(`${area}.read`)) return 'read';

  return 'nothing';
}

/** An area's own switches beside its level, such as the budget's margin and creating events. */
export function extrasOf(area: string, permissions: readonly string[]): string[] {
  return permissions.filter(
    (permission) => permission !== `${area}.read` && permission !== `${area}.manage`,
  );
}

/** Change includes reading where the area has it, and an area set to nothing takes its extras with it. */
export function withLevel(
  held: readonly string[],
  area: string,
  level: Level,
  permissions: readonly string[],
): string[] {
  const extras = level === 'nothing' ? extrasOf(area, permissions) : [];
  const others = held.filter(
    (permission) =>
      permission !== `${area}.read` &&
      permission !== `${area}.manage` &&
      !extras.includes(permission),
  );

  const reading = permissions.includes(`${area}.read`) ? [`${area}.read`] : [];

  if (level === 'read') return [...others, ...reading];
  if (level === 'change') return [...others, ...reading, `${area}.manage`];

  return others;
}

/** The levels a caller may pick: each change it makes touches only what they hold (sc-66). */
export function settableLevels(
  grant: readonly string[],
  held: readonly string[],
  area: string,
  permissions: readonly string[],
): Level[] {
  const current = levelOf(grant, area);

  return levelsOf(permissions).filter((level) => {
    const next = withLevel(grant, area, level, permissions);
    const changed = [
      ...grant.filter((permission) => !next.includes(permission)),
      ...next.filter((permission) => !grant.includes(permission)),
    ];

    return level === current || changed.every((permission) => held.includes(permission));
  });
}

export function withExtra(held: readonly string[], extra: string, on: boolean): string[] {
  const others = held.filter((permission) => permission !== extra);

  return on ? [...others, extra] : others;
}

export function sameGrant(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((permission) => b.includes(permission));
}

export type RoleNameProblem = 'nameBlank' | 'nameTooLong' | 'nameTaken';

/** Trimmed and in NFC, as the API saves it (sc-2766): composed and decomposed accents are one name. */
export function roleNameOf(typed: string): string {
  return typed.trim().normalize('NFC');
}

/** Required, at most 40, and unique in the organisation ignoring case, as the API checks it. */
export function roleNameProblem(typed: string, taken: readonly string[]): RoleNameProblem | null {
  const name = roleNameOf(typed);
  const folded = name.toLowerCase();

  if (name === '') return 'nameBlank';
  if ([...name].length > ROLE_NAME_MAXIMUM) return 'nameTooLong';
  if (taken.some((other) => roleNameOf(other).toLowerCase() === folded)) return 'nameTaken';

  return null;
}

/** The areas a role's members will not find in their menus, and the ones they can open but not change. */
export function whatTheySee(
  held: readonly string[],
  areas: readonly string[],
): { hidden: string[]; readOnly: string[] } {
  return {
    hidden: areas.filter((area) => levelOf(held, area) === 'nothing'),
    readOnly: areas.filter((area) => levelOf(held, area) === 'read'),
  };
}

/** The roles a removed role's members may move to: only one whose every permission the caller holds (sc-66). */
export function replacementsFor<R extends { id: string; permissions: readonly string[] }>(
  roles: readonly R[],
  removing: { id: string },
  held: readonly string[],
): R[] {
  return roles.filter(
    (one) =>
      one.id !== removing.id && one.permissions.every((permission) => held.includes(permission)),
  );
}

/** What remains once a role is removed: its members counted on the role they moved to. */
export function withoutRole<R extends { id: string; holders: number }>(
  roles: readonly R[],
  removed: { id: string; holders: number },
  replacement: string | null,
): R[] {
  return roles
    .filter((one) => one.id !== removed.id)
    .map((one) =>
      one.id === replacement ? { ...one, holders: one.holders + removed.holders } : one,
    );
}

/** The names a role may not take: every other role's, a seeded one's in every language, as the API refuses them (sc-2301). */
export function takenRoleNames(
  roles: readonly { id: string; seededAs: string | null; name: string | null }[],
  except: string | undefined,
  languages: readonly ((key: string) => string)[],
): string[] {
  return roles
    .filter((one) => one.id !== except)
    .flatMap((one) => languages.map((word) => roleName(word, one)));
}

/** The areas a caller cannot change on this role, and each extra they lack wherever its area shows. */
export function lockedAreas(
  grant: readonly string[],
  held: readonly string[],
  areas: readonly { area: string; permissions: readonly string[] }[],
): string[] {
  return areas.flatMap(({ area, permissions }) => [
    ...(settableLevels(grant, held, area, permissions).length < 2 ? [area] : []),
    ...(levelOf(grant, area) === 'nothing'
      ? []
      : extrasOf(area, permissions).filter((extra) => !held.includes(extra))),
  ]);
}
