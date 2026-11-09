import type { NotificationSetting } from '@soirely/api-client';
import { NOTIFICATION_CATEGORY_ORDER, settingFlipped } from '@soirely/domain';

import type { SettingsGrid, SwitchesNotifications } from '../../kit/notificationSettings.ts';
import type { NotificationsPage } from '../../kit/notificationsPage.ts';

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

export function firstPage(state: NotificationsState | null): NotificationsPage {
  const opens = state === 'saving' || state === 'saved' || state === 'saveFailed';

  return {
    grid: firstGrid(state),
    opened: opens ? SAMPLE_SWITCH.category : null,
    savedRow: state === 'saved' ? SAMPLE_SWITCH.category : null,
    answers: 0,
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
