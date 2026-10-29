import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from './api.ts';
import { config } from './config.ts';
import { appPlace } from './kit/notificationPlace.ts';

const ASKED = 'soirely.pushAsked';

/** Run on every signed-in load: a push target ends with the session it was registered under (sc-3980). */
export async function registerAppPush(): Promise<void> {
  if (!Device.isDevice || config.easProjectId == null) return;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId });

  await api.registerPushTarget({ kind: 'expo', address: data });
}

/** Whether the bell offers push on this opening: the phone has not been asked, and the card has not shown here before. */
export async function pushAskDue(): Promise<boolean> {
  if (!Device.isDevice || config.easProjectId == null) return false;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'undetermined') return false;

  return (await AsyncStorage.getItem(ASKED).catch(() => null)) == null;
}

async function pushPermission(): Promise<{ blocked: boolean; granted: boolean }> {
  if (!Device.isDevice) return { blocked: false, granted: false };

  const { status, granted } = await Notifications.getPermissionsAsync();

  return { blocked: status === 'denied', granted };
}

/** Read again each time the app comes back, so push allowed in the phone's settings registers its token then rather than at the next cold start. */
export function followPushBlocked(onBlocked: (blocked: boolean) => void): () => void {
  let stopped = false;
  let granted: boolean | null = null;

  const check = (): void => {
    void pushPermission().then(
      (now) => {
        if (stopped) return;
        if (now.granted && granted === false) void registerAppPush().catch(() => {});
        granted = now.granted;
        onBlocked(now.blocked);
      },
      () => undefined,
    );
  };

  check();
  const back = AppState.addEventListener('change', (state) => {
    if (state === 'active') check();
  });

  return () => {
    stopped = true;
    back.remove();
  };
}

/** Per device: the card shows on the first opening of the bell, and never again here. */
export async function markPushAsked(): Promise<void> {
  await AsyncStorage.setItem(ASKED, new Date().toISOString()).catch(() => {});
}

/** Turn on: the OS alert, then the token once it is allowed. */
export async function turnOnAppPush(): Promise<void> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) await registerAppPush();
}

/** A push that arrives with the app open still shows, quietly: the bell counts the same item. */
export function showPushInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** The server sends the web's path; a place the app has no screen for opens the bell. */
export function pushedPlace(response: Notifications.NotificationResponse): string {
  const place: unknown = response.notification.request.content.data?.place;

  return appPlace(typeof place === 'string' ? place : null) ?? '/notifications';
}

let frames = 0;
let taps: { remove: () => void } | null = null;
let signedInAs: string | undefined;
let held: Notifications.NotificationResponse | null = null;

function openPushed(response: Notifications.NotificationResponse): void {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  if (signedInAs == null) {
    held = response;
    return;
  }
  Notifications.clearLastNotificationResponse();
  if (response.notification.request.content.data?.recipient !== signedInAs) return;
  router.push(pushedPlace(response));
}

/** In the signed-in frame, so a tap that launched the app opens once the account is known; every screen has a frame, and they share one listener. */
export function usePushTaps(userId: string | undefined): void {
  useEffect(() => {
    signedInAs = userId;
    if (userId == null || held == null) return;
    const launchedBy = held;
    held = null;
    openPushed(launchedBy);
  }, [userId]);

  useEffect(() => {
    frames += 1;
    if (frames === 1) {
      const launchedBy = Notifications.getLastNotificationResponse();
      if (launchedBy != null) openPushed(launchedBy);
      taps = Notifications.addNotificationResponseReceivedListener(openPushed);
    }

    return () => {
      frames -= 1;
      if (frames > 0) return;
      taps?.remove();
      taps = null;
    };
  }, []);
}
