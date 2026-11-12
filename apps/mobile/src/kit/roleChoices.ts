import type { OrganisationRole } from '@soirely/api-client';
import { roleName } from '@soirely/domain';

type NamedRole = Pick<OrganisationRole, 'id' | 'seededAs' | 'name'>;

export function roleNamed(
  t: Parameters<typeof roleName>[0],
  roles: readonly NamedRole[],
  id: string,
): string {
  const role = roles.find((one) => one.id === id);

  return role == null ? '' : roleName(t, role);
}

/** What each role means, in the reader's language; a role an organisation made has no line. */
export function roleLines(
  t: (key: string) => string,
  roles: readonly NamedRole[],
): Record<string, string> {
  return Object.fromEntries(
    roles
      .filter((role) => role.seededAs != null)
      .map((role) => [role.id, t(`membersScreen.roleMeans.${role.seededAs}`)]),
  );
}

export function roleMeans<R extends string>(
  role: R,
  {
    lines,
    owned,
    off,
  }: {
    lines: Readonly<Partial<Record<R, string>>>;
    owned?: { role: R; line: string } | undefined;
    off?: { roles: readonly R[]; line: string } | undefined;
  },
): string {
  if (off?.roles.includes(role) === true) return off.line;

  return [lines[role], role === owned?.role ? owned.line : undefined]
    .filter((part) => part != null)
    .join(' ');
}
