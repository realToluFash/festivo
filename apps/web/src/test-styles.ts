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
