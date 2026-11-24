const BREAK = '​';

function beforeDots(part: string): string {
  return part.replaceAll('.', `${BREAK}.`);
}

/** An address as two runs, `local@` and its domain, each free to break only before a dot; null for anything that is not one. Laid side by side, the domain goes whole to the next line before either run breaks (sc-70353). */
export function addressRuns(name: string): readonly [string, string] | null {
  const at = name.lastIndexOf('@');
  if (at <= 0 || at === name.length - 1 || name.includes(' ')) return null;

  return [beforeDots(name.slice(0, at + 1)), beforeDots(name.slice(at + 1))];
}

const JOIN = '\u2060';
const UNSEEN = /[\u200B\u2060\n]/g;

function joinHyphens(part: string): string {
  return part.replaceAll('-', `-${JOIN}`);
}

/** How far a heading address has had to break: not at all, after its @, or after its @ and before its domain's dots too. */
export type HeadingBreaks = 'none' | 'at' | 'wide';

/** An address as the role sheet's one heading Text. A hyphen never ends a line, as it would read as part of the address. Once the address takes more than a line it breaks after its @, and its domain breaks before its dots only when `wide`, no line holding it (sc-70353). */
export function headingAddress(name: string, breaks: HeadingBreaks = 'none'): string | null {
  const runs = addressRuns(name);
  if (runs == null) return null;

  const [local, domain] = [joinHyphens(runs[0]), joinHyphens(runs[1])];
  if (breaks === 'none')
    return `${local.replaceAll(BREAK, '')}${BREAK}${domain.replaceAll(BREAK, '')}`;

  return `${local}\n${breaks === 'wide' ? domain : domain.replaceAll(BREAK, '')}`;
}

/** What a heading laid out with `breaks` as `lines` must break at next; the same `breaks` once it reads right. */
export function headingBreaksAfter(
  name: string,
  breaks: HeadingBreaks,
  lines: readonly string[],
): HeadingBreaks {
  if (breaks === 'none') return lines.length > 1 ? 'at' : 'none';
  if (breaks === 'wide') return 'wide';
  const domain = name.slice(name.lastIndexOf('@') + 1);

  return lines.some((line) => line.replace(UNSEEN, '') === domain) ? 'at' : 'wide';
}

/** An address, or a sentence carrying one, free to break after its @ when it is wider than its line. Its accessibility label stays as written (sc-70353). */
export function breakableEmail(text: string): string {
  return text.replace('@', `@${BREAK}`);
}
