import { atAccessibilitySizes, fitWidest, labelStart } from '../../layout/textSize.ts';

export type CountFound = 'one' | 'five' | 'none' | 'unfiltered';

export const COUNT_FOUND: readonly { key: CountFound; label: string }[] = [
  { key: 'five', label: 'A type · 5 found' },
  { key: 'one', label: 'A type · 1 found' },
  { key: 'none', label: 'A type · nothing found' },
  { key: 'unfiltered', label: 'No filter · 12 found' },
];

export const FOUND_COUNT: Readonly<Record<CountFound, number>> = {
  five: 5,
  one: 1,
  none: 0,
  unfiltered: 12,
};

export const COUNT_TYPE = { count: 16, clear: 15 } as const;

export interface CountLineMeasure {
  scale: number;
  cap: number;
  /** The line's width: the page less its side padding. */
  room: number;
  gap: number;
  /** Each text on one line, at its start. */
  count: number;
  clear: number;
  /** The widest word of each, at its start. */
  countWidest: number;
  clearWidest: number;
}

export interface CountLineDrawn {
  stacked: boolean;
  countSize: number;
  clearSize: number;
}

export function countLineStarts(scale: number, cap: number): { count: number; clear: number } {
  return {
    count: labelStart(COUNT_TYPE.count, scale, cap),
    clear: labelStart(COUNT_TYPE.clear, scale, cap),
  };
}

/** sc-75214: side by side while both fit whole on one line, as a value cell; at the accessibility sizes, Clear filters goes under the count once they cannot. */
export function countLineDrawn(line: CountLineMeasure): CountLineDrawn {
  const starts = countLineStarts(line.scale, line.cap);
  const fits = line.count + line.gap + line.clear <= line.room;

  // A word wider than its own line still steps down, as everywhere else (sc-69816).
  return {
    stacked: atAccessibilitySizes(line.scale) && !fits,
    countSize: fitWidest(COUNT_TYPE.count, starts.count, line.countWidest, line.room),
    clearSize: fitWidest(COUNT_TYPE.clear, starts.clear, line.clearWidest, line.room),
  };
}
