import { NOTIFICATION_CATEGORY_ORDER, settingFlipped } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  NEVER_SAVED,
  NOTIFICATIONS_PAGES,
  NOTIFICATIONS_STATES,
  SAMPLE_SETTINGS,
  WEB_MOMENTS,
  cardOf,
  categoryNote,
  coversLine,
  notificationsStart,
  quietHoursLine,
  rowValue,
  switchName,
  valueOf,
} from './notifications.ts';

const L = 'en-US';

function setting(category: (typeof NOTIFICATION_CATEGORY_ORDER)[number]) {
  const found = SAMPLE_SETTINGS.find((one) => one.category === category);
  if (found == null) throw new Error(category);

  return found;
}

describe('Notification settings at a desk, the model (sc-30243)', () => {
  it('holds epic 36’s defaults in the product’s order: push on but for Account & security, email on but for Event day', () => {
    expect(SAMPLE_SETTINGS.map((one) => one.category)).toEqual([...NOTIFICATION_CATEGORY_ORDER]);
    expect(setting('account_security').push.on).toBe(false);
    expect(setting('event_day').email.on).toBe(false);
    expect(
      SAMPLE_SETTINGS.filter((one) => !one.email.switchable).map((one) => one.category),
    ).toEqual(['account_security']);
  });

  it('says how you hear on the card, the switches that are on counted', () => {
    expect(cardOf(SAMPLE_SETTINGS)).toEqual({
      says: 'You hear by push and email',
      summary: '5 of 6 by push · 5 of 6 by email',
    });
    expect(cardOf(settingFlipped(SAMPLE_SETTINGS, 'messages', 'email', false)).summary).toBe(
      '5 of 6 by push · 4 of 6 by email',
    );
    const pushOff = NOTIFICATION_CATEGORY_ORDER.reduce(
      (now, category) => settingFlipped(now, category, 'push', false),
      [...SAMPLE_SETTINGS],
    );
    expect(cardOf(pushOff).says).toBe('You hear by email only');
  });

  it('puts each row’s value in words, and keeps Account & security’s email on in words too', () => {
    expect([
      valueOf(true, true),
      valueOf(true, false),
      valueOf(false, true),
      valueOf(false, false),
    ]).toEqual(['Push and email', 'Push only', 'Email only', 'Off']);
    expect(rowValue(setting('event_day'))).toBe('Push only');
    expect(rowValue(setting('account_security'))).toBe('Email only · email always on');
  });

  it('moves the kept email’s sentence from what the kind covers to its switch', () => {
    expect(categoryNote('account_security', L)).toMatch(/Email cannot be switched off\.$/);
    expect(coversLine(setting('account_security'), L)).toBe(
      'Sign-ins, your password, two-factor, ownership and access.',
    );
    expect(coversLine(setting('money'), L)).toBe(
      'Payments due, usage at 80% and 100%, failed payments and invoices.',
    );
  });

  it('keeps the build’s switch names and says quiet hours in the reader’s clock', () => {
    expect(switchName('guest_replies', 'push')).toBe('Guest replies Push');
    expect(quietHoursLine(L)).toBe(
      'Between 9:00 PM and 8:00 AM your time, only Event day pushes come through.',
    );
    expect(quietHoursLine('en-GB')).toBe(
      'Between 21:00 and 08:00 your time, only Event day pushes come through.',
    );
  });

  it('opens every app state and every web moment on something other than the page at rest', () => {
    const rest = notificationsStart('');

    expect(NOTIFICATIONS_STATES).toEqual([
      'pushBlocked',
      'saveFailed',
      'saving',
      'saved',
      'loading',
      'failed',
    ]);
    for (const state of [...NOTIFICATIONS_STATES, ...WEB_MOMENTS])
      expect(notificationsStart(state), state).not.toEqual(rest);
    expect(notificationsStart('nonsense')).toEqual(rest);
  });

  it('refuses one switch’s save, and only once a save has failed', () => {
    expect(notificationsStart('saveFailed')).toMatchObject({
      open: 'messages',
      unsaved: NEVER_SAVED,
      refuses: NEVER_SAVED,
    });
    expect(notificationsStart('saving').refuses).toBeNull();
    expect(notificationsStart('saving').saving).toEqual(NEVER_SAVED);
  });

  it('links every state and moment from the demo home, once', () => {
    const linked = NOTIFICATIONS_PAGES.flatMap((group) => group.states).map(
      (link) => new URL(link.to, 'http://demo').searchParams.get('state') ?? '',
    );

    expect([...linked].sort()).toEqual(
      ['', '', '', ...NOTIFICATIONS_STATES, ...WEB_MOMENTS].sort(),
    );
  });
});
