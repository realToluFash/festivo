import { describe, expect, it } from 'vitest';

import {
  COUNTRY_CODES,
  countryChoices,
  currencyLabel,
  deviceCountry,
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
    expect(currencyLabel('NGN', 'en')).toBe('Nigerian Naira · NGN');
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
