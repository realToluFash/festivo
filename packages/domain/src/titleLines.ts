/** The lines a title takes in `room`, every word whole, each line filled greedily. */
export function titleLines(words: readonly number[], space: number, room: number): number {
  let lines = 1;
  let taken = 0;
  for (const word of words) {
    if (taken === 0) taken = word;
    else if (taken + space + word <= room) taken += space + word;
    else {
      lines += 1;
      taken = word;
    }
  }

  return lines;
}

/** The focused header's rule (sc-37903): the title stays beside Cancel and the verb while its widest word fits the slot and it takes at most `lines` lines. */
export function titleFitsBeside(
  words: readonly number[],
  space: number,
  slot: number,
  lines: 1 | 2 = 2,
): boolean {
  return Math.max(...words) <= slot && titleLines(words, space, slot) <= lines;
}
