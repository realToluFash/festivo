import { picksShown } from '@soirely/domain';

import { atAccessibilitySizes, fitWidest, labelStart } from '../../layout/textSize.ts';

export type FilterSize = 'device' | 'default' | 'seventh' | 'ax1' | 'ax2' | 'ax3' | 'ax4' | 'ax5';
export type FilterLanguage = 'en' | 'fr';
export type FilterPicks = 'none' | 'twoTypes' | 'longHost';

export const FILTER_SIZES: readonly { key: FilterSize; label: string }[] = [
  { key: 'device', label: 'This device' },
  { key: 'default', label: 'Default' },
  { key: 'seventh', label: 'Seventh step' },
  { key: 'ax1', label: 'AX1' },
  { key: 'ax2', label: 'AX2' },
  { key: 'ax3', label: 'AX3' },
  { key: 'ax4', label: 'AX4' },
  { key: 'ax5', label: 'AX5' },
];

export const FILTER_LANGUAGES: readonly { key: FilterLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
];

export const FILTER_PICKS: readonly { key: FilterPicks; label: string }[] = [
  { key: 'none', label: 'Nothing chosen' },
  { key: 'twoTypes', label: 'Two types' },
  { key: 'longHost', label: 'A long host' },
];

// React Native's fontScale on iOS at each step, as sc-68441's and sc-69816's boards.
const SCALES: Readonly<Record<Exclude<FilterSize, 'device'>, number>> = {
  default: 1,
  seventh: 1.353,
  ax1: 1.786,
  ax2: 2.143,
  ax3: 2.643,
  ax4: 3.143,
  ax5: 3.571,
};

export function filterScale(size: FilterSize, deviceScale: number): number {
  return size === 'device' ? deviceScale : SCALES[size];
}

export function keyOf<Key extends string>(
  options: readonly { key: Key }[],
  given: string | undefined,
  fallback: Key,
): Key {
  return options.find((each) => each.key === given)?.key ?? fallback;
}

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
