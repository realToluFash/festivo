/** How many of `count` picks show whole before "+N more" (sc-39348): all of them when the whole list fits, else the most of the first ones that fit with "+N more" after them, and never fewer than one, which alone is then cut. */
export function picksShown(count: number, fits: (shown: number) => boolean): number {
  if (count === 0 || fits(count)) return count;
  for (let shown = count - 1; shown > 1; shown -= 1) if (fits(shown)) return shown;

  return 1;
}

/** The first `shown` picks, joined by commas only: a list "+N more" follows goes on, so it takes no "and" in any language. */
export function picksLead(picks: readonly string[], shown: number): string {
  return picks.slice(0, shown).join(', ');
}
