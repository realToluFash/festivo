import { ApiError, type Membership } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import {
  createOrganisation,
  dropsKeysAfter,
  limitMessage,
  newOrganisationMessage,
} from './organisationCreate.ts';

const created: Membership = {
  id: 'org_9',
  name: 'Lagos Supper Club',
  countryCode: 'NG',
  contactAddress: 'folake@ire.events',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  locale: 'en',
  role: { id: 'role_9', seededAs: 'owner', name: null },
  permissions: ['organisation.manage'],
  withheldUntilTwoFactor: [],
  readOnlyUntilLinked: false,
  twoFactorDue: null,
  signInRules: {
    providerOnly: false,
    inactivityTimeoutDays: null,
    administratorsNeedTwoFactor: false,
    everyoneNeedsTwoFactor: false,
    changedAt: null,
  },
};

function refusal(
  code: string,
  status: number,
  violations: { propertyPath: string; message: string; code: string }[] = [],
  headers: Record<string, string> = {},
) {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status, violations };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status, headers }));
}

const words = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

describe('creating an organisation', () => {
  it('sends the trimmed name, the country and the device timezone', async () => {
    const create = vi.fn(async () => created);

    const outcome = await createOrganisation(
      create,
      { name: '  Lagos Supper Club ', countryCode: 'NG' },
      'Africa/Lagos',
    );

    expect(create).toHaveBeenCalledWith({
      name: 'Lagos Supper Club',
      countryCode: 'NG',
      timezone: 'Africa/Lagos',
    });
    expect(outcome).toEqual({ kind: 'created', organisation: created });
  });

  it('puts a refusal beside the fields the form has, and no other', async () => {
    const create = vi.fn(async () => {
      throw refusal('validation_failed', 422, [
        { propertyPath: 'name', message: 'Enter the name.', code: 'validation_failed' },
        { propertyPath: 'currency', message: 'Bad currency.', code: 'validation_failed' },
      ]);
    });

    const outcome = await createOrganisation(create, { name: ' ', countryCode: 'NG' }, 'UTC');

    expect(outcome).toEqual({ kind: 'refused', errors: { name: 'Enter the name.' } });
  });

  it('is a failure when the refusal names no field the form has', async () => {
    const create = vi.fn(async () => {
      throw refusal('validation_failed', 422, [
        { propertyPath: 'contactAddress', message: 'Bad address.', code: 'validation_failed' },
      ]);
    });

    expect(await createOrganisation(create, { name: 'X', countryCode: 'NG' }, 'UTC')).toEqual({
      kind: 'failed',
    });
  });

  it('reads when the limit lifts from Retry-After', async () => {
    const create = vi.fn(async () => {
      throw refusal('too_many_attempts', 429, [], { 'Retry-After': '600' });
    });
    const before = Date.now();

    const outcome = await createOrganisation(create, { name: 'Six', countryCode: 'NG' }, 'UTC');

    expect(outcome.kind).toBe('limited');
    const until = outcome.kind === 'limited' ? outcome.until : null;
    expect(until?.getTime()).toBeGreaterThanOrEqual(before + 600_000);
  });

  it('is a failure, not a refusal, for anything else', async () => {
    const create = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });

    expect(await createOrganisation(create, { name: 'X', countryCode: 'NG' }, 'UTC')).toEqual({
      kind: 'failed',
    });
  });
});

describe('the words before sending', () => {
  it("uses sc-65's blank-name message, the length after trimming, and asks for a country", () => {
    expect(newOrganisationMessage('name', '  ', words)).toBe('orgGeneral.nameBlank');
    expect(newOrganisationMessage('name', 'é'.repeat(101), words)).toBe(
      'createOrganisation.nameLong {"length":101}',
    );
    expect(newOrganisationMessage('countryCode', '', words)).toBe('forms.countryBlank');
    expect(newOrganisationMessage('name', 'Supper', words)).toBeNull();
  });

  it('names the minute the limit lifts in 24-hour time', () => {
    const until = new Date(2026, 9, 19, 14, 35);

    expect(limitMessage(until, 'en', words)).toBe(
      'createOrganisation.limitedTitle createOrganisation.limitedBody {"time":"14:35"}',
    );
    expect(limitMessage(null, 'en', words)).toBe('createOrganisation.limitedTitle');
  });
});

describe('the keys after an answer the name cannot fix', () => {
  it('drops the keys on iOS after the limit or a failure, which typing cannot fix', () => {
    expect(dropsKeysAfter('limited', 'ios')).toBe(true);
    expect(dropsKeysAfter('failed', 'ios')).toBe(true);
  });

  it('keeps them after a refusal of a field, and on Android after anything', () => {
    expect(dropsKeysAfter('refused', 'ios')).toBe(false);
    expect(dropsKeysAfter('limited', 'android')).toBe(false);
    expect(dropsKeysAfter('failed', 'android')).toBe(false);
  });
});
