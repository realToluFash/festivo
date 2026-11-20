import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  isAvailableAsync: async () => true,
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}));
vi.mock('expo-router', () => ({ router: { replace: () => {} } }));
vi.mock('expo-localization', () => ({ getCalendars: () => [] }));
vi.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR' },
  addNetworkStateListener: () => ({ remove: () => {} }),
  getNetworkStateAsync: () => new Promise(() => {}),
}));
vi.mock('./appAgent.ts', () => ({ appAgent: 'Soirely/test' }));
vi.mock('./config.ts', () => ({ config: { apiBaseUrl: 'http://api.test' } }));
vi.mock('./i18n/index.ts', () => ({ currentLocale: () => 'en', dateLocale: () => 'en-US' }));
vi.mock('./installId.ts', () => ({ installId: () => 'the-install' }));

afterEach(() => vi.restoreAllMocks());

describe('the language the app asks the API for (sc-65714)', () => {
  it("carries the device's region, so a date the server writes reads as the app's own do", async () => {
    let language: string | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      language = new Headers(init?.headers).get('Accept-Language');
      return new Response(JSON.stringify({ status: 401 }), { status: 401 });
    });
    const { api } = await import('./api.ts');

    await api.signIn('bola@example.com', 'a decent passphrase').catch(() => {});

    expect(language).toBe('en-US');
  });
});
