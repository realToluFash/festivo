import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from './api.ts';
import { config } from './config.ts';

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

/** Per device: the card shows on the first opening of the bell, and never again here. */
export async function markPushAsked(): Promise<void> {
  await AsyncStorage.setItem(ASKED, new Date().toISOString()).catch(() => {});
}

/** Turn on: the OS alert, then the token once it is allowed. */
export async function turnOnAppPush(): Promise<void> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) await registerAppPush();
}
