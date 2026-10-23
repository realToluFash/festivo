import { type Account } from '@soirely/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SIGNED_OUT, api } from './api.ts';
import { __setSessionState, forgetSession, refreshAccount, useSessionState } from './session.ts';
import { renderHook } from '@testing-library/react';

function signedOutBy(detail: unknown) {
  window.dispatchEvent(new CustomEvent(SIGNED_OUT, { detail }));

  return renderHook(() => useSessionState()).result.current;
}

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
});

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

  it('carries a Google-or-Apple-only rule that ended a password session to sign-in (sc-69)', () => {
    expect(
      signedOutBy({
        type: 'https://soirely.com/errors/oauth_only',
        title: 'No.',
        status: 403,
        organisation: 'Ìrè Events',
        providers: ['google'],
        email: 'folake@ire.events',
      }),
    ).toEqual({
      status: 'signedOut',
      ended: true,
      providerOnly: {
        organisation: 'Ìrè Events',
        providers: ['google'],
        email: 'folake@ire.events',
      },
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

describe('a sign-out while the account is still being read', () => {
  it('stays signed out when the answer lands afterwards', async () => {
    let answer: (account: Account) => void = () => {};
    vi.spyOn(api, 'me').mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const refreshing = refreshAccount();
    forgetSession();
    answer({
      id: 'acc_1',
      name: 'Folake',
      businessName: null,
      countryCode: null,
      organisationCountry: null,
      locale: 'en',
      timezone: null,
      verified: false,
      complete: false,
      needsOrganisation: false,
      hasPassword: true,
      twoFactorSetupPrompt: false,
      waitingFor: null,
      providers: [],
      emailAddresses: [],
      phoneNumbers: [],
    });
    await refreshing;

    expect(renderHook(() => useSessionState()).result.current).toEqual({
      status: 'signedOut',
      ended: false,
    });
  });
});
