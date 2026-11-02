import { type Account } from '@soirely/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  isAvailableAsync: async () => true,
  setItemAsync: async (key: string, value: string) => void kept.set(key, value),
  getItemAsync: async (key: string) => kept.get(key) ?? null,
  deleteItemAsync: async (key: string) => void kept.delete(key),
}));
vi.mock('expo-router', () => ({ router: { replace: () => {} } }));
vi.mock('expo-localization', () => ({ getCalendars: () => [] }));
vi.mock('expo-network', () => ({ addNetworkStateListener: () => ({ remove: () => {} }) }));
vi.mock('./appAgent.ts', () => ({ appAgent: 'Soirely/test' }));
vi.mock('./config.ts', () => ({ config: { apiBaseUrl: 'http://api.test' } }));
vi.mock('./i18n/index.ts', () => ({ currentLocale: () => 'en' }));
vi.mock('./installId.ts', () => ({ installId: () => 'the-install' }));

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

const SIGNED_IN = {
  accessToken: 'fresh',
  refreshToken: 'next',
  refreshExpiresAt: '2026-11-14T00:00:00+00:00',
  sessionId: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  account: B,
};

function answering(status: number, body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

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

/** A fresh launch: what was kept on the device, read again. */
async function launch() {
  vi.resetModules();

  return {
    ...(await import('./api.ts')),
    ...(await import('./pendingRegistration.ts')),
  };
}

beforeEach(() => kept.clear());
afterEach(() => vi.restoreAllMocks());

describe('a sign-up held on the device when somebody signs in (sc-19634)', () => {
  it('is dropped once the sign-in stores a session, so an ended session opens on signed out', async () => {
    const { api, holdRegistration } = await launch();
    await holdRegistration(A);
    answering(200, SIGNED_IN);

    await api.signIn('bola@example.com', 'a decent passphrase');

    const relaunched = await launch();
    const { launchRoute } = await import('./resumeSignUp.ts');
    await expect(
      launchRoute(
        true,
        {
          held: relaunched.heldRegistration,
          open: async () => ({ cooldownSeconds: 0, codeState: 'live' }),
          drop: relaunched.dropRegistration,
        },
        () => true,
      ),
    ).resolves.toBe('/sign-in?signedOut=1');
  });

  it('is dropped once the second factor passes, and not before', async () => {
    const { api, holdRegistration, heldRegistration } = await launch();
    await holdRegistration(A);
    answering(202, {
      twoFactorChallenge: 'the-challenge',
      challengeExpiresAt: '2026-10-29T12:05:00+00:00',
      email: 'bola@example.com',
    });

    await api.signIn('bola@example.com', 'a decent passphrase');
    expect(await heldRegistration()).toEqual(A);

    answering(200, SIGNED_IN);
    await api.verifyTwoFactor('the-challenge', { code: '123456' });
    expect(await heldRegistration()).toBeNull();
  });

  it('stays when the sign-in is refused', async () => {
    const { api, holdRegistration } = await launch();
    await holdRegistration(A);
    answering(401, {
      type: 'https://soirely.com/errors/invalid_credentials',
      title: 'Signing in did not work.',
      status: 401,
    });

    await expect(api.signIn('bola@example.com', 'wrong')).rejects.toThrow();

    expect(await (await launch()).heldRegistration()).toEqual(A);
  });

  it('stays when it was started after the session was stored (sc-927)', async () => {
    const { api, holdRegistration } = await launch();
    answering(200, SIGNED_IN);
    await api.signIn('bola@example.com', 'a decent passphrase');

    await holdRegistration(A);
    const refreshed = refreshingOnce();
    await api.me();

    expect(refreshed()).toBe(true);
    expect(await (await launch()).heldRegistration()).toEqual(A);
  });
});
