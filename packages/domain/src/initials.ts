/** The tile beside an organisation's name: the first letter of its first two words, accents kept. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => (word.match(/\p{L}\p{M}*|\p{N}/u)?.[0] ?? '').toLocaleUpperCase())
    .join('');
}
