/**
 * The languages this product speaks, for the clients.
 *
 * Read from /locales.json at the repository root — the same file the API reads.
 * A set declared separately in three places is three sets that will eventually
 * disagree, quietly, because each one works on its own.
 */
import declaration from '../../../locales.json' with { type: 'json' };

export type LocaleCode = string;

export interface Locale {
  code: LocaleCode;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  plurals?: string;
}

export const LOCALES: readonly Locale[] = declaration.supported as Locale[];
export const DEFAULT_LOCALE: LocaleCode = declaration.default;
export const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code);

export function isSupported(locale: string | null | undefined): boolean {
  return locale != null && LOCALE_CODES.includes(language(locale));
}

/**
 * Narrow anything to a supported locale, or to the default.
 *
 * Accepts the forms a client actually sends — `pt-BR`, `fr_FR`, `EN` — and
 * reduces them to the language, so a Brazilian reader gets Portuguese rather
 * than English. Matching on the exact tag is how that goes wrong.
 *
 * Mirrors SupportedLocales::narrow() on the server deliberately: the same input
 * must produce the same locale on both sides, or a guest sees one language in
 * the app and another in the email about it.
 */
export function narrowLocale(locale: string | null | undefined): LocaleCode {
  if (locale == null) return DEFAULT_LOCALE;
  const lang = language(locale);
  return LOCALE_CODES.includes(lang) ? lang : DEFAULT_LOCALE;
}

/** A region refines the shown language's dates, never replaces it: en-GB on an English screen, plain `es` on a Spanish one. */
export function formattingLocale(shown: LocaleCode, deviceTag: string | null | undefined): string {
  if (deviceTag == null || deviceTag.trim() === '' || language(deviceTag) !== shown) return shown;

  try {
    return Intl.DateTimeFormat.supportedLocalesOf(deviceTag.trim().replace(/_/g, '-'))[0] ?? shown;
  } catch {
    return shown;
  }
}

/** The tag a locale's copy is written for, whose plural rule and numbers it follows: `pt` is Portugal's, where 0 is plural and a million is «1 000 000». */
export function pluralLocale(locale: LocaleCode): string {
  return LOCALES.find((l) => l.code === locale)?.plurals ?? locale;
}

interface PluralResolver {
  getRule(code: string, options?: object): unknown;
}

/** i18next reads plural rules from the bare language, so each client routes it through pluralLocale. */
export function followPluralLocales(resolver: PluralResolver): void {
  const rule = resolver.getRule.bind(resolver);
  resolver.getRule = (code, options) => rule(pluralLocale(code), options);
}

interface Formatter {
  addCached(
    name: string,
    format: (lng: string | undefined, options: object) => (value: unknown) => string,
  ): void;
}

/** i18next writes `{{count, number}}` in the bare language, so each client routes it through pluralLocale too (sc-15361). */
export function followNumberLocales(formatter: Formatter): void {
  formatter.addCached('number', (lng, options) => {
    const format = new Intl.NumberFormat(pluralLocale(narrowLocale(lng)), options);

    return (value) => format.format(value as number);
  });
}

function language(locale: string): string {
  return locale.trim().replace(/_/g, '-').split('-')[0]!.toLowerCase();
}

/** "French · Français": the reader's word, then the language's own, so each is findable in its own words. */
export function languageChoices(
  word: (key: string) => string,
): { code: LocaleCode; name: string }[] {
  return LOCALES.map(({ code, nativeName }) => {
    const name = word(`languageNames.${code}`);

    return { code, name: name === nativeName ? name : `${name} · ${nativeName}` };
  });
}
