import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';

export type Channel = 'push' | 'email';

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

/** Event changes sits right after Event day, since a change near the start goes as Event day (sc-3980 Design). */
export const CATEGORY_ORDER: readonly NotificationCategory[] = [
  'guest_replies',
  'messages',
  'event_day',
  'event_changes',
  'money',
  'account_security',
];

export const QUIET_HOURS = { start: 21, end: 8 };
export const USAGE_THRESHOLDS = { low: 0.8, high: 1 };

/** The rows in the grid's order; a category the server did not send is left out rather than guessed. */
export function rows(settings: readonly NotificationSetting[]): NotificationSetting[] {
  return CATEGORY_ORDER.flatMap((category) =>
    settings.filter((setting) => setting.category === category),
  );
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

/** The switch moves as tapped; the grid that comes back is the server's, and a save that fails puts it back. */
export function flipped(
  settings: readonly NotificationSetting[],
  category: NotificationCategory,
  channel: Channel,
  on: boolean,
): NotificationSetting[] {
  return settings.map((setting) =>
    setting.category === category
      ? { ...setting, [channel]: { ...setting[channel], on } }
      : setting,
  );
}

export async function saveSetting(
  client: SwitchesNotifications,
  before: NotificationSetting[],
  category: NotificationCategory,
  channel: Channel,
  on: boolean,
): Promise<SettingsGrid> {
  try {
    return {
      status: 'loaded',
      settings: await client.setNotificationSetting(category, channel, on),
      saved: true,
      unsaved: null,
    };
  } catch {
    return { status: 'loaded', settings: before, saved: false, unsaved: { category, channel } };
  }
}

export function quietHours(locale: string): { start: string; end: string } {
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const at = (hour: number) => time.format(new Date(2000, 0, 1, hour));

  return { start: at(QUIET_HOURS.start), end: at(QUIET_HOURS.end) };
}

export function usageThresholds(locale: string): { low: string; high: string } {
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });

  return { low: percent.format(USAGE_THRESHOLDS.low), high: percent.format(USAGE_THRESHOLDS.high) };
}
