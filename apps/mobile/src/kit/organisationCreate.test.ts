import { ApiError, type Membership } from '@soirely/api-client';
import { describe, expect, it, vi } from 'vitest';

import { createOrganisation } from './organisationCreate.ts';

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
  withheldUntilLinked: [],
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

function walk(name: string, timezone = 'UTC') {
  return { name, country: 'NG', device: { country: 'NG', zone: timezone } };
}

describe('creating an organisation', () => {
  it('sends the trimmed name, the country and the device timezone', async () => {
    const create = vi.fn(async () => created);

    const outcome = await createOrganisation(create, walk('  Lagos Supper Club ', 'Africa/Lagos'));

    expect(create).toHaveBeenCalledWith({
      name: 'Lagos Supper Club',
      countryCode: 'NG',
      timezone: 'Africa/Lagos',
    });
    expect(outcome).toEqual({ kind: 'created', made: created });
  });

  it('puts a refusal beside the fields the form has, and no other', async () => {
    const create = vi.fn(async () => {
      throw refusal('validation_failed', 422, [
        { propertyPath: 'name', message: 'Enter the name.', code: 'validation_failed' },
        { propertyPath: 'currency', message: 'Bad currency.', code: 'validation_failed' },
      ]);
    });

    const outcome = await createOrganisation(create, walk(' '));

    expect(outcome).toEqual({ kind: 'refused', errors: { name: 'Enter the name.' } });
  });

  it('is a failure when the refusal names no field the form has', async () => {
    const create = vi.fn(async () => {
      throw refusal('validation_failed', 422, [
        { propertyPath: 'contactAddress', message: 'Bad address.', code: 'validation_failed' },
      ]);
    });

    expect(await createOrganisation(create, walk('X'))).toEqual({
      kind: 'failed',
    });
  });

  it('reads when the limit lifts from Retry-After', async () => {
    const create = vi.fn(async () => {
      throw refusal('too_many_attempts', 429, [], { 'Retry-After': '600' });
    });
    const before = Date.now();

    const outcome = await createOrganisation(create, walk('Six'));

    expect(outcome.kind).toBe('limited');
    const until = outcome.kind === 'limited' ? outcome.until : null;
    expect(until?.getTime()).toBeGreaterThanOrEqual(before + 600_000);
  });

  it('is a failure, not a refusal, for anything else', async () => {
    const create = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });

    expect(await createOrganisation(create, walk('X'))).toEqual({
      kind: 'failed',
    });
  });
});
