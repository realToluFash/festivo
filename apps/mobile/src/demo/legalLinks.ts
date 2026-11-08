import { LOCALES } from '@soirely/domain';

/** The web's Terms and Privacy pages (sc-28982), which the app links from Welcome, Create account and Settings (sc-29938). */
export type LegalDoc = 'terms' | 'privacy';

/** The words the web's footer uses; the linguist sets the other three languages. */
export const LEGAL_WORDS: Record<LegalDoc, string> = { terms: 'Terms', privacy: 'Privacy' };

export function legalDoc(asked: string | undefined): LegalDoc {
  return asked === 'privacy' ? 'privacy' : 'terms';
}

/** What the demo's note says a link would open: the page, from this build's environment, in the app's language. */
export function linkNote(doc: LegalDoc, locale: string, environment: string, os: string) {
  const language = LOCALES.find((each) => each.code === locale)?.name ?? 'English';
  const browser = os === 'android' ? 'a Chrome Custom Tab' : 'Safari’s in-app browser';

  return {
    title: `Demo: ${LEGAL_WORDS[doc]} opens in the in-app browser`,
    address: `The web app’s /${doc}, from the place this build talks to (${environment}), in ${language}, the app’s language.`,
    browser: `In the app, ${browser} opens over the screen, and closing it comes back to the screen as it was. The page is not built yet.`,
  };
}
