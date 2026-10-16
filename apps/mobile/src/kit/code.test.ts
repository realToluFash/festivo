import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { asksForCode, codeRefusal, retryAfter } from './code.ts';

function refused(code: string): ApiError {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status: 422 };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status: 422 }));
}

describe('a refused code', () => {
  it('says which refusal it was, for an email and a phone alike', () => {
    expect(codeRefusal(refused('verification_code_invalid'))).toEqual({ kind: 'wrong' });
    expect(codeRefusal(refused('verification_code_expired'))).toEqual({ kind: 'expired' });
    expect(codeRefusal(refused('verification_code_exhausted'))).toEqual({ kind: 'exhausted' });
  });

  it('calls anything else a failure on the way', () => {
    expect(codeRefusal(refused('validation_failed'))).toEqual({ kind: 'failed' });
    expect(codeRefusal(new TypeError('offline'))).toEqual({ kind: 'failed' });
  });

  it('keeps asking for a code until one is spent', () => {
    expect(asksForCode({ kind: 'wrong' })).toBe(true);
    expect(asksForCode({ kind: 'failed' })).toBe(true);
    expect(asksForCode({ kind: 'expired' })).toBe(false);
    expect(asksForCode({ kind: 'exhausted' })).toBe(false);
  });
});

describe('a resend refused for now', () => {
  it('waits as long as the server says, and no longer', () => {
    const problem = {
      type: 'https://soirely.com/errors/too_many_attempts',
      title: 'No.',
      status: 429,
    };
    const waiting = new ApiError(
      problem,
      new Response(JSON.stringify(problem), { status: 429, headers: { 'Retry-After': '42' } }),
    );

    expect(retryAfter(waiting)).toBe(42);
    expect(retryAfter(refused('validation_failed'))).toBeNull();
    expect(retryAfter(new TypeError('offline'))).toBeNull();
  });
});
