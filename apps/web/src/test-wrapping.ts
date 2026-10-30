import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const styles = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');

/** The elements the base styles let break inside a word, as one selector list. */
export const BREAKS_ANYWHERE = (
  /\n((?:[a-z][a-z0-9]*,\n)*[a-z][a-z0-9]*) \{\n {2}overflow-wrap: anywhere;\n\}/u.exec(
    styles,
  )?.[1] ?? ''
)
  .split(',\n')
  .join(', ');

/** Whether a word as long as the line can break inside `element` rather than widen the page. */
export function breaksAnywhere(element: Element): boolean {
  return BREAKS_ANYWHERE !== '' && element.closest(BREAKS_ANYWHERE) != null;
}
