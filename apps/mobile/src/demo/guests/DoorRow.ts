import { tokens } from '../../theme/tokens.ts';

/** The mark's slot at the row's start, as ReplyMark's MarkSlot draws it. */
const MARK_SLOT = 28;

/** The name column's width beside Arrived: the row less the mark, the button and the row's two gaps. */
export function nameRoomBeside(row: number, button: number): number {
  return row - MARK_SLOT - button - 2 * tokens.spaceLg;
}

/** Until the row, the button and the name's widest word are measured, Arrived stays beside the name; after that it moves under it once that word no longer fits beside it, so a name never breaks inside a word (sc-95416). */
export function arrivedUnder({
  row,
  button,
  widest,
}: {
  row: number;
  button: number;
  widest: number;
}): boolean {
  if (row === 0 || button === 0 || widest === 0) return false;

  return widest > nameRoomBeside(row, button);
}
