import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from './api.ts';
import { config } from './config.ts';

/** Run on every signed-in load: a push target ends with the session it was registered under (sc-3980). */
export async function registerAppPush(): Promise<void> {
  if (!Device.isDevice || config.easProjectId == null) return;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId });

  await api.registerPushTarget({ kind: 'expo', address: data });
}
