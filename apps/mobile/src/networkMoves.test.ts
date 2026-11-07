import { type ConnectionChange, connection } from '@soirely/domain';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const network = vi.hoisted(() => ({
  listener: null as null | ((state: { isConnected?: boolean; type?: string }) => void),
  launchRead: async () => ({ isConnected: true, type: 'WIFI' }),
}));

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
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR', ETHERNET: 'ETHERNET' },
  addNetworkStateListener: (listener: NonNullable<typeof network.listener>) => {
    network.listener = listener;
    return { remove: () => {} };
  },
  getNetworkStateAsync: () => network.launchRead(),
}));
vi.mock('./appAgent.ts', () => ({ appAgent: 'Soirely/test' }));
vi.mock('./config.ts', () => ({ config: { apiBaseUrl: 'http://api.test' } }));
vi.mock('./i18n/index.ts', () => ({ currentLocale: () => 'en' }));
vi.mock('./installId.ts', () => ({ installId: () => 'the-install' }));

const heard: ConnectionChange[] = [];

describe("the app's network reports", () => {
  beforeAll(async () => {
    await import('./api.ts');
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.subscribe((change) => heard.push(change));
  });

  it('hears the move from the Wi-Fi in use at launch to mobile data, and back, as the device coming back', () => {
    network.listener!({ isConnected: true, type: 'CELLULAR' });
    network.listener!({ isConnected: true, type: 'CELLULAR' });
    network.listener!({ isConnected: true, type: 'WIFI' });

    expect(heard).toEqual(['deviceBack', 'deviceBack']);
  });

  it('hears a kind that is neither Wi-Fi nor mobile data as no move', () => {
    heard.length = 0;
    network.listener!({ isConnected: true, type: 'ETHERNET' });
    network.listener!({ isConnected: true, type: 'WIFI' });

    expect(heard).toEqual([]);
  });
});

describe('a launch read that answers after a move', () => {
  it('is older than the move, so the move gets one load and no more', async () => {
    vi.resetModules();
    let answerLaunch!: (state: { isConnected: boolean; type: string }) => void;
    network.launchRead = () => new Promise((resolve) => (answerLaunch = resolve));
    const fresh = await import('@soirely/domain');
    await import('./api.ts');
    const changes: ConnectionChange[] = [];
    fresh.connection.subscribe((change) => changes.push(change));

    network.listener!({ isConnected: true, type: 'WIFI' });
    network.listener!({ isConnected: true, type: 'CELLULAR' });
    answerLaunch({ isConnected: true, type: 'WIFI' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(changes).toEqual(['deviceBack']);
  });
});
