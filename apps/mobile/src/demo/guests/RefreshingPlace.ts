/** Widths measured on a row as drawn without Refreshing…; zero until measured. */
export interface StatusRow {
  room: number;
  /** What leads the row as drawn without the status: the title at the size it draws, or the Back pill whole. */
  lead: number;
  /** The controls after it, only those the row draws: Export, the +, the bell. */
  ends: readonly number[];
  status: number;
  gap: number;
}

/** sc-71821: Refreshing… keeps main's place on a row only in the room left once the row's lead and its controls are placed as if it were not there; until every width is measured it takes its own line, so it never takes room from them. */
export function statusFits({ room, lead, ends, status, gap }: StatusRow): boolean {
  if ([room, lead, status, ...ends].some((width) => width <= 0)) return false;

  return lead + ends.reduce((sum, width) => sum + gap + width, 0) + gap + status <= room;
}
