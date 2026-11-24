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

/** An address, or a sentence carrying one, free to break after its @ when it is wider than its line. Its accessibility label stays as written (sc-70353). */
export function breakableEmail(text: string): string {
  return text.replace('@', `@${BREAK}`);
}
