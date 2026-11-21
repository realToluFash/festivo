/** Same as the API's NameNormaliser::key: case and accents do not make two names different, for a section (sc-3998) or a guest (sc-1468). */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

/** The one already holding this name, a section or a table, as the API names it in its refusal. */
export function holdingName<S extends { id: string; name: string }>(
  named: readonly S[],
  name: string,
  exceptId: string | null,
): S | null {
  const key = nameKey(name);

  return named.find((one) => one.id !== exceptId && nameKey(one.name) === key) ?? null;
}
