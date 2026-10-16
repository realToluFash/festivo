import { describe, expect, it } from 'vitest';

import { COUNTRY_CODES, countryChoices, currencyLabel, timezoneLabel } from './regions.ts';

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
});
