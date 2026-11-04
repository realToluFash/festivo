import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import {
  NOTIFICATION_CATEGORY_ORDER,
  QUIET_HOURS,
  settingFlipped,
  usageThresholdsIn,
} from '@soirely/domain';

import type {
  Channel,
  SettingsGrid,
  SwitchesNotifications,
} from '../../kit/notificationSettings.ts';

export const NOTIFICATIONS_TITLE = 'Notification settings';

/** The starting states a link can open: /demo/settings/notifications?state=saveFailed. */
export const NOTIFICATIONS_STATES = ['pushBlocked', 'saveFailed', 'loading', 'failed'] as const;

export type NotificationsState = (typeof NOTIFICATIONS_STATES)[number];

export function notificationsStateOf(name: string | undefined): NotificationsState | null {
  return NOTIFICATIONS_STATES.find((state) => state === name) ?? null;
}

export const CHANNELS: readonly Channel[] = ['push', 'email'];

export const CHANNEL_NAMES: Record<Channel, string> = { push: 'Push', email: 'Email' };

export const NOT_SAVED: Record<Channel, string> = {
  push: 'The push switch was not saved. Try again.',
  email: 'The email switch was not saved. Try again.',
};

export const CATEGORY_NAMES: Record<NotificationCategory, string> = {
  guest_replies: 'Guest replies',
  messages: 'Messages',
  event_day: 'Event day',
  event_changes: 'Event changes',
  money: 'Money',
  account_security: 'Account & security',
};

export function categoryNote(category: NotificationCategory, locale: string): string {
  const { low, high } = usageThresholdsIn(locale);

  return {
    guest_replies: "Guests' replies and changes, the needs they add, and their questions.",
    messages:
      'A send that did not reach everyone, was held for credits or was cancelled, and credits running low.',
    event_day: 'Your shift or call time changed, or the event changed in its last 24 hours.',
    event_changes:
      'When someone else changes whether, when or where an event you are on takes place.',
    money: `Payments due, usage at ${low} and ${high}, failed payments and invoices.`,
    account_security:
      'Sign-ins, your password, two-factor, ownership and access. Email cannot be switched off.',
  }[category];
}

export function switchName(category: NotificationCategory, channel: Channel): string {
  return `${CATEGORY_NAMES[category]} ${CHANNEL_NAMES[channel]}`;
}

/** A time in the reader's own clock, two-digit hours where it runs to 24: 8:00 AM in the US, 08:00 in the UK. */
export function clockTime(locale: string, options: Intl.DateTimeFormatOptions = {}) {
  const { hourCycle, hour12 } = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
  }).resolvedOptions();
  const day = hourCycle === 'h23' || hourCycle === 'h24' || hour12 === false;
  const hour = day ? '2-digit' : 'numeric';

  return new Intl.DateTimeFormat(locale, { hour, minute: '2-digit', ...options });
}

/** The app's grid forces 24-hour time here; the demo follows the reader's clock, as the board drew it. */
export function quietHoursLine(locale: string): string {
  const time = clockTime(locale);
  const at = (hour: number) => time.format(new Date(2000, 0, 1, hour));

  return `Between ${at(QUIET_HOURS.start)} and ${at(QUIET_HOURS.end)} your time, only Event day pushes come through.`;
}

/** Epic 36's defaults for a member who changed nothing: push on but for Account & security, email on but for Event day. */
export const SAMPLE_SETTINGS: readonly NotificationSetting[] = NOTIFICATION_CATEGORY_ORDER.map(
  (category) => ({
    category,
    push: { on: category !== 'account_security', switchable: true },
    email: { on: category !== 'event_day', switchable: category !== 'account_security' },
  }),
);

/** The one switch whose save never goes through in the saveFailed state, so the failure can be seen again. */
export const NEVER_SAVED = { category: 'messages', channel: 'email' } as const;

export const SAVE_MS = 500;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

export function firstGrid(state: NotificationsState | null): SettingsGrid {
  if (state === 'loading') return { status: 'loading' };
  if (state === 'failed') return { status: 'failed' };

  return {
    status: 'loaded',
    settings: [...SAMPLE_SETTINGS],
    saving: [],
    saved: false,
    unsaved: state === 'saveFailed' ? NEVER_SAVED : null,
  };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The demo's stand-in for the API, which the app's own grid logic reads and saves through: nothing leaves the device. */
export function sampleClient(
  state: NotificationsState | null,
  wait: (ms: number) => Promise<void> = pause,
): SwitchesNotifications {
  let held: NotificationSetting[] = [...SAMPLE_SETTINGS];
  let reads = 0;

  return {
    async notificationSettings() {
      reads += 1;
      await wait(state === 'loading' && reads === 1 ? LOADING_MS : RETRY_MS);

      return held;
    },
    async setNotificationSetting(category, channel, on) {
      await wait(SAVE_MS);
      if (
        state === 'saveFailed' &&
        category === NEVER_SAVED.category &&
        channel === NEVER_SAVED.channel
      )
        throw new Error('The sample refuses this save.');
      held = settingFlipped(held, category, channel, on);

      return held;
    },
  };
}
