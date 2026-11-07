/** On a phone the organisation pill sits in the primary's row, or alone on Home; a screen standing in takes the primary away and leaves the pill where it was (sc-26270). */
export function phonePillAlone(
  onHome: boolean,
  screenHasPrimary: boolean,
  standingIn: boolean,
): boolean {
  if (standingIn) return onHome || screenHasPrimary;

  return onHome && !screenHasPrimary;
}
