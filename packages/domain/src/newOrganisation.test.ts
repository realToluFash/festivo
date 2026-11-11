import { ApiError } from '@soirely/api-client';
import { describe, expect, it, vi } from 'vitest';

import { currencyLabel } from './regions.ts';
import type { Translate } from './eventWords.ts';
import {
  countrySearch,
  createNewOrganisation,
  foundingCurrencyWords,
  newOrganisationEntered,
  newOrganisationLimit,
  newOrganisationRefusal,
} from './newOrganisation.ts';

const words = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as Translate;

function refusal(
  code: string,
  fields: Record<string, string> = {},
  headers: Record<string, string> = {},
): ApiError {
  const problem = {
    type: `https://soirely.com/errors/${code}`,
    title: code,
    status: 422,
    violations: Object.entries(fields).map(([propertyPath, message]) => ({
      propertyPath,
      message,
      code,
    })),
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status: 422, headers }));
}

const walk = {
  name: '  Lagos Supper Club ',
  country: 'NG',
  device: { country: 'GH', zone: 'Africa/Lagos' },
};

function refusing(error: Error) {
  return () => createNewOrganisation(() => Promise.reject(error), walk);
}

describe('creating an organisation', () => {
  it('sends the trimmed name, the country and the device timezone', async () => {
    const create = vi.fn(async () => 'made');

    expect(await createNewOrganisation(create, walk)).toEqual({
      kind: 'created',
      made: 'made',
    });
    expect(create).toHaveBeenCalledWith({
      name: 'Lagos Supper Club',
      countryCode: 'NG',
      timezone: 'Africa/Lagos',
    });
  });

  it('puts a refusal beside the fields the walk has, and no other', async () => {
    const answer = refusing(
      refusal('validation_failed', { name: 'Enter the name.', currency: 'Bad currency.' }),
    );

    expect(await answer()).toEqual({ kind: 'refused', errors: { name: 'Enter the name.' } });
  });

  it('is a failure when the refusal names no field the walk has', async () => {
    const answer = refusing(refusal('validation_failed', { contactAddress: 'Bad address.' }));

    expect(await answer()).toEqual({ kind: 'failed' });
  });

  it('reads when the limit lifts from Retry-After, and no time when none came', async () => {
    const before = Date.now();
    const timed = await refusing(refusal('too_many_attempts', {}, { 'Retry-After': '600' }))();
    const untimed = await refusing(refusal('too_many_attempts'))();

    expect(timed.kind === 'limited' && timed.until?.getTime()).toBeGreaterThanOrEqual(
      before + 600_000,
    );
    expect(untimed).toEqual({ kind: 'limited', until: null });
  });

  it('is a failure, not a refusal, for anything else', async () => {
    expect(await refusing(new TypeError('Network request failed'))()).toEqual({ kind: 'failed' });
    expect(await refusing(refusal('internal_error'))()).toEqual({ kind: 'failed' });
  });
});

describe('the words before sending', () => {
  it("uses sc-65's blank-name message, the length after trimming, and asks for a country", () => {
    expect(newOrganisationRefusal('name', '  ', words)).toBe('orgGeneral.nameBlank');
    expect(newOrganisationRefusal('name', 'é'.repeat(101), words)).toBe(
      'createOrganisation.nameLong {"length":101}',
    );
    expect(newOrganisationRefusal('countryCode', '', words)).toBe('forms.countryBlank');
    expect(newOrganisationRefusal('name', 'Supper', words)).toBeNull();
  });

  it('names the minute the limit lifts in 24-hour time', () => {
    expect(newOrganisationLimit(new Date(2026, 9, 19, 14, 35), 'en', words)).toEqual({
      title: 'createOrganisation.limitedTitle',
      body: 'createOrganisation.limitedBody {"time":"14:35"}',
    });
    expect(newOrganisationLimit(null, 'en', words).body).toBeNull();
  });
});

describe('what Cancel asks', () => {
  it('asks only once a name is typed or the country is not the device’s', () => {
    const lisbon = { country: 'PT', zone: 'Europe/Lisbon' };

    expect(newOrganisationEntered({ name: ' ', country: 'PT', device: lisbon })).toBe(false);
    expect(newOrganisationEntered({ name: 'Lumen', country: 'PT', device: lisbon })).toBe(true);
    expect(newOrganisationEntered({ name: '', country: 'BR', device: lisbon })).toBe(true);
    expect(
      newOrganisationEntered({ name: '', country: null, device: { country: null, zone: 'UTC' } }),
    ).toBe(false);
  });
});

describe('the currency a country founds with', () => {
  const currencies = new Map([
    ['PT', 'EUR'],
    ['AQ', null],
  ]);

  it('names it as currencyLabel does, and one with none as none yet', () => {
    expect(foundingCurrencyWords('PT', currencies, 'en', words)).toEqual({
      words: currencyLabel('EUR', 'en'),
      none: false,
    });
    expect(foundingCurrencyWords('AQ', currencies, 'en', words)).toEqual({
      words: 'createOrganisation.noneYet',
      none: true,
    });
  });

  it('says nothing while the currencies are not read, or for a country they leave out', () => {
    expect(foundingCurrencyWords('PT', null, 'en', words)).toBeNull();
    expect(foundingCurrencyWords('BR', currencies, 'en', words)).toBeNull();
    expect(foundingCurrencyWords(null, currencies, 'en', words)).toBeNull();
  });
});

describe('the country search', () => {
  const countries = [{ name: 'Brazil' }, { name: 'Gibraltar' }, { name: 'Portugal' }];

  it('narrows by a case-insensitive includes, everything for a blank search', () => {
    expect(countrySearch(countries, ' BRA ', 'en')).toEqual([
      { name: 'Brazil' },
      { name: 'Gibraltar' },
    ]);
    expect(countrySearch(countries, '  ', 'en')).toBe(countries);
  });

  it('lowercases in the reader’s language', () => {
    const turkish = [{ name: 'İran' }, { name: 'Irak' }];

    expect(countrySearch(turkish, 'i', 'tr')).toEqual([{ name: 'İran' }]);
    expect(countrySearch(turkish, 'ı', 'tr')).toEqual([{ name: 'Irak' }]);
  });
});
