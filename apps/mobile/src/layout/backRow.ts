/** How Back's row is built: a status that gives way, a status always beside it, or Back on its own. It never turns on whether Refreshing… shows, so the pill stays mounted when Refreshing… comes and goes (sc-27046, sc-71821). */
export type BackRow = 'givingWay' | 'beside' | 'alone';

export function backRow({
  phone,
  guestsList,
  cardNamed,
  overview = false,
}: {
  phone: boolean;
  guestsList: boolean;
  cardNamed: boolean;
  /** Overview's ‹ on a phone or upright, whose Refreshing… takes its own line above the card where both do not fit (sc-83008). */
  overview?: boolean;
}): BackRow {
  if ((phone && guestsList) || overview) return 'givingWay';

  return phone || cardNamed ? 'beside' : 'alone';
}
