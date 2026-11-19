import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The web's one stylesheet, as the tests read it. */
export const STYLES = stylesheet(import.meta.dirname, 'styles.css');

/** A stylesheet beside `dir`, as the tests read it. */
export function stylesheet(dir: string, file: string): string {
  return readFileSync(join(dir, file), 'utf8');
}

/** The body of the rule in `sheet` whose selector is exactly `selector`, indented or not, or '' when there is none. */
export function cssRule(selector: string, sheet: string = STYLES): string {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

  return new RegExp(`(?:^|\\n)[ \\t]*${escaped} \\{([^}]*)\\}`, 'u').exec(sheet)?.[1] ?? '';
}

/** The body of the `@media <query>` block in `sheet`, up to its own closing brace, or '' when there is none. */
export function mediaBlock(query: string, sheet: string = STYLES): string {
  const head = sheet.indexOf(`@media ${query} {`);
  if (head === -1) {
    return '';
  }
  const start = sheet.indexOf('{', head) + 1;
  let depth = 1;
  for (let at = start; at < sheet.length; at += 1) {
    depth += sheet[at] === '{' ? 1 : sheet[at] === '}' ? -1 : 0;
    if (depth === 0) {
      return sheet.slice(start, at);
    }
  }

  return '';
}
