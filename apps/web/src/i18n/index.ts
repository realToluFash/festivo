/**
 * Four languages, resolved from the browser and overridable.
 *
 * i18next rather than something hand-rolled, for one reason: plural families
 * and interpolation are exactly where a hand-rolled catalogue fails, and both
 * are enforced by the parity guard. A `t()` that cannot do `_one`/`_other`
 * pushes every count back into string concatenation, which only works in
 * English.
 *
 * The supported set is NOT declared here. It comes from /locales.json via
 * @soirely/domain, the same file the API reads — three declarations of one set
 * are three sets that will eventually disagree, quietly, because each works on
 * its own.
 */
import { DEFAULT_LOCALE, LOCALE_CODES, narrowLocale } from '@soirely/domain';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

export const LANGUAGE_KEY = 'soirely:language';

const RESOURCES = { en, es, fr, pt } as const;

export async function initI18n(): Promise<void> {
  await i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: Object.fromEntries(
        Object.entries(RESOURCES).map(([code, translation]) => [code, { translation }]),
      ),
      supportedLngs: [...LOCALE_CODES],
      fallbackLng: DEFAULT_LOCALE,
      // `pt-BR` resolves to `pt` rather than falling through to English, which
      // is the point of matching on language rather than on the exact tag.
      load: 'languageOnly',
      detection: {
        // The stored choice first: a person's explicit decision outranks
        // whichever browser they happen to be using today.
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANGUAGE_KEY,
        // Written by setLanguage below, so clearing the override is possible.
        // Letting the detector cache it makes "Automatic" unreachable.
        caches: [],
      },
      interpolation: { escapeValue: false },
    });

  applyDirection(currentLocale());
}

/** The resolved locale, narrowed to one we have a catalogue for. */
export function currentLocale(): string {
  return narrowLocale(i18next.resolvedLanguage ?? i18next.language);
}

/** Null clears the override and goes back to what the browser says. */
export async function setLanguage(locale: string | null): Promise<void> {
  if (locale == null) {
    localStorage.removeItem(LANGUAGE_KEY);
    await i18next.changeLanguage(undefined);
  } else {
    localStorage.setItem(LANGUAGE_KEY, locale);
    await i18next.changeLanguage(locale);
  }

  applyDirection(currentLocale());
}

/** The stored override, or null when following the browser. */
export function storedLanguage(): string | null {
  const stored = localStorage.getItem(LANGUAGE_KEY);

  return stored != null && LOCALE_CODES.includes(stored) ? stored : null;
}

/**
 * Set on <html> rather than on a wrapper, because the scrollbar, text
 * selection and native form controls read it from the document and not from
 * whatever element happens to be around them.
 */
function applyDirection(locale: string): void {
  const dir = LOCALE_CODES.includes(locale) ? 'ltr' : 'ltr';
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
}
