import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ registerPushTarget: vi.fn(async () => {}) }));
const device = vi.hoisted(() => ({ isDevice: true }));
const settings = vi.hoisted(() => ({ easProjectId: 'project' as string | undefined }));
const notifications = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted' })),
  getExpoPushTokenAsync: vi.fn(async () => ({ data: 'ExponentPushToken[abc]' })),
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(async () => null),
  AndroidImportance: { HIGH: 5 },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  getLastNotificationResponse: vi.fn((): unknown => null),
  clearLastNotificationResponse: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn((listener: (response: unknown) => void) => {
    tapped.listener = listener;
    return { remove: tapped.remove };
  }),
}));
const tapped = vi.hoisted(() => ({
  listener: null as ((response: unknown) => void) | null,
  remove: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const effects = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
const stored = vi.hoisted(() => new Map<string, string>());
const platform = vi.hoisted(() => ({ OS: 'ios' }));
const appState = vi.hoisted(() => ({
  listener: null as ((state: string) => void) | null,
  remove: vi.fn(),
}));

vi.mock('./api.ts', () => ({ api }));
vi.mock('./config.ts', () => ({ config: settings }));
vi.mock('expo-device', () => device);
vi.mock('expo-notifications', () => notifications);
vi.mock('expo-router', () => ({ router }));
vi.mock('i18next', () => ({ t: (key: string) => key }));
vi.mock('react-native', () => ({
  Platform: platform,
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      appState.listener = listener;
      return { remove: appState.remove };
    },
  },
}));
vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup != null) effects.cleanups.push(cleanup);
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => void stored.set(key, value),
  },
}));

const {
  followPushBlocked,
  markPushAsked,
  pushAskDue,
  pushedPlace,
  registerAppPush,
  showPushInForeground,
  turnOnAppPush,
  usePushTaps,
} = await import('./appPush.ts');

function tap(
  place: unknown,
  actionIdentifier = notifications.DEFAULT_ACTION_IDENTIFIER,
  recipient = 'u1',
) {
  return {
    actionIdentifier,
    notification: { request: { content: { data: { place, recipient } } } },
  };
}

function unmountAll(): void {
  effects.cleanups.splice(0).forEach((cleanup) => cleanup());
}

describe("the app's push (sc-3980)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    device.isDevice = true;
    settings.easProjectId = 'project';
    stored.clear();
    platform.OS = 'ios';
  });

  it('registers the Expo token for the project once push is allowed', async () => {
    await registerAppPush();

    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project' });
    expect(api.registerPushTarget).toHaveBeenCalledWith({
      kind: 'expo',
      address: 'ExponentPushToken[abc]',
    });
  });

  it('makes the Event day channel on Android, which the API sends Event day pushes on (sc-13214)', async () => {
    await registerAppPush();
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();

    platform.OS = 'android';
    await registerAppPush();

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith('event_day', {
      name: 'notificationSettings.category.event_day',
      importance: 5,
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

  it('calls push blocked only once the phone has refused it', async () => {
    const said: boolean[] = [];
    for (const status of ['denied', 'granted', 'undetermined']) {
      notifications.getPermissionsAsync.mockResolvedValueOnce({
        granted: status === 'granted',
        status,
      });
      const before = said.length;
      const stop = followPushBlocked((blocked) => said.push(blocked));
      await vi.waitFor(() => expect(said).toHaveLength(before + 1));
      stop();
    }

    expect(said).toEqual([true, false, false]);
  });

  it('reads push again on the way back to the app, and registers the token once it is allowed', async () => {
    const said: boolean[] = [];
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    const stop = followPushBlocked((blocked) => said.push(blocked));
    await vi.waitFor(() => expect(said).toEqual([true]));

    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    appState.listener?.('background');
    appState.listener?.('active');
    await vi.waitFor(() => expect(said).toEqual([true, true]));
    expect(api.registerPushTarget).not.toHaveBeenCalled();

    appState.listener?.('active');
    await vi.waitFor(() => expect(said).toEqual([true, true, false]));
    await vi.waitFor(() =>
      expect(api.registerPushTarget).toHaveBeenCalledWith({
        kind: 'expo',
        address: 'ExponentPushToken[abc]',
      }),
    );

    stop();
    expect(appState.remove).toHaveBeenCalled();
  });

  it('registers no token on the way back when push was already allowed', async () => {
    const said: boolean[] = [];
    followPushBlocked((blocked) => said.push(blocked));
    await vi.waitFor(() => expect(said).toEqual([false]));
    appState.listener?.('active');
    await vi.waitFor(() => expect(said).toEqual([false, false]));

    expect(api.registerPushTarget).not.toHaveBeenCalled();
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

  it('shows a push that arrives with the app open, without a sound or a badge', async () => {
    showPushInForeground();

    const { handleNotification } = notifications.setNotificationHandler.mock.calls[0]?.[0] as {
      handleNotification: () => Promise<unknown>;
    };
    expect(await handleNotification()).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it("opens a tapped push's own screen, and the bell when the app has none", () => {
    expect(pushedPlace(tap('/app/events/e1') as never)).toBe('/events/e1');
    expect(pushedPlace(tap('/app/account/notifications') as never)).toBe('/settings/notifications');
    expect(pushedPlace(tap('/app/guests/g1') as never)).toBe('/notifications');
    expect(pushedPlace(tap(undefined) as never)).toBe('/notifications');
  });

  it('routes a tap once, however many frames are on the stack, and stops with the last', () => {
    usePushTaps('u1');
    usePushTaps('u1');

    expect(notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    tapped.listener?.(tap('/app/events/e1'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/events/e1');

    effects.cleanups.pop()?.();
    expect(tapped.remove).not.toHaveBeenCalled();
    unmountAll();
    expect(tapped.remove).toHaveBeenCalledTimes(1);
  });

  it('opens the push that launched the app, once, and ignores its other actions', () => {
    notifications.getLastNotificationResponse.mockReturnValueOnce(tap('/app/events/e2'));
    usePushTaps('u1');

    expect(router.push).toHaveBeenCalledWith('/events/e2');
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);

    tapped.listener?.(tap('/app/events/e3', 'expo.modules.notifications.actions.DISMISSED'));
    expect(router.push).toHaveBeenCalledTimes(1);
    unmountAll();
  });

  it('drops a tap on a push sent to somebody else, and clears it', () => {
    notifications.getLastNotificationResponse.mockReturnValueOnce(
      tap('/app/events/e2', undefined, 'someone-else'),
    );
    usePushTaps('u1');

    expect(router.push).not.toHaveBeenCalled();
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
    unmountAll();
  });

  it('holds the push that launched the app until the account is known', () => {
    notifications.getLastNotificationResponse.mockReturnValueOnce(tap('/app/events/e4'));
    usePushTaps(undefined);
    expect(router.push).not.toHaveBeenCalled();
    unmountAll();

    usePushTaps('u1');
    expect(router.push).toHaveBeenCalledWith('/events/e4');
    unmountAll();
  });
});
