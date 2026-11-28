import { picksShown } from '@soirely/domain';

import { atAccessibilitySizes, fitWidest, labelStart } from './textSize.ts';

export const ROW_TYPE = { title: 16, value: 15 } as const;

export function rowStarts(scale: number, cap: number): { title: number; value: number } {
  return {
    title: labelStart(ROW_TYPE.title, scale, cap),
    value: labelStart(ROW_TYPE.value, scale, cap),
  };
}

export interface RowMeasure {
  scale: number;
  cap: number;
  /** The row's width for its words: the menu less its side padding, the gap and the ›. */
  room: number;
  gap: number;
  title: number;
  titleWidest: number;
  /** The widest piece of the first `shown` picks, and of the "+N more" drawn after them, at the value's start. */
  valueWidestAt: (shown: number) => number;
  count: number;
  /** The line beside the title with the first `shown` picks, then "+N more" when any are left: its two texts measured apart and added up, as main's `usePicksFit`. */
  besideAt: (shown: number) => number;
  /** The same line as the one text the value under the title draws as. */
  underAt: (shown: number) => number;
}

export interface RowDrawn {
  stacked: boolean;
  shown: number;
  titleSize: number;
  valueSize: number;
}

function wholeIn(count: number, widthAt: (shown: number) => number, room: number): number {
  const shown = picksShown(count, (each) => widthAt(each) <= room);

  return widthAt(shown) <= room ? shown : 0;
}

export function rowDrawn(row: RowMeasure): RowDrawn {
  const starts = rowStarts(row.scale, row.cap);
  const beside = row.room - row.title - row.gap;
  const oneLine = { stacked: false, titleSize: starts.title, valueSize: starts.value };

  if (!atAccessibilitySizes(row.scale))
    return { ...oneLine, shown: picksShown(row.count, (each) => row.besideAt(each) <= beside) };

  const besideShown = wholeIn(row.count, row.besideAt, beside);
  const under = wholeIn(row.count, row.underAt, row.room);

  if (besideShown > 0 && besideShown >= under) return { ...oneLine, shown: besideShown };

  // Only a line that shows a word wider than the row steps down: picks that fit whole on one line already fit.
  const shown = Math.max(under, 1);

  return {
    stacked: true,
    shown,
    titleSize: fitWidest(ROW_TYPE.title, starts.title, row.titleWidest, row.room),
    valueSize: fitWidest(ROW_TYPE.value, starts.value, row.valueWidestAt(shown), row.room),
  };
}

/** "+N more" with its spaces unbreakable, so it moves to the next line whole rather than splitting. */
export function keptWhole(tail: string): string {
  return tail.replace(/ /gu, '\u00a0');
}
