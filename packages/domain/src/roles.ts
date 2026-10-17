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

/** Change includes reading, and an area set to nothing takes the margin with it. */
export function withLevel(held: readonly string[], area: string, level: Level): string[] {
  const others = held.filter(
    (permission) =>
      permission !== `${area}.read` &&
      permission !== `${area}.manage` &&
      (level !== 'nothing' || area !== 'budget' || permission !== MARGIN),
  );

  if (level === 'read') return [...others, `${area}.read`];
  if (level === 'change') return [...others, `${area}.read`, `${area}.manage`];

  return others;
}

export function withMargin(held: readonly string[], shown: boolean): string[] {
  const others = held.filter((permission) => permission !== MARGIN);

  return shown ? [...others, MARGIN] : others;
}

export function sameGrant(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((permission) => b.includes(permission));
}

export type RoleNameProblem = 'nameBlank' | 'nameTooLong' | 'nameTaken';

/** Trimmed, required, at most 40, and unique in the organisation ignoring case, as the API checks it. */
export function roleNameProblem(typed: string, taken: readonly string[]): RoleNameProblem | null {
  const name = typed.trim();

  if (name === '') return 'nameBlank';
  if ([...name].length > ROLE_NAME_MAXIMUM) return 'nameTooLong';
  if (taken.some((other) => other.toLowerCase() === name.toLowerCase())) return 'nameTaken';

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
