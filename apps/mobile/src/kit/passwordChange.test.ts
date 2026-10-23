import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { passwordRefusal, setCodeRefusal } from './passwordChange.ts';

const t = ((key: string, options?: Record<string, unknown>) =>
  options == null ? key : `${key} ${JSON.stringify(options)}`) as never;

function refused(
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): ApiError {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status, headers }));
}

describe('a refused password change', () => {
  it('puts a wrong current password under the current field', () => {
    expect(passwordRefusal(refused('invalid_credentials', 401), t, 'en')).toEqual({
      field: 'currentPassword',
      message: 'passwordCard.wrongCurrent',
    });
  });

  it('puts the same password and a breached one under the new field, in the card words', () => {
    const same = refused('validation_failed', 422, {
      violations: [{ propertyPath: 'newPassword', message: 'Same.', code: 'password_unchanged' }],
    });
    const breached = refused('validation_failed', 422, {
      violations: [
        { propertyPath: 'newPassword', message: 'Breached.', code: 'password_breached' },
      ],
    });

    expect(passwordRefusal(same, t, 'en')).toEqual({
      field: 'newPassword',
      message: 'passwordCard.same',
    });
    expect(passwordRefusal(breached, t, 'en')).toEqual({
      field: 'newPassword',
      message: 'register.breached',
    });
  });

  it('says a pause with the time it lifts', () => {
    const paused = passwordRefusal(
      refused('too_many_attempts', 429, {}, { 'Retry-After': '600' }),
      t,
      'en',
    );

    expect(paused.field).toBe('paused');
    expect(paused.message).toMatch(/^passwordCard\.pausedBody \{"time":".+"\}$/);
  });

  it('says anything else failed, and changed nothing', () => {
    expect(passwordRefusal(new Error('offline'), t, 'en')).toEqual({
      field: 'failed',
      message: 'passwordCard.failedBody',
    });
  });
});

describe('a refused code on the way to adding a password', () => {
  it('says a wrong, run-out or spent code in the card words', () => {
    expect(setCodeRefusal(refused('verification_code_invalid', 422), t, 'en').refusal).toBe(
      'passwordCard.setCodeWrong',
    );
    expect(setCodeRefusal(refused('verification_code_expired', 422), t, 'en').refusal).toBe(
      'passwordCard.setCodeExpired',
    );
    expect(setCodeRefusal(refused('verification_code_exhausted', 422), t, 'en').refusal).toBe(
      'passwordCard.setCodeSpent',
    );
  });

  it('pauses with the time it lifts, and puts nothing under the field', () => {
    const paused = setCodeRefusal(
      refused('too_many_attempts', 429, {}, { 'Retry-After': '600' }),
      t,
      'en',
    );

    expect(paused.refusal).toBeNull();
    expect(paused.paused).toMatch(/^passwordCard\.pausedBody /);
  });
});
