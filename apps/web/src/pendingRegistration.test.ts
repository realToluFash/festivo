import { type Account } from '@soirely/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from './api.ts';
import { dropRegistration, heldRegistration, holdRegistration } from './pendingRegistration.ts';

const B: Account = {
  id: 'acc_b',
  name: 'Bola Adeyemi',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: null,
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  twoFactorSetupPrompt: false,
  waitingFor: null,
  providers: [],
  emailAddresses: [],
  phoneNumbers: [],
};

const A = { registration: 'a-handle', email: 'ada@example.com' };

function answering(status: number, body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

const SIGNED_IN = {
  accessToken: 'fresh',
  refreshExpiresAt: '2026-11-14T00:00:00+00:00',
  sessionId: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  account: B,
};

/** `/api/auth/me` refused until the session refreshes, so a call after it has refreshed once. */
function refreshingOnce() {
  let refreshed = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).includes('/auth/refresh')) {
      refreshed = true;
      return new Response(JSON.stringify(SIGNED_IN), { status: 200 });
    }
    return refreshed
      ? new Response(JSON.stringify(B), { status: 200 })
      : new Response(JSON.stringify({ status: 401 }), { status: 401 });
  });

  return () => refreshed;
}

afterEach(() => {
  vi.restoreAllMocks();
  dropRegistration();
});

describe('a sign-up held in this tab when somebody signs in (sc-19634)', () => {
  it('is dropped once the sign-in stores a session', async () => {
    holdRegistration(A);
    answering(200, SIGNED_IN);

    await api.signIn('bola@example.com', 'a decent passphrase');

    expect(heldRegistration()).toBeNull();
  });

  it('is dropped once the second factor passes, and not before', async () => {
    holdRegistration(A);
    answering(202, {
      twoFactorChallenge: 'the-challenge',
      challengeExpiresAt: '2026-10-29T12:05:00+00:00',
      email: 'bola@example.com',
    });

    await api.signIn('bola@example.com', 'a decent passphrase');
    expect(heldRegistration()).toEqual(A);

    answering(200, SIGNED_IN);
    await api.verifyTwoFactor('the-challenge', { code: '123456' });
    expect(heldRegistration()).toBeNull();
  });

  it('stays when the sign-in is refused', async () => {
    holdRegistration(A);
    answering(401, {
      type: 'https://soirely.com/errors/invalid_credentials',
      title: 'Signing in did not work.',
      status: 401,
    });

    await expect(api.signIn('bola@example.com', 'wrong')).rejects.toThrow();

    expect(heldRegistration()).toEqual(A);
  });

  it('stays when it was started after the session was stored (sc-927)', async () => {
    answering(200, SIGNED_IN);
    await api.signIn('bola@example.com', 'a decent passphrase');

    holdRegistration(A);
    const refreshed = refreshingOnce();
    await api.me();

    expect(refreshed()).toBe(true);
    expect(heldRegistration()).toEqual(A);
  });
});
