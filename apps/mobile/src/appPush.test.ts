import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ registerPushTarget: vi.fn(async () => {}) }));
const device = vi.hoisted(() => ({ isDevice: true }));
const settings = vi.hoisted(() => ({ easProjectId: 'project' as string | undefined }));
const notifications = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted' })),
  getExpoPushTokenAsync: vi.fn(async () => ({ data: 'ExponentPushToken[abc]' })),
}));
const stored = vi.hoisted(() => new Map<string, string>());

vi.mock('./api.ts', () => ({ api }));
vi.mock('./config.ts', () => ({ config: settings }));
vi.mock('expo-device', () => device);
vi.mock('expo-notifications', () => notifications);
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => void stored.set(key, value),
  },
}));

const { markPushAsked, pushAskDue, registerAppPush, turnOnAppPush } = await import('./appPush.ts');

describe("the app's push (sc-3980)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    device.isDevice = true;
    settings.easProjectId = 'project';
    stored.clear();
  });

  it('registers the Expo token for the project once push is allowed', async () => {
    await registerAppPush();

    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project' });
    expect(api.registerPushTarget).toHaveBeenCalledWith({
      kind: 'expo',
      address: 'ExponentPushToken[abc]',
    });
  });

  it('registers nothing until push is allowed', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });

    await registerAppPush();

    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.registerPushTarget).not.toHaveBeenCalled();
  });

  it('asks for no token without a project id, or on a simulator', async () => {
    settings.easProjectId = undefined;
    await registerAppPush();
    settings.easProjectId = 'project';
    device.isDevice = false;
    await registerAppPush();

    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(api.registerPushTarget).not.toHaveBeenCalled();
  });

  it('offers the ask while the phone has not been asked, once per device', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'undetermined' });

    expect(await pushAskDue()).toBe(true);
    await markPushAsked();
    expect(await pushAskDue()).toBe(false);

    notifications.getPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted' });
  });

  it('offers no ask once the phone has answered, either way', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    expect(await pushAskDue()).toBe(false);

    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: true, status: 'granted' });
    expect(await pushAskDue()).toBe(false);
  });

  it('registers the token once Turn on is allowed, and nothing after a block', async () => {
    await turnOnAppPush();
    expect(api.registerPushTarget).toHaveBeenCalledTimes(1);

    notifications.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      status: 'denied',
    });
    await turnOnAppPush();
    expect(api.registerPushTarget).toHaveBeenCalledTimes(1);
  });
});
