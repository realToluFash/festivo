import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { type SettingChannel, keepsWhatLoaded, settingFlipped } from '@soirely/domain';

export type Channel = SettingChannel;

export type SettingsGrid =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'loaded';
      settings: NotificationSetting[];
      saving: readonly SettingSwitch[];
      saved: boolean;
      unsaved: SettingSwitch | null;
    };

export interface SettingSwitch {
  category: NotificationCategory;
  channel: Channel;
}

export interface SwitchesNotifications {
  notificationSettings(): Promise<NotificationSetting[]>;
  setNotificationSetting(
    category: NotificationCategory,
    channel: Channel,
    on: boolean,
  ): Promise<NotificationSetting[]>;
}

/** Applied to the grid as it stands when the read answers: a reload that never reached Soirely keeps what loaded (sc-27088). */
export async function readSettings(
  client: SwitchesNotifications,
): Promise<(before: SettingsGrid) => SettingsGrid> {
  try {
    const settings = await client.notificationSettings();

    return (before) => ({
      status: 'loaded',
      settings,
      saving: before.status === 'loaded' ? before.saving : [],
      saved: false,
      unsaved: null,
    });
  } catch (error) {
    return (before) =>
      before.status === 'loaded' && keepsWhatLoaded(error) ? before : { status: 'failed' };
  }
}

function same(one: SettingSwitch, other: SettingSwitch): boolean {
  return one.category === other.category && one.channel === other.channel;
}

export function isSaving(grid: SettingsGrid, setting: SettingSwitch): boolean {
  return grid.status === 'loaded' && grid.saving.some((saving) => same(saving, setting));
}

/** A switch is busy while its own save is out, so a second tap cannot race it. */
export function settingSaving(
  grid: SettingsGrid,
  category: NotificationCategory,
  channel: Channel,
  on: boolean,
): SettingsGrid {
  if (grid.status !== 'loaded') return grid;

  return {
    status: 'loaded',
    settings: settingFlipped(grid.settings, category, channel, on),
    saving: [...grid.saving, { category, channel }],
    saved: false,
    unsaved: null,
  };
}

/** A save's answer moves its own switch only, on the grid as it is by then: another switch saving meanwhile keeps what it shows. */
export async function saveSetting(
  client: SwitchesNotifications,
  category: NotificationCategory,
  channel: Channel,
  on: boolean,
): Promise<(current: SettingsGrid) => SettingsGrid> {
  const own = { category, channel };
  let saved: boolean | null;
  try {
    const settings = await client.setNotificationSetting(category, channel, on);
    saved = settings.find((setting) => setting.category === category)?.[channel].on ?? on;
  } catch {
    saved = null;
  }

  return (current) => {
    if (current.status !== 'loaded') return current;
    const saving = current.saving.filter((other) => !same(other, own));

    return saved == null
      ? {
          status: 'loaded',
          settings: settingFlipped(current.settings, category, channel, !on),
          saving,
          saved: false,
          unsaved: own,
        }
      : {
          status: 'loaded',
          settings: settingFlipped(current.settings, category, channel, saved),
          saving,
          saved: true,
          unsaved: current.unsaved != null && same(current.unsaved, own) ? null : current.unsaved,
        };
  };
}
