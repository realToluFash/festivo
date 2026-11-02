/**
 * A guest's name, whole.
 *
 * Hosts type titles — Mr., Chief, Alhaji, Dr., Chief (Mrs.) — so the first
 * token of a name is as likely to be a title as a name. Splitting to get a
 * "first name" produces "Dear Chief", and worse, matches and deduplicates
 * against a token that is not a name.
 *
 * So there is no firstName() here, on purpose. If you want one, you want this.
 */

/** Titles seen in real guest lists. Order matters: longest first. */
const TITLES = [
  'chief (mrs.)',
  'chief (mrs)',
  'alhaja',
  'alhaji',
  'barrister',
  'engineer',
  'professor',
  'reverend',
  'doctor',
  'chief',
  'prince',
  'princess',
  'rabbi',
  'imam',
  'sir',
  'lady',
  'dame',
  'prof.',
  'prof',
  'rev.',
  'rev',
  'dr.',
  'dr',
  'mr.',
  'mr',
  'mrs.',
  'mrs',
  'ms.',
  'ms',
  'mx.',
  'mx',
  'engr.',
  'engr',
  'barr.',
  'barr',
];

export interface GuestLike {
  name?: string | null;
  title?: string | null;
}

/** The name as the host wrote it, trimmed of nothing but whitespace. */
export function guestFullName(guest: GuestLike): string {
  const title = guest.title?.trim() ?? '';
  const name = guest.name?.trim() ?? '';

  if (title === '') return name;
  if (name === '') return title;

  // Do not repeat a title the host already typed into the name.
  return startsWithTitle(name, title) ? name : `${title} ${name}`;
}

/**
 * Initials for an avatar, skipping any leading title.
 *
 * This is the one place a name is legitimately broken up, because the result is
 * decorative. It never feeds a greeting, a match or a sort.
 */
export function guestInitials(guest: GuestLike): string {
  const words = stripTitle(guestFullName(guest))
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

/** Whether a name already begins with a title — any title, not just this one. */
export function startsWithTitle(name: string, title?: string): boolean {
  const lower = name.trim().toLowerCase();

  if (title != null && title.trim() !== '' && lower.startsWith(title.trim().toLowerCase())) {
    return true;
  }

  return TITLES.some((t) => lower === t || lower.startsWith(`${t} `));
}

/** The name with a leading title removed. Decorative use only. */
export function stripTitle(name: string): string {
  const lower = name.trim().toLowerCase();
  const match = TITLES.find((t) => lower.startsWith(`${t} `));

  return match == null ? name.trim() : name.trim().slice(match.length).trim();
}

/**
 * How a list of guests sorts.
 *
 * On the whole name, with the title left ON. A guest list that sorts by a
 * stripped name puts "Chief Adaeze" under A while the screen shows C, and the
 * organiser scanning for it concludes the guest is missing.
 */
export function compareGuestNames(a: GuestLike, b: GuestLike): number {
  return guestFullName(a).localeCompare(guestFullName(b), undefined, { sensitivity: 'base' });
}
