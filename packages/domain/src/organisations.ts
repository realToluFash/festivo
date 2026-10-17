/** The one remembered on this device while the account still belongs to it, else the first. */
export function chooseOrganisation<T extends { id: string }>(
  organisations: readonly T[],
  remembered: string | null,
): T | null {
  return organisations.find(({ id }) => id === remembered) ?? organisations[0] ?? null;
}

/** A seeded role is worded in the reader's language; a role an organisation made keeps its own name. */
export function roleName(
  word: (key: string) => string,
  role: { seededAs: string | null; name: string | null },
): string {
  return role.seededAs != null ? word(`roles.${role.seededAs}`) : (role.name ?? '');
}
