import { tokens } from '../theme/tokens.ts';
import { atAccessibilitySizes } from './textSize.ts';
import { cancelUnder } from './titleFit.ts';

/** sc-77159: from the eighth step the line under the Language sheet's title leaves the head for the top of the list, so the head keeps only the title and Done. */
export function lineInList(fontScale: number): boolean {
  return atAccessibilitySizes(fontScale);
}

/** Main's 12 between the title and Done below the eighth step; from it the house title row's 10, as sc-72136's Cancel. */
export function doneGap(fontScale: number): number {
  return lineInList(fontScale) ? tokens.spaceMd : tokens.spaceLg;
}

export function doneUnder({
  room,
  widest,
  done,
  fontScale,
  forced,
}: {
  room: number;
  widest: number;
  done: number;
  fontScale: number;
  forced: boolean;
}): boolean {
  return forced || cancelUnder({ room, widest, cancel: done, gap: doneGap(fontScale) });
}
