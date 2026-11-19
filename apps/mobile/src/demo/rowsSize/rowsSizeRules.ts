import { capUnderTitle, fitWidest, titleSize } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

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

/** The page title Settings draws at this scale, which caps everything under it (sc-67338): 43 from the ninth step on. */
export function settingsCap(tablet: boolean, scale: number): number {
  return titleSize(tablet ? tokens.typeTitleFrameCompact.size : tokens.typeTitleFrame.size, scale);
}

/** Where a label starts before its words are fitted: `size × scale`, no larger than `cap`, never under `size`. */
export function labelStart(size: number, scale: number, cap: number): number {
  return size * capUnderTitle(cap, size, scale);
}

/** A label's size: its start while its widest word, measured at the start, fits `room`; else the largest at which that word fits, never under `size`. */
export function labelSize(size: number, start: number, widest: number, room: number): number {
  return fitWidest(size, start, widest, room);
}

/** The line under a title starts no larger than the title draws, so a stepped-down title never has a larger line under it. */
export function lineStart(line: number, scale: number, cap: number, title: number): number {
  return labelStart(line, scale, Math.min(cap, title));
}

/** The pieces a label may wrap between: its words, each split after a hyphen it already has, so `two-factor,` is `two-` and `factor,` (the AC: a break after a hyphen is not a break inside a word). */
export function piecesIn(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\s+/u)
        .flatMap((word) => word.replace(/([-\u2010])/gu, '$1\n').split('\n'))
        .filter((piece) => piece !== ''),
    ),
  ];
}
