/**
 * Four languages, resolved from the device and overridable.
 *
 * Initialised BEFORE the first render — awaited in app/_layout.tsx — because
 * rendering first shows a French reader a flash of English. Brief, and the kind
 * of thing that reads as a broken product rather than as a loading state.
 *
 * The supported set comes from /locales.json via @soirely/domain, the same file
 * the API and the web client read. Three declarations of one set are three sets
 * that will eventually disagree.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  followPluralLocales,
  followValueStops,
  formattingLocale,
  narrowLocale,
} from '@soirely/domain';
import { getLocales } from 'expo-localization';
// i18next's default export IS the instance, and `.use().init()` is the shape
// its own documentation uses. The import plugin cannot tell that apart from a
// named export reached by mistake.
/* eslint-disable import/no-named-as-default-member */
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

export const LANGUAGE_KEY = 'soirely:language';

const RESOURCES = { en, es, fr, pt } as const;

export async function initI18n(): Promise<void> {
  await i18next.use(initReactI18next).init({
    resources: Object.fromEntries(
      Object.entries(RESOURCES).map(([code, translation]) => [code, { translation }]),
    ),
    lng: await resolveLocale(),
    supportedLngs: [...LOCALE_CODES],
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
  });
  followPluralLocales(i18next.services.pluralResolver);
  followValueStops(i18next.services.interpolator);
}

/**
 * The stored choice, then the device, then English.
 *
 * The stored choice first because a person's explicit decision outranks the
 * phone's setting — somebody reading English on a Spanish phone chose that.
 */
async function resolveLocale(): Promise<string> {
  const stored = await storedLanguage();
  if (stored != null) return stored;

  // `languageTag` is a full tag such as `pt-BR`; narrowing gives a Brazilian
  // reader Portuguese rather than English, which matching the exact tag would
  // not.
  return narrowLocale(getLocales()[0]?.languageTag ?? null);
}

export function currentLocale(): string {
  return narrowLocale(i18next.resolvedLanguage ?? i18next.language);
}

/** The language the screen is shown in, which a fetch of server-written dates names so the picker asks again (sc-9267). */
export function useShownLanguage(): string {
  const { i18n } = useTranslation();

  return narrowLocale(i18n.resolvedLanguage ?? i18n.language);
}

/** What dates and times are written in: the phone's region, while it speaks the shown language. */
export function dateLocale(): string {
  return formattingLocale(currentLocale(), getLocales()[0]?.languageTag);
}

/** Null clears the override and goes back to the device setting. */
export async function setLanguage(locale: string | null): Promise<void> {
  if (locale == null) {
    await AsyncStorage.removeItem(LANGUAGE_KEY);
    await i18next.changeLanguage(narrowLocale(getLocales()[0]?.languageTag ?? null));

    return;
  }

  await AsyncStorage.setItem(LANGUAGE_KEY, locale);
  await i18next.changeLanguage(locale);
}

export async function storedLanguage(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);

  return stored != null && LOCALE_CODES.includes(stored) ? stored : null;
}
