export type HeaderSize = 'phone' | 'default' | 'ninth' | 'twelfth' | 'android';
export type HeaderLanguage = 'en' | 'fr';
export type HeaderScreen = 'name' | 'password' | 'timezone' | 'picker' | 'due-now' | 'back';

export const HEADER_SIZES: readonly { key: HeaderSize; label: string }[] = [
  { key: 'phone', label: 'This phone' },
  { key: 'default', label: 'Default' },
  { key: 'ninth', label: 'Ninth step' },
  { key: 'twelfth', label: 'Twelfth step' },
  { key: 'android', label: 'Android 200%' },
];

export const HEADER_LANGUAGES: readonly { key: HeaderLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
];

export const HEADER_SCREENS: readonly { key: HeaderScreen; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'password', label: 'Change password' },
  { key: 'timezone', label: 'Time zone' },
  { key: 'picker', label: 'Back label' },
  { key: 'due-now', label: 'Due now' },
  { key: 'back', label: 'Back pill' },
];

/** iOS's ninth step of Larger Text draws text 2.14 times, its twelfth (AX5) 53 over 17, and Android's largest Font size 2. */
const SCALES: Readonly<Record<Exclude<HeaderSize, 'phone'>, number>> = {
  default: 1,
  ninth: 2.14,
  twelfth: 3.12,
  android: 2,
};

export function scaleFor(size: HeaderSize, phoneScale: number): number {
  return size === 'phone' ? phoneScale : SCALES[size];
}

export function headerSizeOf(name: string | undefined): HeaderSize {
  return HEADER_SIZES.find((size) => size.key === name)?.key ?? 'phone';
}

export function headerLanguageOf(name: string | undefined): HeaderLanguage {
  return HEADER_LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

export function headerScreenOf(name: string | undefined): HeaderScreen {
  return HEADER_SCREENS.find((screen) => screen.key === name)?.key ?? 'name';
}
