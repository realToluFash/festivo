import { nameKey } from './nameKey.ts';

/** The section already holding this name, as the API names it in its refusal. */
export function sectionHoldingName<S extends { id: string; name: string }>(
  sections: readonly S[],
  name: string,
  exceptId: string | null,
): S | null {
  const key = nameKey(name);

  return sections.find((one) => one.id !== exceptId && nameKey(one.name) === key) ?? null;
}

/** The colour fewest sections wear, the first in the palette's order on a tie. */
export function leastUsedColour<C extends string>(
  palette: readonly [C, ...C[]],
  worn: readonly C[],
): C {
  const used = (colour: C) => worn.filter((one) => one === colour).length;

  return palette.reduce((best, colour) => (used(colour) < used(best) ? colour : best));
}
