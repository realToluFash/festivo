import type { NotificationSetting } from '@soirely/api-client';
import { NOTIFICATION_CATEGORY_ORDER, quietHoursIn } from '@soirely/domain';
import { createInstance, init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';

import { saveSetting, type SettingsGrid, type SettingSwitch } from './notificationSettings.ts';
import * as page from './notificationsPage.ts';
import {
  cardCounts,
  cardSays,
  categoryNote,
  lockedLine,
  pageOf,
  quietHoursLine,
  rowSays,
  rowToggled,
  rowValue,
  saveAnswered,
  switchSaving,
} from './notificationsPage.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const SETTINGS: readonly NotificationSetting[] = NOTIFICATION_CATEGORY_ORDER.map((category) => ({
  category,
  push: { on: category !== 'account_security', switchable: true },
  email: { on: category !== 'event_day', switchable: category !== 'account_security' },
}));

const flipped = (category: string, channel: 'push' | 'email', on: boolean) =>
  SETTINGS.map((row) =>
    row.category === category ? { ...row, [channel]: { ...row[channel], on } } : row,
  );

const loaded = (): SettingsGrid => ({
  status: 'loaded',
  settings: [...SETTINGS],
  saving: [],
  saved: false,
  unsaved: null,
});

const answering = (refuse: boolean) => ({
  notificationSettings: () => Promise.resolve([...SETTINGS]),
  setNotificationSetting: () =>
    refuse ? Promise.reject(new Error('refused')) : Promise.resolve([...SETTINGS]),
});

describe('the notes', () => {
  it('leave Account & security’s locked email to the line under its switch', () => {
    expect(categoryNote('account_security', 'en', t)).toBe(
      'Sign-ins, your password, two-factor, ownership and access.',
    );
    expect(lockedLine('email', t)).toBe('Email cannot be switched off.');
  });

  it('fill Money’s thresholds in the reader’s numbers', () => {
    expect(categoryNote('money', 'en', t)).toBe(
      'Payments due, usage at 80% and 100%, failed payments and invoices.',
    );
  });
});

describe('the card', () => {
  it('says the channels with at least one kind on', () => {
    expect(cardSays(SETTINGS, t)).toBe('You hear by push and email');
    expect(
      cardSays(
        SETTINGS.map((row) => ({ ...row, email: { ...row.email, on: false } })),
        t,
      ),
    ).toBe('You hear by push only');
    expect(
      cardSays(
        SETTINGS.map((row) => ({ ...row, push: { ...row.push, on: false } })),
        t,
      ),
    ).toBe('You hear by email only');
  });

  it('counts the switches that are on, each way', () => {
    expect(cardCounts(SETTINGS, t)).toBe('5 of 6 by push · 5 of 6 by email');
    expect(cardCounts(flipped('messages', 'email', false), t)).toBe(
      '5 of 6 by push · 4 of 6 by email',
    );
  });
});

describe('a row’s value', () => {
  it('puts its two switches in words', () => {
    expect(SETTINGS.map((row) => rowValue(row, t))).toEqual([
      'Push and email',
      'Push and email',
      'Push only',
      'Push and email',
      'Push and email',
      'Email only · email always on',
    ]);
  });

  it('says Off when neither is on', () => {
    const row = flipped('event_day', 'push', false).find((one) => one.category === 'event_day');

    expect(row && rowValue(row, t)).toBe('Off');
  });
});

describe('quiet hours', () => {
  const line = 'Between 21:00 and 08:00 your time, only Event day pushes come through.';

  it('read 21:00 and 08:00 with the device in en-US and in en-GB', () => {
    expect(quietHoursLine('en-US', t)).toBe(line);
    expect(quietHoursLine('en-GB', t)).toBe(line);
  });

  it('have no AM or PM in any locale', () => {
    for (const locale of ['en', 'fr-FR', 'es-MX', 'pt-BR'])
      expect(quietHoursLine(locale, t)).not.toMatch(/AM|PM|a\.m\.|p\.m\./iu);
    expect(quietHoursLine('fr-FR', t)).toBe(line);
  });

  it('read De 21:00 à 08:00 in French', async () => {
    const french = createInstance();
    await french.init({
      lng: 'fr',
      resources: { fr: { translation: fr } },
      interpolation: { escapeValue: false },
    });

    expect(quietHoursLine('fr-FR', french.t)).toBe(
      'De 21:00 à 08:00 (votre heure locale), seules les notifications push «\u00a0Jour de l’événement\u00a0» vous parviennent.',
    );
  });

  it('take both times from the product’s quietHoursIn, with no clock of its own', () => {
    for (const locale of ['en-US', 'en-GB', 'fr-FR']) {
      const { start, end } = quietHoursIn(locale);

      expect(quietHoursLine(locale, t)).toBe(
        `Between ${start} and ${end} your time, only Event day pushes come through.`,
      );
    }
    expect(Object.keys(page)).not.toContain('clockTime');
  });
});

describe('the rows', () => {
  const own: SettingSwitch = { category: 'messages', channel: 'push' };

  it('open one at a time', () => {
    const one = rowToggled(pageOf(loaded()), 'guest_replies');

    expect(rowToggled(one, 'money').opened).toBe('money');
    expect(rowToggled(one, 'guest_replies').opened).toBeNull();
  });

  it('say Saving… while a save is out, then Saved until another row opens', async () => {
    const open = rowToggled(pageOf(loaded()), 'messages');
    const out = switchSaving(open, own, false);

    expect(rowSays(out, 'messages')).toBe('saving');
    const apply = await saveSetting(answering(false), 'messages', 'push', false);
    const answered = saveAnswered(out, apply, own);

    expect(rowSays(answered, 'messages')).toBe('saved');
    expect(rowSays(rowToggled(answered, 'messages'), 'messages')).toBe('saved');
    expect(rowSays(rowToggled(answered, 'money'), 'messages')).toBeNull();
  });

  it('take Saved off a row whose next save fails', async () => {
    const saved = { ...pageOf(loaded()), opened: own.category, savedRow: own.category };
    const out = switchSaving(saved, own, false);
    const apply = await saveSetting(answering(true), 'messages', 'push', false);
    const answered = saveAnswered(out, apply, own);

    expect(rowSays(answered, 'messages')).toBeNull();
    expect(answered.grid.status === 'loaded' && answered.grid.unsaved).toEqual(own);
  });
});
