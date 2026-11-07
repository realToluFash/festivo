import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CATEGORY_ORDER,
  quietHoursIn,
  settingFlipped,
  settingRows,
  usageThresholdsIn,
} from './notificationSettings.ts';

const on = { on: true, switchable: true };
const off = { on: false, switchable: true };
const grid = [
  { category: 'account_security', push: on, email: { on: true, switchable: false } },
  { category: 'money', push: off, email: on },
  { category: 'event_changes', push: on, email: on },
  { category: 'event_day', push: on, email: off },
  { category: 'messages', push: off, email: on },
  { category: 'guest_replies', push: on, email: off },
];

describe('notification settings (sc-3980)', () => {
  it('orders the rows as the Design does, Event changes after Event day', () => {
    expect(settingRows(grid).map((row) => row.category)).toEqual([...NOTIFICATION_CATEGORY_ORDER]);
    expect(NOTIFICATION_CATEGORY_ORDER).toEqual([
      'guest_replies',
      'messages',
      'event_day',
      'event_changes',
      'money',
      'account_security',
    ]);
  });

  it('moves only the switch named', () => {
    const next = settingFlipped(grid, 'money', 'push', true);

    expect(next.find((row) => row.category === 'money')?.push.on).toBe(true);
    expect(next.find((row) => row.category === 'money')?.email.on).toBe(true);
    expect(next.find((row) => row.category === 'messages')?.push.on).toBe(false);
  });

  it('writes quiet hours and usage levels in the locale', () => {
    expect(quietHoursIn('en')).toEqual({ start: '21:00', end: '08:00' });
    expect(usageThresholdsIn('en')).toEqual({ low: '80%', high: '100%' });
    expect(usageThresholdsIn('fr').low).toMatch(/^80\s?%$/u);
  });
});
