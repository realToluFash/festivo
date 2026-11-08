import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import {
  NOTIFICATION_CATEGORY_ORDER,
  quietHoursIn,
  settingFlipped,
  usageThresholdsIn,
} from '@soirely/domain';

import {
  type Channel,
  type SettingsGrid,
  type SettingSwitch,
  settingSaving,
  type SwitchesNotifications,
} from '../../kit/notificationSettings.ts';

export const NOTIFICATIONS_TITLE = 'Notification settings';

/** The starting states a link can open: /demo/settings/notifications?state=saveFailed. */
export const NOTIFICATIONS_STATES = [
  'pushBlocked',
  'saveFailed',
  'saving',
  'saved',
  'loading',
  'failed',
] as const;

export type NotificationsState = (typeof NOTIFICATIONS_STATES)[number];

export function notificationsStateOf(name: string | undefined): NotificationsState | null {
  return NOTIFICATIONS_STATES.find((state) => state === name) ?? null;
}

export const WORDS = {
  kinds: 'What you hear about',
  pushBlocked: "Push is off on this device, so pushes won't reach you here.",
  openSettings: 'Open device settings',
  blockedHere: 'Blocked on this device',
  notLoaded: 'Your notification settings did not load.',
  notLoadedLine: 'Check your connection and try again.',
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  savedOut: 'Saved.',
  on: 'On',
  off: 'Off',
} as const;

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
    account_security: 'Sign-ins, your password, two-factor, ownership and access.',
  }[category];
}

/** Under a switch the API holds on: the sentence the build ended Account & security's note with. */
export function lockedLine(channel: Channel): string {
  return `${CHANNEL_NAMES[channel]} cannot be switched off.`;
}

export function cardSays(settings: readonly NotificationSetting[]): string {
  const push = settings.some((setting) => setting.push.on);
  const email = settings.some((setting) => setting.email.on);
  if (push && email) return 'You hear by push and email';

  return push ? 'You hear by push only' : 'You hear by email only';
}

export function cardCounts(settings: readonly NotificationSetting[]): string {
  const by = (channel: Channel) =>
    `${settings.filter((setting) => setting[channel].on).length} of ${settings.length} by ${channel}`;

  return `${by('push')} · ${by('email')}`;
}

function heardBy({ push, email }: NotificationSetting): string {
  if (push.on && email.on) return 'Push and email';
  if (push.on) return 'Push only';

  return email.on ? 'Email only' : 'Off';
}

export function rowValue(setting: NotificationSetting): string {
  return setting.email.switchable ? heardBy(setting) : `${heardBy(setting)} · email always on`;
}

export function switchName(category: NotificationCategory, channel: Channel): string {
  return `${CATEGORY_NAMES[category]} ${CHANNEL_NAMES[channel]}`;
}

/** Quiet hours as the app's grid writes them, from the product's one home: 21:00 and 08:00 in every language (sc-30243). */
export function quietHoursLine(locale: string): string {
  const { start, end } = quietHoursIn(locale);

  return `Between ${start} and ${end} your time, only Event day pushes come through.`;
}

/** Epic 36's defaults for a member who changed nothing: push on but for Account & security, email on but for Event day. */
export const SAMPLE_SETTINGS: readonly NotificationSetting[] = NOTIFICATION_CATEGORY_ORDER.map(
  (category) => ({
    category,
    push: { on: category !== 'account_security', switchable: true },
    email: { on: category !== 'event_day', switchable: category !== 'account_security' },
  }),
);

/** Messages Email: switched off as saving and saved open, and never saved in the saveFailed state, so the failure can be seen again. */
export const SAMPLE_SWITCH = { category: 'messages', channel: 'email' } as const;

export const SAVE_MS = 500;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

function firstSettings(state: NotificationsState | null): NotificationSetting[] {
  const { category, channel } = SAMPLE_SWITCH;

  return state === 'saving' || state === 'saved'
    ? settingFlipped(SAMPLE_SETTINGS, category, channel, false)
    : [...SAMPLE_SETTINGS];
}

export function firstGrid(state: NotificationsState | null): SettingsGrid {
  if (state === 'loading') return { status: 'loading' };
  if (state === 'failed') return { status: 'failed' };

  return {
    status: 'loaded',
    settings: firstSettings(state),
    saving: state === 'saving' ? [SAMPLE_SWITCH] : [],
    saved: state === 'saved',
    unsaved: state === 'saveFailed' ? SAMPLE_SWITCH : null,
  };
}

export interface NotificationsPage {
  grid: SettingsGrid;
  opened: NotificationCategory | null;
  savedRow: NotificationCategory | null;
  answers: number;
}

export function firstPage(state: NotificationsState | null): NotificationsPage {
  const opens = state === 'saving' || state === 'saved' || state === 'saveFailed';

  return {
    grid: firstGrid(state),
    opened: opens ? SAMPLE_SWITCH.category : null,
    savedRow: state === 'saved' ? SAMPLE_SWITCH.category : null,
    answers: 0,
  };
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

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The demo's stand-in for the API, which the app's own grid logic reads and saves through: nothing leaves the device. */
export function sampleClient(
  state: NotificationsState | null,
  wait: (ms: number) => Promise<void> = pause,
): SwitchesNotifications {
  let held = firstSettings(state);
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
        category === SAMPLE_SWITCH.category &&
        channel === SAMPLE_SWITCH.channel
      )
        throw new Error('The sample refuses this save.');
      held = settingFlipped(held, category, channel, on);

      return held;
    },
  };
}
