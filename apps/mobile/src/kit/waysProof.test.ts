import { ApiError } from '@soirely/api-client';
import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  codeBeforeTrip,
  firstFactor,
  keptOnceCodeAsked,
  keptProof,
  keptProofRanOut,
  provingRefusal,
  signedInWith,
  tripRefused,
} from './waysProof.ts';

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

function refusal(
  code: string,
  status: number,
  pendingProof?: string,
  providerEmail?: string,
): ApiError {
  const problem = {
    type: `https://soirely.com/errors/${code}`,
    title: 'No.',
    status,
    ...(pendingProof == null ? {} : { pendingProof }),
    ...(providerEmail == null ? {} : { providerEmail }),
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

  it('answers a code asked after Google with the kept proof, and never sends the spent sign-in again', () => {
    const signIn = { code: 'g-code', codeVerifier: 'v', redirectUri: 'soirely://oauth' } as never;
    const kept = keptOnceCodeAsked('google', refusal('two_factor_required', 403, 'p-1'), null);

    expect(kept).toBe('p-1');
    expect(firstFactor('google', kept, signIn, '')).toEqual({ pendingProof: 'p-1' });
    expect(firstFactor('google', null, signIn, '')).toEqual({ provider: 'google', signIn });
    expect(
      keptOnceCodeAsked('password', refusal('two_factor_required', 403, 'p-1'), null),
    ).toBeNull();
    expect(firstFactor('password', null, null, 'pw')).toEqual({ password: 'pw' });
  });

  it('goes back to step one only when a kept proof ran out, not on any refusal', () => {
    expect(keptProofRanOut(refusal('proof_required', 403), true)).toBe(true);
    expect(keptProofRanOut(refusal('proof_required', 403), false)).toBe(false);
    expect(keptProofRanOut(refusal('two_factor_code_invalid', 422, 'p-1'), true)).toBe(false);
  });
});

describe('step two after Google or Apple (sc-2197)', () => {
  const asked = refusal('two_factor_required', 403, 'p-1', 'folake.adeyemi@gmail.com');

  it('names the address the provider vouched for once the code is asked for', () => {
    expect(signedInWith('google', asked, null)).toEqual({ email: 'folake.adeyemi@gmail.com' });
    expect(
      signedInWith(
        'apple',
        refusal('two_factor_required', 403, 'p-1', 'x7@privaterelay.appleid.com'),
        null,
      ),
    ).toEqual({ email: 'x7@privaterelay.appleid.com' });
  });

  it('shows the box alone when the provider gave no address', () => {
    expect(signedInWith('google', refusal('two_factor_required', 403, 'p-1'), null)).toEqual({
      email: null,
    });
  });

  it('keeps the box and the address across a wrong code', () => {
    const shown = signedInWith('google', asked, null);

    expect(signedInWith('google', refusal('two_factor_code_invalid', 422, 'p-1'), shown)).toBe(
      shown,
    );
    expect(signedInWith('google', refusal('recovery_code_used', 422, 'p-1'), shown)).toBe(shown);
    expect(signedInWith('google', new TypeError('offline'), shown)).toBe(shown);
  });

  it('drops it when the trip has to be made again, and never shows it beside a password', () => {
    const shown = signedInWith('google', asked, null);

    expect(signedInWith('google', refusal('proof_required', 403), shown)).toBeNull();
    expect(signedInWith('google', refusal('invalid_credentials', 401), shown)).toBeNull();
    expect(signedInWith('password', refusal('two_factor_required', 403), null)).toBeNull();
  });
});
