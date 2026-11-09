/** On a phone the organisation pill sits in the primary's row, or alone on Home; a screen standing in takes the primary away and leaves the pill where it was (sc-26270). */
export function phonePillAlone(
  onHome: boolean,
  screenHasPrimary: boolean,
  standingIn: boolean,
): boolean {
  if (standingIn) return onHome || screenHasPrimary;

  return onHome && !screenHasPrimary;
}

export const PILL_BESIDE_TABS = { gap: 12, fewest: 120 } as const;

/** On an upright iPad the tabs stay centred and the pill gives way: it stops 12 short of them, and with under 120 to fill it is its tile alone (ux, sc-30410). */
export function pillBesideTabs(
  rowWidth: number,
  tabsWidth: number,
): { maxWidth: number; tileAlone: boolean } | null {
  if (rowWidth <= 0 || tabsWidth <= 0) return null;

  const maxWidth = Math.max(0, (rowWidth - tabsWidth) / 2 - PILL_BESIDE_TABS.gap);

  return { maxWidth, tileAlone: maxWidth < PILL_BESIDE_TABS.fewest };
}
