const BREAK = '\u200B';
const JOIN = '\u2060';

/** Free to break before a dot, never after a hyphen, which a reader would take for part of the address. */
function breaksBeforeDots(part: string): string {
  return part.replaceAll('.', `${BREAK}.`).replaceAll('-', `-${JOIN}`);
}

/** An address as two runs, `local@` and its domain, each free to break only before a dot; null for anything that is not one. Laid side by side in a wrapping row, the domain goes whole to the next line before either run breaks (sc-70353). */
export function addressRuns(name: string): readonly [string, string] | null {
  const at = name.lastIndexOf('@');
  if (at <= 0 || at === name.length - 1 || name.includes(' ')) return null;

  return [breaksBeforeDots(name.slice(0, at + 1)), breaksBeforeDots(name.slice(at + 1))];
}

/** The pieces `addressRuns` lets a line break between, as they are drawn; null for anything that is not an address. */
export function addressParts(name: string): readonly string[] | null {
  const runs = addressRuns(name);
  if (runs == null) return null;

  return runs.flatMap((run) => run.split(BREAK)).filter((part) => part !== '');
}

/** An address, or a sentence carrying one, free to break after its @ when it is wider than its line. Its accessibility label stays as written (sc-70353). */
export function breakableEmail(text: string): string {
  return text.replace('@', `@${BREAK}`);
}

/** A `local@` run whose @ wrapped alone onto a line of its own, given a break before the character ahead of the @, so that character goes down with it (sc-70353). */
export function atWithItsLastCharacter(run: string): string {
  return run.length < 2 ? run : `${run.slice(0, -2)}${BREAK}${run.slice(-2)}`;
}

/** Whether a laid-out line holds only the @. */
export function isLoneAt(line: string): boolean {
  return line.replaceAll(BREAK, '').trim() === '@';
}
