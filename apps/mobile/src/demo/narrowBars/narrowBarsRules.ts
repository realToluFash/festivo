import { tabBarGeometry } from '../../components/bodyEdges.ts';
import { fitWidest } from '../../layout/textSize.ts';
import { TAB_LABEL, eventBarLabelSize, tabLabelStart } from '../../layout/tabLabel.ts';

export const barGeometry = tabBarGeometry;

/** Today's bar never draws under the default size (sc-37298). `widest` is measured at `tabLabelStart(scale)`. */
export function todayLabelSize(scale: number, widest: number, slot: number): number {
  const start = tabLabelStart(scale);

  if (widest <= 0 || slot <= 0) return start;

  return fitWidest(TAB_LABEL, start, widest, slot);
}

/** An event's bar steps its labels down together, never under 10 (sc-71148). */
export function eventLabelSize(scale: number, widest: number, slot: number): number {
  return eventBarLabelSize(scale, widest, slot);
}

/** Whether a word `widest` wide at `start` stays whole at `size` in a tab `slot` wide. */
export function staysWhole(widest: number, start: number, size: number, slot: number): boolean {
  return (widest * size) / start <= slot;
}

export type NarrowWidth = 'narrow' | 'main' | 'phone';
export type NarrowSize = 'default' | 'android' | 'phone';
export type NarrowLanguage = 'en' | 'fr' | 'es' | 'pt';
export type NarrowEventBar = 'owner' | 'outsider';

export const WIDTHS: readonly { key: NarrowWidth; label: string }[] = [
  { key: 'narrow', label: '320dp' },
  { key: 'main', label: '360dp, as on main' },
  { key: 'phone', label: 'This phone' },
];

export const SIZES: readonly { key: NarrowSize; label: string }[] = [
  { key: 'default', label: 'Default, 100%' },
  { key: 'android', label: 'Android 200%' },
  { key: 'phone', label: 'This phone' },
];

export const LANGUAGES: readonly { key: NarrowLanguage; label: string }[] = [
  { key: 'fr', label: 'French' },
  { key: 'pt', label: 'Portuguese' },
  { key: 'es', label: 'Spanish' },
  { key: 'en', label: 'English' },
];

export const EVENT_BARS: readonly { key: NarrowEventBar; label: string }[] = [
  { key: 'owner', label: 'The owner’s five tabs' },
  { key: 'outsider', label: 'An outsider’s three (sc-68438)' },
];

const PICKED_WIDTH: Readonly<Record<Exclude<NarrowWidth, 'phone'>, number>> = {
  narrow: 320,
  main: 360,
};

const PICKED_SCALE: Readonly<Record<Exclude<NarrowSize, 'phone'>, number>> = {
  default: 1,
  android: 2,
};

export function widthFor(choice: NarrowWidth, phoneWidth: number): number {
  return choice === 'phone' ? phoneWidth : PICKED_WIDTH[choice];
}

export function scaleFor(choice: NarrowSize, phoneScale: number): number {
  return choice === 'phone' ? phoneScale : PICKED_SCALE[choice];
}

function pick<Key extends string>(
  options: readonly { key: Key }[],
  name: string | undefined,
  otherwise: Key,
): Key {
  return options.find((option) => option.key === name)?.key ?? otherwise;
}

export const widthOf = (name: string | undefined) => pick(WIDTHS, name, 'narrow');
export const sizeOf = (name: string | undefined) => pick(SIZES, name, 'default');
export const languageOf = (name: string | undefined) => pick(LANGUAGES, name, 'fr');
export const eventBarOf = (name: string | undefined) => pick(EVENT_BARS, name, 'owner');
