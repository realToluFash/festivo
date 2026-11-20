/** The welcome screen's Language sheet as sc-77159 draws it: opened in English, opened in French, and French with Done on the row under the title. */
export const LANGUAGE_STATES = ['language', 'languageFr', 'languageFrUnder'] as const;

export type LanguageState = (typeof LANGUAGE_STATES)[number];

export interface LanguageStart {
  open: boolean;
  /** The language the demo starts in; null keeps the app's own. */
  locale: string | null;
  /** Done on the row under the title whatever the row measures, so a review sees the rule's second row where English and French never reach it. */
  doneUnder: boolean;
}

export function languageStart(state: string | undefined): LanguageStart {
  switch (state) {
    case 'language':
      return { open: true, locale: 'en', doneUnder: false };
    case 'languageFr':
      return { open: true, locale: 'fr', doneUnder: false };
    case 'languageFrUnder':
      return { open: true, locale: 'fr', doneUnder: true };
    default:
      return { open: false, locale: null, doneUnder: false };
  }
}
