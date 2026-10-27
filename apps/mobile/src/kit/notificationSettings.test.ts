import type { NotificationSetting } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_ORDER,
  type SwitchesNotifications,
  flipped,
  quietHours,
  readSettings,
  rows,
  saveSetting,
  usageThresholds,
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
  it('lists the six categories with Event changes right after Event day', () => {
    expect(rows(grid).map((row) => row.category)).toEqual(CATEGORY_ORDER);
    expect(CATEGORY_ORDER).toEqual([
      'guest_replies',
      'messages',
      'event_day',
      'event_changes',
      'money',
      'account_security',
    ]);
  });

  it('did not load when the read fails', async () => {
    const state = await readSettings(
      client({ notificationSettings: () => Promise.reject(new Error('down')) }),
    );

    expect(state).toEqual({ status: 'failed' });
  });

  it('moves only the switch tapped', () => {
    const next = flipped(grid, 'money', 'push', true);

    expect(next.find((row) => row.category === 'money')?.push.on).toBe(true);
    expect(next.find((row) => row.category === 'money')?.email.on).toBe(true);
    expect(next.find((row) => row.category === 'messages')?.push.on).toBe(false);
  });

  it('takes the grid the server saved, and says it saved', async () => {
    const sent: unknown[] = [];
    const saved = flipped(grid, 'event_changes', 'push', false);
    const state = await saveSetting(
      client({
        setNotificationSetting: (...args) => {
          sent.push(args);

          return Promise.resolve(saved);
        },
      }),
      grid,
      'event_changes',
      'push',
      false,
    );

    expect(sent).toEqual([['event_changes', 'push', false]]);
    expect(state).toEqual({ status: 'loaded', settings: saved, saved: true, unsaved: null });
  });

  it('puts the switch back and names it when the save fails', async () => {
    const state = await saveSetting(
      client({ setNotificationSetting: () => Promise.reject(new Error('down')) }),
      grid,
      'event_changes',
      'push',
      false,
    );

    expect(state).toEqual({
      status: 'loaded',
      settings: grid,
      saved: false,
      unsaved: { category: 'event_changes', channel: 'push' },
    });
  });

  it('writes quiet hours and usage levels in the locale', () => {
    expect(quietHours('en')).toEqual({ start: '21:00', end: '08:00' });
    expect(usageThresholds('en')).toEqual({ low: '80%', high: '100%' });
    expect(usageThresholds('fr').low).toMatch(/^80\s?%$/u);
  });
});
