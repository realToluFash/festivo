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

/** An address as one line of text, free to break after its @ first and before a dot of the part ahead of it; the domain stays whole. A heading of one Text, as the role sheet's, is measured as iOS draws it, which a row of runs beside a role's line was not (sc-70353). */
export function headingAddress(name: string): string | null {
  const runs = addressRuns(name);
  if (runs == null) return null;

  return `${runs[0]}${BREAK}${runs[1].replaceAll(BREAK, '')}`;
}

/** An address, or a sentence carrying one, free to break after its @ when it is wider than its line. Its accessibility label stays as written (sc-70353). */
export function breakableEmail(text: string): string {
  return text.replace('@', `@${BREAK}`);
}
