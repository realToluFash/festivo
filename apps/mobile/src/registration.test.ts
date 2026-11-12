import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { registrationRefusal } from './registration.ts';

function refusal(status: number, code: string, extra: object = {}, headers: object = {}) {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra };

  return new ApiError(
    problem,
    new Response(JSON.stringify(problem), { status, headers: { ...headers } }),
  );
}

describe('a refused registration', () => {
  /** Registration never says an address is taken (sc-512): no answer is read that way. */
  it('reads no refusal as a taken address', () => {
    expect(registrationRefusal(refusal(409, 'conflict'), 'en')).toEqual({ kind: 'failed' });
  });

  it('words a breached password itself, and keeps every other message as the API sent it', () => {
    const status = registrationRefusal(
      refusal(422, 'validation_failed', {
        violations: [
          { propertyPath: 'password', message: 'Breached.', code: 'password_breached' },
          { propertyPath: 'name', message: 'Indique su nombre.', code: 'validation_failed' },
          { propertyPath: 'name', message: 'A second one.', code: 'validation_failed' },
        ],
      }),
      'es',
    );

    expect(status).toEqual({
      kind: 'refused',
      fields: { password: 'breached', name: { message: 'Indique su nombre.' } },
    });
  });

  it('names the minute the sign-up limit lifts, from Retry-After', () => {
    const status = registrationRefusal(
      refusal(429, 'too_many_attempts', {}, { 'Retry-After': '900' }),
      'en',
    );

    expect(status.kind).toBe('rateLimited');
    expect(status.kind === 'rateLimited' && status.retryAt).toMatch(/^\d{2}:\d{2}$/);
  });

  it('is a general failure when nothing says which field, or there is no time to name', () => {
    expect(registrationRefusal(new Error('offline'), 'en')).toEqual({ kind: 'failed' });
    expect(registrationRefusal(refusal(429, 'too_many_attempts'), 'en')).toEqual({
      kind: 'failed',
    });
  });
});
