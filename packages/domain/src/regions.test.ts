import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COUNTRY_CODES,
  CURRENCY_CODES,
  countryChoices,
  currencyChoices,
  currencyLabel,
  deviceCountry,
  heldCurrencyLabel,
  deviceRegion,
  timezoneLabel,
} from './regions.ts';

describe('regions', () => {
  it('lists every ISO country once', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect(COUNTRY_CODES).toContain('NG');
  });

  it("names each country in the reader's language", () => {
    const nigeria = countryChoices('fr').find((choice) => choice.code === 'NG');

    expect(nigeria?.name).toBe('Nigeria');
    expect(countryChoices('en').find((choice) => choice.code === 'DE')?.name).toBe('Germany');
  });

  it('labels a timezone by its city, then the identifier that is stored', () => {
    expect(timezoneLabel('Africa/Lagos')).toBe('Lagos · Africa/Lagos');
    expect(timezoneLabel('America/Argentina/Buenos_Aires')).toBe(
      'Buenos Aires · America/Argentina/Buenos_Aires',
    );
    expect(timezoneLabel('UTC')).toBe('UTC');
  });

  it('labels a currency by its name, then its code', () => {
    expect(currencyLabel('NGN', 'en')).toBe('Nigerian Naira (NGN)');
    expect(currencyLabel('NGN', 'fr')).toBe('naira nigérian (NGN)');
  });

  it('starts on the country the device names, else the likeliest for its language', () => {
    expect(deviceCountry(['en-NG', 'en-GB'])).toBe('NG');
    expect(deviceCountry(['fr', 'pt-PT'])).toBe('PT');
    expect(deviceCountry(['pt'])).toBe('BR');
    expect(deviceCountry(['not a tag'])).toBeNull();
    expect(deviceCountry([])).toBeNull();
  });
});

describe("the device's country", () => {
  it("takes the phone's Region setting over its language's country", () => {
    expect(deviceRegion('NG', ['en-US'])).toBe('NG');
    expect(deviceRegion('gb', ['en-US'])).toBe('GB');
  });

  it("falls back to the language's country with no Region, or one the list does not offer", () => {
    expect(deviceRegion(null, ['en-US'])).toBe('US');
    expect(deviceRegion('XX', ['pt-BR'])).toBe('BR');
  });

  it('assumes no country when nothing names one', () => {
    expect(deviceRegion(null, ['es-419'])).toBeNull();
    expect(deviceRegion(null, [])).toBeNull();
  });
});

describe('currencies', () => {
  const retired = (code: string) => `${code} (no longer in use)`;

  it('offers the currencies in use today, and not the retired ones or the X-codes that are not money', () => {
    const offered = currencyChoices('NGN', 'en', retired).map(({ code }) => code);

    expect(offered).toContain('SLE');
    expect(offered).toContain('ZWG');
    expect(offered).toContain('XOF');
    for (const code of ['SLL', 'ZWL', 'HRK', 'XXX', 'XTS', 'XAU', 'XDR', 'BOV'])
      expect(offered).not.toContain(code);
  });

  describe('on an engine that names SLE, ZWG, XCG and VED by their codes, as Chrome does', () => {
    const engineOf = Intl.DisplayNames.prototype.of;
    const unnamed = new Set(['SLE', 'ZWG', 'XCG', 'VED']);

    function engineNaming(name: (code: string) => string | undefined) {
      vi.spyOn(Intl.DisplayNames.prototype, 'of').mockImplementation(function (
        this: Intl.DisplayNames,
        code: string,
      ) {
        return name(code) ?? engineOf.call(this, code);
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('names every currency it offers, in each language', () => {
      engineNaming((code) => (unnamed.has(code) ? code : undefined));

      for (const locale of ['en', 'es', 'fr', 'pt'])
        for (const code of CURRENCY_CODES)
          expect(currencyLabel(code, locale), `${code} in ${locale}`).not.toBe(code);
    });

    it("names the four from CLDR in the reader's language", () => {
      engineNaming((code) => (unnamed.has(code) ? code : undefined));

      expect(['en', 'es', 'fr', 'pt'].map((locale) => currencyLabel('SLE', locale))).toEqual([
        'Sierra Leonean Leone (SLE)',
        'leona sierraleonesa (SLE)',
        'leone sierra-léonais (SLE)',
        'Leone de Serra Leoa (SLE)',
      ]);
      expect(['en', 'es', 'fr', 'pt'].map((locale) => currencyLabel('ZWG', locale))).toEqual([
        'Zimbabwean Gold (ZWG)',
        'oro zimbabuense (ZWG)',
        'or du Zimbabwe (ZWG)',
        'Ouro zimbabueano (ZWG)',
      ]);
      expect(['en', 'es', 'fr', 'pt-BR'].map((locale) => currencyLabel('XCG', locale))).toEqual([
        'Caribbean guilder (XCG)',
        'florín caribeño (XCG)',
        'florin caribéen (XCG)',
        'Florim do Caribe (XCG)',
      ]);
      for (const locale of ['en', 'es', 'fr', 'pt'])
        expect(currencyLabel('VED', locale), locale).toBe('Bolívar Soberano (VED)');
    });

    it('keeps the name the engine gives, for these four too once it knows them', () => {
      engineNaming((code) =>
        code === 'XCG' ? 'florim caribenho' : unnamed.has(code) ? code : undefined,
      );

      expect(currencyLabel('NGN', 'fr')).toBe('naira nigérian (NGN)');
      expect(currencyLabel('XCG', 'pt-PT')).toBe('florim caribenho (XCG)');
    });
  });

  it("sorts by the name in the reader's language", () => {
    const names = currencyChoices('NGN', 'fr', retired).map(({ name }) => name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
    expect(names).toContain('naira nigérian (NGN)');
  });

  it('puts a held currency that is no longer offered first, and offers it only while held', () => {
    expect(currencyChoices('SLL', 'en', retired)[0]).toEqual({
      code: 'SLL',
      name: 'SLL (no longer in use)',
    });
    expect(currencyChoices('SLE', 'en', retired).map(({ code }) => code)).not.toContain('SLL');
    expect(currencyChoices('', 'en', retired)).toHaveLength(CURRENCY_CODES.length);
  });

  it("shows an organisation's own currency, one no longer offered, and none", () => {
    expect(heldCurrencyLabel('NGN', 'en', retired)).toBe('Nigerian Naira (NGN)');
    expect(heldCurrencyLabel('XXX', 'en', retired)).toBe('XXX (no longer in use)');
    expect(heldCurrencyLabel('', 'en', retired)).toBe('');
  });

  it("lists exactly the codes the API's Regions::CURRENCIES accepts", () => {
    const source = readFileSync(
      new URL('../../../services/api/src/Domain/Organisation/Regions.php', import.meta.url),
      'utf8',
    );
    const constant = /CURRENCIES = \[([^\]]*)\]/.exec(source)?.[1] ?? '';

    expect(constant.match(/[A-Z]{3}/g)).toEqual([...CURRENCY_CODES]);
    expect(new Set(CURRENCY_CODES).size).toBe(CURRENCY_CODES.length);
  });
});
