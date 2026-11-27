/** On a phone the organisation pill sits in the primary's row, or alone on Home; a page standing in for a screen takes its body's top away, so the pill stands alone over it on every screen (sc-26270, sc-83881). */
export function phonePillAlone(
  onHome: boolean,
  screenHasPrimary: boolean,
  standingIn: boolean,
): boolean {
  if (standingIn) return true;

  return onHome && !screenHasPrimary;
}

export const PILL_BESIDE_TABS = { gap: 12, fewest: 120 } as const;

/** On an upright iPad the tabs stay centred and what stands at the band's left gives way: it stops `gap` short of them, the pill's 12 by default, and with under 120 to fill the pill is its tile alone (ux, sc-30410), as it is where its words would not fit whole (`pillShowsWords`, sc-38149). */
export function pillBesideTabs(
  rowWidth: number,
  tabsWidth: number,
  gap: number = PILL_BESIDE_TABS.gap,
): { maxWidth: number } | null {
  if (rowWidth <= 0 || tabsWidth <= 0) return null;

  return { maxWidth: Math.max(0, (rowWidth - tabsWidth) / 2 - gap) };
}
