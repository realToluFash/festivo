import { tokens } from './theme/tokens.ts';

/** What a row's name and line keep beside its buttons before a role's page stacks (sc-12226). */
export const NAME_ROOM = 120;

// Each level button's padding, and its border at its widest, when picked.
const BUTTON_CHROME = 2 * tokens.spaceLg + 2 * 2;

/** The width a row's name and line keep with its buttons, at their labels' widths, beside them. */
export function roomBeside(row: number, labels: readonly number[]): number {
  const buttons = labels.reduce((sum, label) => sum + label + BUTTON_CHROME, 0);

  return row - tokens.spaceSm - buttons - Math.max(labels.length - 1, 0) * tokens.spaceXs;
}

/** One row short of room stacks every row, so a page is never part one, part the other. */
export function stacksRows(rooms: Iterable<number>): boolean {
  for (const room of rooms) if (room < NAME_ROOM) return true;

  return false;
}
