import { ApiError, ApiUnreachableError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { readFailure } from './resetLink.ts';

function refused(code: string, status: number): ApiError {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

describe('a reset link that could not be read', () => {
  it.each([
    ['reset_link_used', 'used'],
    ['reset_link_expired', 'expired'],
    ['reset_link_invalid', 'invalid'],
  ] as const)('is dead only when the API refuses it as %s', (code, dead) => {
    expect(readFailure(refused(code, 410))).toBe(dead);
  });

  it('is Cannot reach Soirely when no answer came', () => {
    expect(readFailure(new ApiUnreachableError())).toBe('unreachable');
  });

  it('is That did not work on a server error', () => {
    expect(readFailure(refused('internal_error', 500))).toBe('unread');
  });

  it('is That did not work on a refusal that names no dead link', () => {
    expect(readFailure(refused('rate_limited', 429))).toBe('unread');
  });

  it('is That did not work on anything thrown that is not an answer', () => {
    expect(readFailure(new TypeError('bad body'))).toBe('unread');
  });
});
