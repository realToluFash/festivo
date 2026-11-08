/** Same as the API's SectionNameNormaliser: case and accents do not make two names different (sc-3998). */
export function sectionNameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

/** The section already holding this name, as the API names it in its refusal. */
export function sectionHoldingName<S extends { id: string; name: string }>(
  sections: readonly S[],
  name: string,
  exceptId: string | null,
): S | null {
  const key = sectionNameKey(name);

  return sections.find((one) => one.id !== exceptId && sectionNameKey(one.name) === key) ?? null;
}

/** The colour fewest sections wear, the first in the palette's order on a tie. */
export function leastUsedColour<C extends string>(
  palette: readonly [C, ...C[]],
  worn: readonly C[],
): C {
  const used = (colour: C) => worn.filter((one) => one === colour).length;

  return palette.reduce((best, colour) => (used(colour) < used(best) ? colour : best));
}
