import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The web's one stylesheet, as the tests read it. */
export const STYLES = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');

/** The body of the rule whose selector is exactly `selector`, indented or not, or '' when there is none. */
export function cssRule(selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');

  return new RegExp(`(?:^|\\n)[ \\t]*${escaped} \\{([^}]*)\\}`, 'u').exec(STYLES)?.[1] ?? '';
}
