import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { quietHoursIn, usageThresholdsIn } from '@soirely/domain';
import type { TFunction } from 'i18next';

import {
  type Channel,
  type SettingsGrid,
  type SettingSwitch,
  settingSaving,
} from './notificationSettings.ts';

export const CHANNELS: readonly Channel[] = ['push', 'email'];

export interface NotificationsPage {
  grid: SettingsGrid;
  opened: NotificationCategory | null;
  savedRow: NotificationCategory | null;
  answers: number;
}

export function pageOf(grid: SettingsGrid): NotificationsPage {
  return { grid, opened: null, savedRow: null, answers: 0 };
}

export function cardSays(settings: readonly NotificationSetting[], t: TFunction): string {
  const push = settings.some((setting) => setting.push.on);
  const email = settings.some((setting) => setting.email.on);
  if (push && email) return t('notificationSettings.saysBoth');

  return push ? t('notificationSettings.saysPush') : t('notificationSettings.saysEmail');
}

export function cardCounts(settings: readonly NotificationSetting[], t: TFunction): string {
  const on = (channel: Channel) => settings.filter((setting) => setting[channel].on).length;

  return t('notificationSettings.counts', {
    push: on('push'),
    email: on('email'),
    total: settings.length,
  });
}

function heardBy({ push, email }: NotificationSetting, t: TFunction): string {
  if (push.on && email.on) return t('notificationSettings.heardBoth');
  if (push.on) return t('notificationSettings.heardPush');

  return email.on ? t('notificationSettings.heardEmail') : t('notificationSettings.heardNone');
}

export function rowValue(setting: NotificationSetting, t: TFunction): string {
  const heard = heardBy(setting, t);

  return setting.email.switchable ? heard : t('notificationSettings.emailAlwaysOn', { heard });
}

export function categoryNote(category: NotificationCategory, locale: string, t: TFunction): string {
  return t(`notificationSettings.note.${category}`, usageThresholdsIn(locale));
}

export function channelName(channel: Channel, t: TFunction): string {
  return t(`notificationSettings.${channel}`);
}

export function switchName(category: NotificationCategory, channel: Channel, t: TFunction): string {
  return t('notificationSettings.switchName', {
    category: t(`notificationSettings.category.${category}`),
    channel: channelName(channel, t),
  });
}

/** Under a switch the API holds on. */
export function lockedLine(channel: Channel, t: TFunction): string {
  return t('notificationSettings.locked', { channel: channelName(channel, t) });
}

export function notSaved(channel: Channel, t: TFunction): string {
  return channel === 'push'
    ? t('notificationSettings.pushNotSaved')
    : t('notificationSettings.emailNotSaved');
}

/** 21:00 and 08:00 in every language, from quietHoursIn (sc-30243). */
export function quietHoursLine(locale: string, t: TFunction): string {
  return t('notificationSettings.quietHours', quietHoursIn(locale));
}

/** One row open at a time; opening another takes Saved off the last, closing the same row keeps it. */
export function rowToggled(
  page: NotificationsPage,
  category: NotificationCategory,
): NotificationsPage {
  if (page.opened === category) return { ...page, opened: null };

  return {
    ...page,
    opened: category,
    savedRow: page.savedRow === category ? category : null,
  };
}

export function switchSaving(
  page: NotificationsPage,
  { category, channel }: SettingSwitch,
  on: boolean,
): NotificationsPage {
  return { ...page, grid: settingSaving(page.grid, category, channel, on) };
}

/** A save's answer on the page as it is by then: Saved on its row, or its row's Saved gone with the switch put back. */
export function saveAnswered(
  page: NotificationsPage,
  apply: (grid: SettingsGrid) => SettingsGrid,
  own: SettingSwitch,
): NotificationsPage {
  const grid = apply(page.grid);
  const refused =
    grid.status === 'loaded' &&
    grid.unsaved?.category === own.category &&
    grid.unsaved.channel === own.channel;
  const kept = page.savedRow === own.category ? null : page.savedRow;

  return { ...page, grid, savedRow: refused ? kept : own.category, answers: page.answers + 1 };
}

export function rowSays(
  page: NotificationsPage,
  category: NotificationCategory,
): 'saving' | 'saved' | null {
  const { grid } = page;
  if (grid.status === 'loaded' && grid.saving.some((one) => one.category === category))
    return 'saving';

  return page.savedRow === category ? 'saved' : null;
}

/** Saved. as each save answers, or the failed switch's line as an alert; Saving… is silent. */
export function spoken({ grid }: NotificationsPage, t: TFunction): string | null {
  if (grid.status !== 'loaded') return null;
  if (grid.unsaved != null) return notSaved(grid.unsaved.channel, t);

  return grid.saved ? t('notificationSettings.saved') : null;
}

export function unsavedNow({ grid }: NotificationsPage): boolean {
  return grid.status === 'loaded' && grid.unsaved != null;
}
