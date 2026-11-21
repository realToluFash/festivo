import { atAccessibilitySizes, fitWidest, labelStart } from '../../layout/textSize.ts';

export type FilterSize = 'device' | 'default' | 'seventh' | 'ax1' | 'ax2' | 'ax3' | 'ax4' | 'ax5';
export type FilterLanguage = 'en' | 'fr';
export type FilterPicks = 'none' | 'twoTypes' | 'longHost' | 'between';
export type FilterLevel = 'top' | 'type' | 'when' | 'hosts';

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
  { key: 'between', label: 'Between dates' },
];

export const FILTER_LEVELS: readonly { key: FilterLevel; label: string }[] = [
  { key: 'top', label: 'Top level' },
  { key: 'type', label: 'Type' },
  { key: 'when', label: 'When' },
  { key: 'hosts', label: 'Hosted by' },
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

/** A drilled level's words before they are fitted: main's size × the scale at the standard sizes; from AX1, no larger than the page title's `cap` (sc-75213). */
export function drilledStart(size: number, scale: number, cap: number): number {
  return atAccessibilitySizes(scale) ? labelStart(size, scale, cap) : size * scale;
}

/** The size a drilled level's words draw at: the start while their widest piece fits `room`; from AX1, else the largest at which it fits, never under `size` (sc-69816's rule). */
export function drilledSize(
  size: number,
  scale: number,
  cap: number,
  widest: number,
  room: number,
): number {
  const start = drilledStart(size, scale, cap);

  return atAccessibilitySizes(scale) ? fitWidest(size, start, widest, room) : start;
}

/** From and To side by side as on main at the standard sizes; one above the other from AX1, so each date has the menu's width. */
export function datesStacked(scale: number): boolean {
  return atAccessibilitySizes(scale);
}
