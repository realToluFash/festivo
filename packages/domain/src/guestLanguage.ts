import { isSupported, type LocaleCode, narrowLocale } from './locales.ts';

export interface GuestLanguageInputs {
  /** What the guest picked on their own page. */
  chosen: string | null;
  /** The browser's languages, most wanted first. */
  browser: readonly string[];
  /** The host's Language for this guest. */
  host: string | null;
  organisation: string;
}

/** The language a guest's page opens in (sc-3790): /guest-language.json's cases hold this and the API's GuestLanguage to one rule. */
export function guestLanguage({
  chosen,
  browser,
  host,
  organisation,
}: GuestLanguageInputs): LocaleCode {
  const first = [chosen, ...browser, host].find((tag) => isSupported(tag));

  return narrowLocale(first ?? organisation);
}

/** A message has no browser to ask. */
export function guestMessageLanguage(inputs: Omit<GuestLanguageInputs, 'browser'>): LocaleCode {
  return guestLanguage({ ...inputs, browser: [] });
}
