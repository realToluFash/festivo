import { fitWidest } from '../../layout/textSize.ts';

export type RowsSize = 'device' | 'default' | 'ninth' | 'tenth' | 'eleventh' | 'twelfth';
export type RowsLanguage = 'en' | 'fr';
export type RowsName = 'qa' | 'long';

export const ROWS_SIZES: readonly { key: RowsSize; label: string }[] = [
  { key: 'device', label: 'This device' },
  { key: 'default', label: 'Default' },
  { key: 'ninth', label: 'Ninth step (AX2)' },
  { key: 'tenth', label: 'Tenth step (AX3)' },
  { key: 'eleventh', label: 'Eleventh step (AX4)' },
  { key: 'twelfth', label: 'Twelfth step (AX5)' },
];

export const ROWS_LANGUAGES: readonly { key: RowsLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
];

export const ROWS_NAMES: readonly { key: RowsName; label: string }[] = [
  { key: 'qa', label: 'QA Organisation' },
  { key: 'long', label: 'One long word' },
];

export const ORGANISATION_NAMES: Readonly<Record<RowsName, string>> = {
  qa: 'QA Organisation',
  long: 'Internationalisationsorganisationsgesellschaft',
};

// React Native's fontScale on iOS at each step, as sc-68441's board.
const SCALES: Readonly<Record<Exclude<RowsSize, 'device'>, number>> = {
  default: 1,
  ninth: 2.143,
  tenth: 2.643,
  eleventh: 3.143,
  twelfth: 3.571,
};

export function rowsScale(size: RowsSize, deviceScale: number): number {
  return size === 'device' ? deviceScale : SCALES[size];
}

// Main's `TYPE.row` and `TYPE.small` (SettingsParts), and the dense column's sizes on a tablet on its side.
const ROW = { title: 16, line: 13.5 };
const ROW_DENSE = { title: 15.5, line: 13 };

/** A row's title and its line as main draws them. */
export function rowType(dense: boolean): { title: number; line: number } {
  return dense ? ROW_DENSE : ROW;
}

/** A label's size: its start while its widest word, measured at the start, fits `room`; else the largest at which that word fits, never under `size`. */
export function labelSize(size: number, start: number, widest: number, room: number): number {
  return fitWidest(size, start, widest, room);
}
