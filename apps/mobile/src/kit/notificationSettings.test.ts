import type { NotificationSetting } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { settingFlipped } from '@soirely/domain';

import {
  type SettingsGrid,
  type SwitchesNotifications,
  readSettings,
  saveSetting,
} from './notificationSettings.ts';

const on = { on: true, switchable: true };
const off = { on: false, switchable: true };
const grid: NotificationSetting[] = [
  { category: 'account_security', push: on, email: { on: true, switchable: false } },
  { category: 'money', push: off, email: on },
  { category: 'event_changes', push: on, email: on },
  { category: 'event_day', push: on, email: off },
  { category: 'messages', push: off, email: on },
  { category: 'guest_replies', push: on, email: off },
];

function client(answers: Partial<SwitchesNotifications>): SwitchesNotifications {
  return {
    notificationSettings:
      answers.notificationSettings ?? (() => Promise.reject(new Error('not asked'))),
    setNotificationSetting:
      answers.setNotificationSetting ?? (() => Promise.reject(new Error('not asked'))),
  };
}

describe('Notification settings in the app', () => {
  const loaded: SettingsGrid = { status: 'loaded', settings: grid, saved: false, unsaved: null };

  it('did not load when the read fails', async () => {
    const state = await readSettings(
      client({ notificationSettings: () => Promise.reject(new Error('down')) }),
    );

    expect(state).toEqual({ status: 'failed' });
  });

  it('takes the grid the server saved, and says it saved', async () => {
    const sent: unknown[] = [];
    const saved = settingFlipped(grid, 'event_changes', 'push', false);
    const apply = await saveSetting(
      client({
        setNotificationSetting: (...args) => {
          sent.push(args);

          return Promise.resolve(saved);
        },
      }),
      'event_changes',
      'push',
      false,
    );

    expect(sent).toEqual([['event_changes', 'push', false]]);
    expect(apply(loaded)).toEqual({
      status: 'loaded',
      settings: saved,
      saved: true,
      unsaved: null,
    });
  });

  it('puts back only its own switch when the save fails, and names it', async () => {
    const apply = await saveSetting(
      client({ setNotificationSetting: () => Promise.reject(new Error('down')) }),
      'event_changes',
      'push',
      false,
    );
    const meanwhile = settingFlipped(
      settingFlipped(grid, 'event_changes', 'push', false),
      'messages',
      'email',
      false,
    );

    expect(apply({ ...loaded, settings: meanwhile })).toEqual({
      status: 'loaded',
      settings: settingFlipped(grid, 'messages', 'email', false),
      saved: false,
      unsaved: { category: 'event_changes', channel: 'push' },
    });
  });
});
