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

/** A sentence carrying an address breaks after its @ rather than inside a word (sc-70353). */
export function breakAfterAt(sentence: string): string {
  return sentence.replaceAll('@', `@${BREAK}`);
}
