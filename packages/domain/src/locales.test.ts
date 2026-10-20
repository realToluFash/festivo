import { describe, expect, it } from 'vitest';

import { followPluralLocales, languageChoices, pluralLocale } from './locales.ts';

describe('languageChoices', () => {
  it("names each supported language in the reader's language, then once more in its own", () => {
    const french: Record<string, string> = {
      'languageNames.en': 'Anglais',
      'languageNames.es': 'Espagnol',
      'languageNames.fr': 'Français',
      'languageNames.pt': 'Portugais',
    };

    expect(languageChoices((key) => french[key] ?? key)).toEqual([
      { code: 'en', name: 'Anglais · English' },
      { code: 'es', name: 'Espagnol · Español' },
      { code: 'fr', name: 'Français' },
      { code: 'pt', name: 'Portugais · Português' },
    ]);
  });
});

describe('pluralLocale', () => {
  it('counts Portuguese by the European rule, where 0 takes the plural', () => {
    expect(pluralLocale('pt')).toBe('pt-PT');
    expect(new Intl.PluralRules(pluralLocale('pt')).select(0)).toBe('other');
    expect(new Intl.PluralRules(pluralLocale('pt')).select(1)).toBe('one');
  });

  it('leaves a locale with no regional rule as it is', () => {
    expect(pluralLocale('fr')).toBe('fr');
    expect(pluralLocale('en')).toBe('en');
  });
});

describe('followPluralLocales', () => {
  it('hands the resolver the plural tag in place of the bare language', () => {
    const asked: string[] = [];
    const resolver = {
      getRule(code: string): Intl.PluralRules {
        asked.push(code);
        return new Intl.PluralRules(code);
      },
    };

    followPluralLocales(resolver);
    resolver.getRule('pt');
    resolver.getRule('es');

    expect(asked).toEqual(['pt-PT', 'es']);
  });
});
