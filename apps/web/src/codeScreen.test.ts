import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { codeRefusal, openingStatus } from './codeScreen.ts';

function refused(code: string): ApiError {
  return new ApiError({ type: `https://soirely.com/errors/${code}`, title: code, status: 422 });
}

describe('a code screen', () => {
  it('opens on the banner for a spent code, and on the field for a live one', () => {
    expect(openingStatus({ kind: 'entering' }, 'exhausted')).toEqual({ kind: 'exhausted' });
    expect(openingStatus({ kind: 'entering' }, 'expired')).toEqual({ kind: 'expired' });
    expect(openingStatus({ kind: 'entering' }, 'live')).toEqual({ kind: 'entering' });
  });

  it('leaves a screen already past entering as it is', () => {
    expect(openingStatus({ kind: 'verified' }, 'exhausted')).toEqual({ kind: 'verified' });
    expect(openingStatus({ kind: 'wrong' }, 'expired')).toEqual({ kind: 'wrong' });
  });

  it("names a refusal by the API's code, and anything else as a failure", () => {
    expect(codeRefusal(refused('verification_code_invalid'))).toEqual({ kind: 'wrong' });
    expect(codeRefusal(refused('verification_code_expired'))).toEqual({ kind: 'expired' });
    expect(codeRefusal(refused('verification_code_exhausted'))).toEqual({ kind: 'exhausted' });
    expect(codeRefusal(new TypeError('Failed to fetch'))).toEqual({ kind: 'failed' });
  });
});
