import type { NotificationSetting } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { NotReached, settingFlipped } from '@soirely/domain';

import {
  type SettingsGrid,
  type SwitchesNotifications,
  isSaving,
  readSettings,
  saveSetting,
  settingSaving,
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
  const loaded: SettingsGrid = {
    status: 'loaded',
    settings: grid,
    saving: [],
    saved: false,
    unsaved: null,
  };

  it('did not load when the read fails', async () => {
    const apply = await readSettings(
      client({ notificationSettings: () => Promise.reject(new Error('down')) }),
    );

    expect(apply({ status: 'loading' })).toEqual({ status: 'failed' });
    expect(apply(loaded)).toEqual({ status: 'failed' });
  });

  it('keeps the switches it showed when a reload never reached Soirely (sc-27088)', async () => {
    const apply = await readSettings(
      client({ notificationSettings: () => Promise.reject(new NotReached()) }),
    );

    expect(apply(loaded)).toBe(loaded);
    expect(apply({ status: 'loading' })).toEqual({ status: 'failed' });
  });

  it('keeps a switch busy while its own save is out, and frees it when the answer comes', async () => {
    const tapped = settingSaving(loaded, 'event_changes', 'push', false);
    const apply = await saveSetting(
      client({
        setNotificationSetting: () =>
          Promise.resolve(settingFlipped(grid, 'event_changes', 'push', false)),
      }),
      'event_changes',
      'push',
      false,
    );

    expect(isSaving(tapped, { category: 'event_changes', channel: 'push' })).toBe(true);
    expect(isSaving(tapped, { category: 'event_changes', channel: 'email' })).toBe(false);
    expect(isSaving(apply(tapped), { category: 'event_changes', channel: 'push' })).toBe(false);
  });

  it('takes its own switch from the server, and says it saved', async () => {
    const sent: unknown[] = [];
    const apply = await saveSetting(
      client({
        setNotificationSetting: (...args) => {
          sent.push(args);

          return Promise.resolve(settingFlipped(grid, 'event_changes', 'push', false));
        },
      }),
      'event_changes',
      'push',
      false,
    );

    expect(sent).toEqual([['event_changes', 'push', false]]);
    expect(apply(settingSaving(loaded, 'event_changes', 'push', false))).toEqual({
      status: 'loaded',
      settings: settingFlipped(grid, 'event_changes', 'push', false),
      saving: [],
      saved: true,
      unsaved: null,
    });
  });

  it('leaves a switch saving meanwhile as it shows, whichever answer comes back first', async () => {
    const both = settingSaving(
      settingSaving(loaded, 'guest_replies', 'push', false),
      'money',
      'email',
      false,
    );
    const guestReplies = await saveSetting(
      client({
        setNotificationSetting: () =>
          Promise.resolve(settingFlipped(grid, 'guest_replies', 'push', false)),
      }),
      'guest_replies',
      'push',
      false,
    );
    const money = await saveSetting(
      client({
        setNotificationSetting: () =>
          Promise.resolve(
            settingFlipped(
              settingFlipped(grid, 'guest_replies', 'push', false),
              'money',
              'email',
              false,
            ),
          ),
      }),
      'money',
      'email',
      false,
    );
    const expected = settingFlipped(
      settingFlipped(grid, 'guest_replies', 'push', false),
      'money',
      'email',
      false,
    );

    const moneyFirst = money(both);
    expect(moneyFirst.status === 'loaded' && moneyFirst.settings).toEqual(expected);
    expect(guestReplies(moneyFirst)).toMatchObject({ settings: expected, saving: [] });

    const guestRepliesFirst = guestReplies(both);
    expect(guestRepliesFirst.status === 'loaded' && guestRepliesFirst.settings).toEqual(expected);
    expect(money(guestRepliesFirst)).toMatchObject({ settings: expected, saving: [] });
  });

  it('puts back only its own switch when the save fails, and names it', async () => {
    const apply = await saveSetting(
      client({ setNotificationSetting: () => Promise.reject(new Error('down')) }),
      'event_changes',
      'push',
      false,
    );
    const meanwhile = settingSaving(
      settingSaving(loaded, 'event_changes', 'push', false),
      'messages',
      'email',
      false,
    );

    expect(apply(meanwhile)).toEqual({
      status: 'loaded',
      settings: settingFlipped(grid, 'messages', 'email', false),
      saving: [{ category: 'messages', channel: 'email' }],
      saved: false,
      unsaved: { category: 'event_changes', channel: 'push' },
    });
  });
});
