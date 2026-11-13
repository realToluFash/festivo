/** Same as the API's NameNormaliser::key: case and accents do not make two names different, for a section (sc-3998) or a guest (sc-1468). */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}
