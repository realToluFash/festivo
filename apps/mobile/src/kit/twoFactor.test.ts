import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { codeRefusal, typedCodeProblem } from './twoFactor.ts';

function refusal(code: string, status: number, headers: Record<string, string> = {}): ApiError {
  return new ApiError(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status },
    new Response(null, { status, headers }),
  );
}

describe('a typed code', () => {
  it('is six digits from the app, spaces aside', () => {
    expect(typedCodeProblem('app', '')).toBe('twoFactor.codeBlank');
    expect(typedCodeProblem('app', '12345')).toBe('twoFactor.codeLength');
    expect(typedCodeProblem('app', '123 456')).toBeNull();
  });

  it('is anything but blank as a recovery code', () => {
    expect(typedCodeProblem('recovery', '  ')).toBe('twoFactor.recoveryBlank');
    expect(typedCodeProblem('recovery', 'abcd-efgh')).toBeNull();
  });
});

describe('a refused code', () => {
  it('reads as wrong in the words of the field it was typed in', () => {
    expect(codeRefusal(refusal('two_factor_code_invalid', 422), 'app')).toEqual({
      kind: 'wrong',
      message: 'twoFactor.codeWrong',
    });
    expect(codeRefusal(refusal('two_factor_code_invalid', 422), 'recovery')).toEqual({
      kind: 'wrong',
      message: 'twoFactor.recoveryWrong',
    });
    expect(codeRefusal(refusal('recovery_code_used', 422), 'recovery')).toEqual({
      kind: 'wrong',
      message: 'twoFactor.recoveryUsed',
    });
  });

  it('pauses entry until the time the API states', () => {
    const paused = codeRefusal(refusal('too_many_attempts', 429, { 'Retry-After': '600' }), 'app');

    expect(paused.kind).toBe('paused');
  });

  it('sends a run-out challenge back to sign-in', () => {
    expect(codeRefusal(refusal('two_factor_challenge_invalid', 401), 'app')).toEqual({
      kind: 'expired',
    });
  });
});
