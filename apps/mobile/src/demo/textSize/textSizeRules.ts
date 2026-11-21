import { atAccessibilitySizes, fitWidest } from '../../layout/textSize.ts';

export type TextSizeChoice = 'phone' | 'default' | 'android' | 'iphone' | 'twelfth';
export type TextSizeLanguage = 'en' | 'fr' | 'es';

export const TEXT_SIZES: readonly { key: TextSizeChoice; label: string }[] = [
  { key: 'phone', label: 'This phone' },
  { key: 'default', label: 'Default' },
  { key: 'android', label: 'Android 200%' },
  { key: 'iphone', label: 'iPhone ninth step' },
  { key: 'twelfth', label: 'iPhone twelfth step' },
];

/** What the board draws: the Settings card, Home's This week, or a phone number's two boxes (sc-13281). */
export type TextSizePart = 'card' | 'week' | 'phone';
export type TextSizeWeekState = 'events' | 'nothing';

export function partOf(name: string | undefined): TextSizePart {
  return name === 'week' || name === 'phone' ? name : 'card';
}

export function weekStateOf(name: string | undefined): TextSizeWeekState {
  return name === 'nothing' ? 'nothing' : 'events';
}

export const LANGUAGES: readonly { key: TextSizeLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
  { key: 'es', label: 'Spanish' },
];

/** Android's Font size at its largest draws text 2 times; iOS's ninth step of Larger Text, 2.14 (sc-13496), and its twelfth, 3.57. */
const SCALES: Readonly<Record<Exclude<TextSizeChoice, 'phone'>, number>> = {
  default: 1,
  android: 2,
  iphone: 2.14,
  twelfth: 3.57,
};

export function scaleFor(choice: TextSizeChoice, phoneScale: number): number {
  return choice === 'phone' ? phoneScale : SCALES[choice];
}

export function textSizeOf(name: string | undefined): TextSizeChoice {
  return TEXT_SIZES.find((size) => size.key === name)?.key ?? 'phone';
}

export function languageOf(name: string | undefined): TextSizeLanguage {
  return LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

export const TAB_LABEL = 12;
/** Past 20 a label's line would not fit under the glyph in the 54 tab. */
export const TAB_LABEL_MOST = 20;
export const TAB_HEIGHT = 54;
export const TAB_GLYPH = 22;
export const TAB_GLYPH_GAP = 3;

/** One size for the bar's four labels: the widest word, measured at the selected weight and `12 × scale`, fits whole in its tab; never under 12, never over 20. */
export function tabLabelSize(scale: number, widest: number, slot: number): number {
  return Math.min(TAB_LABEL_MOST, fitWidest(TAB_LABEL, TAB_LABEL * scale, widest, slot));
}

/** The card's 60 tile gives its room to the words at the accessibility sizes. */
export function cardTileShown(scale: number): boolean {
  return !atAccessibilitySizes(scale);
}

/** Seven columns cannot hold a day's name or its date at the accessibility sizes, so the week strip gives way and the agenda carries the week (sc-13281). */
export function weekStripShown(scale: number): boolean {
  return !atAccessibilitySizes(scale);
}

/** Side by side, the country's box is under half the line, too narrow for Royaume-Uni at the accessibility sizes (qa3, #78429): from them on it sits over the number, each the field's full width. */
export function phoneCountryOverNumber(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

/** sc-13280's longest organisation name, 100 characters. */
export const LONG_ORGANISATION =
  'The Grand Ballroom Weddings, Galas and Garden Parties Company of Lagos, Lisbon, Madrid and Monterrey';

export const QA_ORGANISATION = 'QA Organisation';

/** Wider than the card's line at every size, so it continues after its @. */
export const LONG_EMAIL = 'folake.adeyemi@thegrandballroomcompany.events';
