import { capsuleChrome, capsuleLabelSize as fitCapsuleLabels } from '../../layout/capsuleFit.ts';

export { CAPSULE_LABEL, capsuleRoom, pillGivesWay } from '../../layout/capsuleFit.ts';

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

/** The upright tablet's capsule of four tabs, as the app fits it (`layout/capsuleFit.ts`). */
export const CAPSULE_CHROME = capsuleChrome(4);

export function capsuleLabelSize(scale: number, labels: number, room: number): number {
  return fitCapsuleLabels(scale, 4, labels, room);
}

export function capsuleWidth(labels: number, start: number, size: number): number {
  return start > 0 ? CAPSULE_CHROME + (labels * size) / start : CAPSULE_CHROME;
}
