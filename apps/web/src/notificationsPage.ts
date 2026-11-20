import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { type SettingChannel, quietHoursIn, usageThresholdsIn } from '@soirely/domain';
import type { TFunction } from 'i18next';

export type Channel = SettingChannel;

export const CHANNELS: readonly Channel[] = ['push', 'email'];

export interface Switch {
  category: NotificationCategory;
  channel: Channel;
}

export type RowTag = 'saving' | 'saved' | null;

export function keyOf({ category, channel }: Switch): string {
  return `${category}.${channel}`;
}

export function tagOf(
  category: NotificationCategory,
  saving: readonly string[],
  saved: NotificationCategory | null,
): RowTag {
  if (CHANNELS.some((channel) => saving.includes(keyOf({ category, channel })))) return 'saving';

  return saved === category ? 'saved' : null;
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

export function categoryName(category: NotificationCategory, t: TFunction): string {
  return t(`notificationSettings.category.${category}`);
}

export function categoryNote(category: NotificationCategory, locale: string, t: TFunction): string {
  return t(`notificationSettings.note.${category}`, usageThresholdsIn(locale));
}

export function channelName(channel: Channel, t: TFunction): string {
  return t(`notificationSettings.${channel}`);
}

export function switchName(category: NotificationCategory, channel: Channel, t: TFunction): string {
  return t('notificationSettings.switchName', {
    category: categoryName(category, t),
    channel: channelName(channel, t),
  });
}

/** Under a switch the API holds on. */
export function lockedLine(channel: Channel, t: TFunction): string {
  return t(`notificationSettings.locked.${channel}`);
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

export function allowSteps(t: TFunction): string[] {
  return [
    t('notificationSettings.allow.step1'),
    t('notificationSettings.allow.step2'),
    t('notificationSettings.allow.step3'),
  ];
}
