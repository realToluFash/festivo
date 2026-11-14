import { describe, expect, it } from 'vitest';

import {
  followNumberLocales,
  followPluralLocales,
  formattingLocale,
  languageChoices,
  listFormat,
  numberFormat,
  ownLanguageName,
  pluralLocale,
} from './locales.ts';

describe('numberFormat', () => {
  it.each([
    ['en', '1,200'],
    ['en-GB', '1,200'],
    ['es', '1200'],
    ['es-MX', '1200'],
    ['fr', '1\u202f200'],
    ['pt', '1200'],
    ['pt-BR', '1200'],
  ])('writes 1,200 in %s as the shown language does, whatever the region', (locale, written) => {
    expect(numberFormat(locale).format(1200)).toBe(written);
  });

  it("groups Portugal's way, a space from five digits", () => {
    expect(numberFormat('pt-BR').format(1_365_245)).toBe('1\u00a0365\u00a0245');
  });

  it('writes a unit as the copy does: the Room heading in US units', () => {
    expect(
      numberFormat('pt-BR', { style: 'unit', unit: 'foot', unitDisplay: 'short' }).format(1200),
    ).toBe('1200 ft');
  });
});

describe('listFormat', () => {
  it('joins English without the serial comma, as British copy does', () => {
    expect(
      listFormat('en', { type: 'conjunction' }).format(['members', 'billing', 'security']),
    ).toBe('members, billing and security');
    expect(listFormat('en', { type: 'disjunction' }).format(['Apple', 'Google', 'email'])).toBe(
      'Apple, Google or email',
    );
  });

  it.each([
    ['es', 'a, b y c'],
    ['fr', 'a, b et c'],
    ['pt', 'a, b e c'],
  ])('joins %s with its own word', (locale, joined) => {
    expect(listFormat(locale, { type: 'conjunction' }).format(['a', 'b', 'c'])).toBe(joined);
  });

  it('reads no locale as the default language', () => {
    expect(listFormat(undefined, { type: 'conjunction' }).format(['a', 'b', 'c'])).toBe(
      'a, b and c',
    );
  });
});

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

describe('ownLanguageName', () => {
  it('names each language in itself, and nothing for a code Soirely does not offer', () => {
    expect(ownLanguageName('fr')).toBe('Français');
    expect(ownLanguageName('pt')).toBe('Português');
    expect(ownLanguageName('de')).toBeNull();
    expect(ownLanguageName(null)).toBeNull();
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

describe('followNumberLocales', () => {
  const written = (lng: string, value: number): string => {
    let number: ((lng: string | undefined, options: object) => (value: unknown) => string) | null =
      null;
    followNumberLocales({
      addCached(_name, format) {
        number = format;
      },
    });

    return number!(lng, {})(value);
  };

  it.each([
    ['en', '1,000', '10,000', '1,000,000'],
    ['es', '1000', '10.000', '1.000.000'],
    ['fr', '1\u202f000', '10\u202f000', '1\u202f000\u202f000'],
    ['pt', '1000', '10\u00a0000', '1\u00a0000\u00a0000'],
  ])('writes %s numbers the way CLDR writes them', (lng, thousand, tenThousand, million) => {
    expect([written(lng, 1000), written(lng, 10000), written(lng, 1000000)]).toEqual([
      thousand,
      tenThousand,
      million,
    ]);
  });

  it('writes a number under 1000 as it always read', () => {
    expect(written('fr', 999)).toBe('999');
  });
});

describe('formattingLocale', () => {
  it.each([
    ['en', 'en-GB', 'en-GB'],
    ['en', 'en-US', 'en-US'],
    ['pt', 'pt-BR', 'pt-BR'],
    ['pt', 'pt_PT', 'pt-PT'],
  ])(
    'keeps the device region when the screen is in its language: %s on %s',
    (shown, device, tag) => {
      expect(formattingLocale(shown, device)).toBe(tag);
    },
  );

  it('writes a hand-picked language alone, never with the device region', () => {
    expect(formattingLocale('es', 'en-GB')).toBe('es');
  });

  it('writes the screen language when the device speaks one we have no catalogue for', () => {
    expect(formattingLocale('en', 'de-DE')).toBe('en');
  });

  it.each([null, undefined, '', 'en-!!'])('falls back to the screen language for %j', (device) => {
    expect(formattingLocale('en', device)).toBe('en');
  });

  it('writes an en-GB date in British order and an en-US one in American order', () => {
    const day = { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' } as const;
    const moment = new Date('2026-10-24T06:30:00Z');

    expect(new Intl.DateTimeFormat(formattingLocale('en', 'en-GB'), day).format(moment)).toBe(
      'Saturday 24 Oct',
    );
    expect(new Intl.DateTimeFormat(formattingLocale('en', 'en-US'), day).format(moment)).toBe(
      'Saturday, Oct 24',
    );
  });
});
