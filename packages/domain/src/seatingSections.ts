/** The colour fewest sections wear, the first in the palette's order on a tie. */
export function leastUsedColour<C extends string>(
  palette: readonly [C, ...C[]],
  worn: readonly C[],
): C {
  const used = (colour: C) => worn.filter((one) => one === colour).length;

  return palette.reduce((best, colour) => (used(colour) < used(best) ? colour : best));
}
