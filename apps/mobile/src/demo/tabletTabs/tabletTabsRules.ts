import { PILL_BESIDE_TABS } from '../../kit/frameBand.ts';
import { tokens } from '../../theme/tokens.ts';

export type TabletTabsSize = 'device' | 'default' | 'android' | 'iphone';
export type TabletTabsLanguage = 'en' | 'fr' | 'es';

export const SIZES: readonly { key: TabletTabsSize; label: string }[] = [
  { key: 'device', label: 'This device' },
  { key: 'default', label: 'Default' },
  { key: 'android', label: 'Android 200%' },
  { key: 'iphone', label: 'iPad ninth step' },
];

export const LANGUAGES: readonly { key: TabletTabsLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
  { key: 'es', label: 'Spanish' },
];

const SCALES: Readonly<Record<Exclude<TabletTabsSize, 'device'>, number>> = {
  default: 1,
  android: 2,
  iphone: 2.14,
};

export function scaleFor(size: TabletTabsSize, deviceScale: number): number {
  return size === 'device' ? deviceScale : SCALES[size];
}

export function sizeOf(name: string | undefined): TabletTabsSize {
  return SIZES.find((size) => size.key === name)?.key ?? 'device';
}

export function languageOf(name: string | undefined): TabletTabsLanguage {
  return LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

/** The capsule's label at the default size (`WhiteCapsule`). */
export const CAPSULE_LABEL = 15;

/** Everything in the capsule but its words: its padding, the gaps between tabs, and each tab's sides, glyph and gap (`WhiteCapsule`). */
export const CAPSULE_CHROME =
  2 * tokens.spaceXxs + 3 * tokens.spaceHair + 4 * (13 + 18 + tokens.spaceSm + tokens.spaceXl);

/** The tile reaches 2 past its 44 where the invitation's ring sits on its corner; the bell is 44. */
export const TILE_REACH = 46;
export const BELL = tokens.sizeHit;

/** The widest the centred capsule may be and still stop 12 short of the tile with its ring and of the bell. */
export function capsuleRoom(rowWidth: number): number {
  return rowWidth - 2 * (Math.max(TILE_REACH, BELL) + PILL_BESIDE_TABS.gap);
}

/** One size for the four labels: their own size where the capsule fits at it, otherwise the largest that fits, never under 15 (sc-40401, as sc-37298). */
export function capsuleLabelSize(scale: number, labels: number, room: number): number {
  const own = CAPSULE_LABEL * scale;

  if (labels <= 0 || room <= 0 || CAPSULE_CHROME + labels <= room) return own;

  return Math.max(
    CAPSULE_LABEL,
    Math.min(own, Math.floor((own * (room - CAPSULE_CHROME)) / labels)),
  );
}

/** The tabs take their room first: while their labels are under their own size the pill is its tile. */
export function pillGivesWay(scale: number, labelSize: number): boolean {
  return labelSize < CAPSULE_LABEL * scale;
}

export function capsuleWidth(labels: number, start: number, size: number): number {
  return start > 0 ? CAPSULE_CHROME + (labels * size) / start : CAPSULE_CHROME;
}
