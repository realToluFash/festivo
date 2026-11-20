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
