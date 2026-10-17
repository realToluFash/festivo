import { ApiError } from '@soirely/api-client';
import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { codeBeforeTrip, keptProof, provingRefusal, tripRefused } from './waysProof.ts';

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

function refusal(code: string, status: number, pendingProof?: string): ApiError {
  const problem = {
    type: `https://soirely.com/errors/${code}`,
    title: 'No.',
    status,
    ...(pendingProof == null ? {} : { pendingProof }),
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('proving it is you, from Security', () => {
  it('asks for the code beside a password, and never before a trip to Google or Apple', () => {
    expect(codeBeforeTrip('password', true)).toBe(true);
    expect(codeBeforeTrip('google', true)).toBe(false);
    expect(codeBeforeTrip('apple', true)).toBe(false);
    expect(codeBeforeTrip('password', false)).toBe(false);
  });

  it('says a refused provider proof on the screen, not on a password field it does not show', () => {
    expect(provingRefusal(refusal('invalid_credentials', 401), t, 'Google', 'en')).toEqual({
      field: 'failed',
      message: 'waysCard.providerRefused {"provider":"Google"}',
    });
    expect(provingRefusal(refusal('invalid_credentials', 401), t, null, 'en')).toEqual({
      field: 'password',
      message: 'waysCard.passwordWrong',
    });
    expect(provingRefusal(refusal('two_factor_code_invalid', 422), t, 'Apple', 'en').field).toBe(
      'code',
    );
  });

  it('keeps the provider’s sign-in across a wrong code, and makes the trip again only when the trip was refused', () => {
    expect(tripRefused(refusal('two_factor_code_invalid', 422))).toBe(false);
    expect(tripRefused(refusal('recovery_code_used', 422))).toBe(false);
    expect(tripRefused(new TypeError('offline'))).toBe(false);
    expect(tripRefused(refusal('invalid_credentials', 401))).toBe(true);
    expect(tripRefused(refusal('proof_required', 403))).toBe(true);
  });

  it('retries a code with the kept proof, never the single-use sign-in', () => {
    expect(keptProof(refusal('two_factor_code_invalid', 422, 'p-1'), null)).toBe('p-1');
    expect(keptProof(refusal('two_factor_code_invalid', 422), 'p-1')).toBe('p-1');
    expect(keptProof(new TypeError('offline'), 'p-1')).toBe('p-1');
    expect(keptProof(refusal('proof_required', 403), 'p-1')).toBeNull();
    expect(provingRefusal(refusal('proof_required', 403), t, 'Google', 'en').message).toBe(
      'waysCard.providerRefused {"provider":"Google"}',
    );
  });
});
