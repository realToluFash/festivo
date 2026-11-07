import { describe, expect, it } from 'vitest';

import { ApiError } from './problem.ts';
import { proofRefusal } from './proofRefusal.ts';

function refused(code: string, headers?: Record<string, string>): ApiError {
  return new ApiError(
    { type: `https://soirely.com/errors/${code}`, title: code, status: 422 },
    headers == null ? undefined : new Response(null, { status: 429, headers }),
  );
}

describe("what /proof's refusal means to a card", () => {
  it('puts a wrong password on the password field, unless Google or Apple refused', () => {
    expect(proofRefusal(refused('invalid_credentials'))).toEqual({
      kind: 'field',
      field: 'password',
    });
    expect(proofRefusal(refused('invalid_credentials'), false)).toEqual({ kind: 'trip' });
    expect(proofRefusal(refused('proof_required'), false)).toEqual({ kind: 'trip' });
  });

  it('puts a wrong or spent code on the code field', () => {
    expect(proofRefusal(refused('two_factor_code_invalid'))).toEqual({
      kind: 'field',
      field: 'code',
    });
    expect(proofRefusal(refused('recovery_code_used'))).toEqual({ kind: 'field', field: 'code' });
  });

  it('carries the minute a limit lifts, or none when the server gave no wait', () => {
    const limited = proofRefusal(refused('too_many_attempts', { 'Retry-After': '90' }));

    expect(limited.kind).toBe('limited');
    expect(limited.kind === 'limited' && limited.until).toBeInstanceOf(Date);
    expect(proofRefusal(refused('too_many_attempts'))).toEqual({ kind: 'limited', until: null });
  });

  it('calls anything else a failure', () => {
    expect(proofRefusal(refused('proof_required'))).toEqual({ kind: 'failed' });
    expect(proofRefusal(new TypeError('Failed to fetch'))).toEqual({ kind: 'failed' });
  });
});
