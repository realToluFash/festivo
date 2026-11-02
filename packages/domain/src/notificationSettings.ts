import quietHours from '../../../quiet-hours.json' with { type: 'json' };

/** The shape `@soirely/api-client` reads as `NotificationSetting`; only what the grid needs. */
export interface SettingRow {
  category: string;
  push: { on: boolean; switchable: boolean };
  email: { on: boolean; switchable: boolean };
}

export type SettingChannel = 'push' | 'email';

/** Event changes sits right after Event day, since a change near the start goes as Event day (sc-3980 Design). */
export const NOTIFICATION_CATEGORY_ORDER = [
  'guest_replies',
  'messages',
  'event_day',
  'event_changes',
  'money',
  'account_security',
] as const;

/** Epic 36 §5: only Event day pushes between these hours, the member's own time. The API holds pushes by the same file. */
export const QUIET_HOURS = { start: quietHours.start, end: quietHours.end };

export const USAGE_THRESHOLDS = { low: 0.8, high: 1 };

/** The rows in the grid's order; a category the server did not send is left out rather than guessed. */
export function settingRows<Row extends SettingRow>(settings: readonly Row[]): Row[] {
  return NOTIFICATION_CATEGORY_ORDER.flatMap((category) =>
    settings.filter((setting) => setting.category === category),
  );
}

/** One switch moved, every other as it is: a failed save flips its own switch back this way, and nobody else's. */
export function settingFlipped<Row extends SettingRow>(
  settings: readonly Row[],
  category: Row['category'],
  channel: SettingChannel,
  on: boolean,
): Row[] {
  return settings.map((setting) =>
    setting.category === category
      ? { ...setting, [channel]: { ...setting[channel], on } }
      : setting,
  );
}

export function quietHoursIn(locale: string): { start: string; end: string } {
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const at = (hour: number) => time.format(new Date(2000, 0, 1, hour));

  return { start: at(QUIET_HOURS.start), end: at(QUIET_HOURS.end) };
}

export function usageThresholdsIn(locale: string): { low: string; high: string } {
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });

  return { low: percent.format(USAGE_THRESHOLDS.low), high: percent.format(USAGE_THRESHOLDS.high) };
}
