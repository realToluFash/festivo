import { describe, expect, it } from 'vitest';

import { COUNTRY_CHROME, countryBoxBeside, countryOverNumber } from './phoneCountryFit.ts';

describe('the country over the number once its name does not fit beside it (sc-7579, #104845)', () => {
  it('gives the country its basis and a third of the room left beside the number', () => {
    expect(countryBoxBeside(328)).toBe(140);
    expect(countryBoxBeside(358)).toBe(150);
    expect(countryBoxBeside(300)).toBe(300);
  });

  it('keeps the country beside the number while its name fits on one line', () => {
    expect(countryOverNumber(false, 140 - COUNTRY_CHROME, 328)).toBe(false);
    expect(countryOverNumber(false, 80, 328)).toBe(false);
  });

  it('puts it over the number as soon as its name would break, as "+44 Royaume-Uni" did', () => {
    expect(countryOverNumber(false, 140 - COUNTRY_CHROME + 0.5, 328)).toBe(true);
    expect(countryOverNumber(false, 121, 328)).toBe(true);
  });

  it('stays beside until both are measured, and is always over at the accessibility sizes', () => {
    expect(countryOverNumber(false, null, 328)).toBe(false);
    expect(countryOverNumber(false, 200, null)).toBe(false);
    expect(countryOverNumber(true, 10, 600)).toBe(true);
  });
});
