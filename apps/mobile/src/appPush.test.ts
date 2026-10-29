import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ registerPushTarget: vi.fn(async () => {}) }));
const device = vi.hoisted(() => ({ isDevice: true }));
const settings = vi.hoisted(() => ({ easProjectId: 'project' as string | undefined }));
const notifications = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: vi.fn(async () => ({ data: 'ExponentPushToken[abc]' })),
}));

vi.mock('./api.ts', () => ({ api }));
vi.mock('./config.ts', () => ({ config: settings }));
vi.mock('expo-device', () => device);
vi.mock('expo-notifications', () => notifications);

const { registerAppPush } = await import('./appPush.ts');

describe("the app's push (sc-3980)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    device.isDevice = true;
    settings.easProjectId = 'project';
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
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false });

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
});
