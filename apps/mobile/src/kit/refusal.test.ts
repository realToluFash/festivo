import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { refusalFor, refusalSaid } from './refusal.ts';

function refused(extra: Record<string, unknown> = {}): ApiError {
  const problem = {
    type: 'https://soirely.com/errors/validation_failed',
    title: 'Some of the information provided is not valid.',
    status: 422,
    ...extra,
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status: 422 }));
}

describe('a refusal about one field', () => {
  it('says what the violation on that field says', () => {
    const owner = refused({
      violations: [
        { propertyPath: 'email', message: 'Not this one.', code: 'invalid' },
        {
          propertyPath: 'roleId',
          message: 'Approve with a role other than Owner.',
          code: 'role_owner',
        },
      ],
    });

    expect(refusalFor(owner, 'roleId', 'Failed.')).toBe('Approve with a role other than Owner.');
  });

  it('says the title when no violation is about that field', () => {
    expect(refusalFor(refused(), 'roleId', 'Failed.')).toBe(
      'Some of the information provided is not valid.',
    );
  });

  it('says the screen words when the API never answered', () => {
    expect(refusalFor(new Error('offline'), 'roleId', 'Failed.')).toBe('Failed.');
  });
});

describe('a refusal said whole', () => {
  it('says the first violation, whichever field it is on', () => {
    const one = refused({
      violations: [{ propertyPath: 'membershipId', message: 'Not a member.', code: 'x' }],
    });

    expect(refusalSaid(one, 'Failed.')).toBe('Not a member.');
  });

  it('says the detail, then the title, with no violation', () => {
    expect(refusalSaid(refused({ detail: 'Already on the event.' }), 'Failed.')).toBe(
      'Already on the event.',
    );
    expect(refusalSaid(refused(), 'Failed.')).toBe(
      'Some of the information provided is not valid.',
    );
  });

  it('says the screen words when the API never answered or failed itself', () => {
    expect(refusalSaid(new Error('offline'), 'Failed.')).toBe('Failed.');
    expect(refusalSaid(refused({ status: 503 }), 'Failed.')).toBe('Failed.');
  });
});
