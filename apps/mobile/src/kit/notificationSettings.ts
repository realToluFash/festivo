import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { type SettingChannel, settingFlipped } from '@soirely/domain';

export type Channel = SettingChannel;

export type SettingsGrid =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'loaded';
      settings: NotificationSetting[];
      saved: boolean;
      unsaved: { category: NotificationCategory; channel: Channel } | null;
    };

export interface SwitchesNotifications {
  notificationSettings(): Promise<NotificationSetting[]>;
  setNotificationSetting(
    category: NotificationCategory,
    channel: Channel,
    on: boolean,
  ): Promise<NotificationSetting[]>;
}

export async function readSettings(client: SwitchesNotifications): Promise<SettingsGrid> {
  try {
    return {
      status: 'loaded',
      settings: await client.notificationSettings(),
      saved: false,
      unsaved: null,
    };
  } catch {
    return { status: 'failed' };
  }
}

/** The grid that comes back is the server's; a failed save puts back only its own switch, on the grid as it is by then. */
export async function saveSetting(
  client: SwitchesNotifications,
  category: NotificationCategory,
  channel: Channel,
  on: boolean,
): Promise<(current: SettingsGrid) => SettingsGrid> {
  try {
    const settings = await client.setNotificationSetting(category, channel, on);

    return () => ({ status: 'loaded', settings, saved: true, unsaved: null });
  } catch {
    return (current) =>
      current.status === 'loaded'
        ? {
            status: 'loaded',
            settings: settingFlipped(current.settings, category, channel, !on),
            saved: false,
            unsaved: { category, channel },
          }
        : current;
  }
}
