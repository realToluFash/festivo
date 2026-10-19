import { afterEach, describe, expect, it } from 'vitest';

import { SIGNED_OUT } from './api.ts';
import { __setSessionState, useSessionState } from './session.ts';
import { renderHook } from '@testing-library/react';

function signedOutBy(detail: unknown) {
  window.dispatchEvent(new CustomEvent(SIGNED_OUT, { detail }));

  return renderHook(() => useSessionState()).result.current;
}

afterEach(() => __setSessionState({ status: 'unknown' }));

describe('a session the API ended', () => {
  it('carries an organisation’s inactivity rule to sign-in (sc-69)', () => {
    expect(
      signedOutBy({
        type: 'https://soirely.com/errors/session_timed_out',
        title: 'Signed out.',
        status: 401,
        organisation: 'Ìrè Events',
        days: 7,
        email: 'folake@ire.events',
      }),
    ).toEqual({
      status: 'signedOut',
      ended: true,
      timedOut: { organisation: 'Ìrè Events', days: 7, email: 'folake@ire.events' },
    });
  });

  it('says only that it ended for any other reason', () => {
    expect(
      signedOutBy({
        type: 'https://soirely.com/errors/unauthenticated',
        title: 'No.',
        status: 401,
      }),
    ).toEqual({ status: 'signedOut', ended: true });
    expect(signedOutBy(undefined)).toEqual({ status: 'signedOut', ended: true });
  });
});
