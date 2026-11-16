import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { currencyChoices, currencyCodeChoices } from './zoneAndCurrencyChoices.ts';

const t = ((key: string, options?: { code?: string }) =>
  key === 'orgGeneral.currencyRetired' ? `${options?.code} (no longer in use)` : key) as TFunction;

describe('currencyCodeChoices', () => {
  it('offers the set Settings > General does, by code A to Z in any language', () => {
    const codes = currencyCodeChoices('NGN', 'NGN', 'fr', t).map((one) => one.label);

    expect(codes).toEqual(
      currencyChoices('NGN', 'NGN', 'en', t)
        .map((one) => one.value)
        .sort(),
    );
    expect(codes).toEqual(currencyCodeChoices('NGN', 'NGN', 'en', t).map((one) => one.label));
    expect(codes.indexOf('GBP')).toBeLessThan(codes.indexOf('USD'));
  });

  it('keeps a held code no longer offered first, under its retired label', () => {
    expect(currencyCodeChoices('DEM', 'DEM', 'en', t).slice(0, 2)).toEqual([
      { value: 'DEM', label: 'DEM (no longer in use)' },
      { value: 'AED', label: 'AED' },
    ]);
  });
});
