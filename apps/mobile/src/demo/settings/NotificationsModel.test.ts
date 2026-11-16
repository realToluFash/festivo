import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { readSettings, saveSetting, settingSaving } from '../../kit/notificationSettings.ts';
import { cardCounts, rowSays, switchName } from '../../kit/notificationsPage.ts';
import * as model from './NotificationsModel.ts';
import {
  firstGrid,
  firstPage,
  NOTIFICATIONS_STATES,
  notificationsStateOf,
  SAMPLE_SETTINGS,
  SAMPLE_SWITCH,
  sampleClient,
} from './NotificationsModel.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const now = () => Promise.resolve();

describe('the sample settings', () => {
  it('are epic 36’s defaults, in the grid’s order', () => {
    expect(SAMPLE_SETTINGS.map((row) => [row.category, row.push.on, row.email.on])).toEqual([
      ['guest_replies', true, true],
      ['messages', true, true],
      ['event_day', true, false],
      ['event_changes', true, true],
      ['money', true, true],
      ['account_security', false, true],
    ]);
  });

  it('lock Account & security email on, and only that', () => {
    const locked = SAMPLE_SETTINGS.flatMap((row) =>
      (['push', 'email'] as const)
        .filter((channel) => !row[channel].switchable)
        .map((channel) => switchName(row.category, channel, t)),
    );

    expect(locked).toEqual(['Account & security Email']);
  });
});

describe('the model', () => {
  it('keeps no clock of its own', () => {
    expect(Object.keys(model)).not.toContain('clockTime');
  });
});

describe('a state link', () => {
  it('opens a state it names, and the page at rest for anything else', () => {
    expect(notificationsStateOf('saveFailed')).toBe('saveFailed');
    expect(notificationsStateOf('nonsense')).toBeNull();
    expect(notificationsStateOf(undefined)).toBeNull();
  });

  it('starts a failed save with Messages email back on and its error under it', () => {
    const grid = firstGrid('saveFailed');

    expect(grid.status === 'loaded' && grid.unsaved).toEqual(SAMPLE_SWITCH);
    expect(
      grid.status === 'loaded' && grid.settings.find((row) => row.category === 'messages'),
    ).toMatchObject({ email: { on: true } });
  });

  it('opens Messages with its email switched off, held or answered', () => {
    const saving = firstPage('saving');
    const saved = firstPage('saved');

    expect([saving.opened, rowSays(saving, 'messages')]).toEqual(['messages', 'saving']);
    expect([saved.opened, rowSays(saved, 'messages')]).toEqual(['messages', 'saved']);
    expect(saved.grid.status === 'loaded' && cardCounts(saved.grid.settings, t)).toBe(
      '5 of 6 by push · 4 of 6 by email',
    );
  });

  it('lists every state, with nothing open at rest', () => {
    expect(NOTIFICATIONS_STATES).toEqual([
      'pushBlocked',
      'saveFailed',
      'saving',
      'saved',
      'loading',
      'failed',
    ]);
    expect(firstPage(null)).toMatchObject({ opened: null, savedRow: null });
  });

  it('starts loading and failed without a grid', () => {
    expect(firstGrid('loading')).toEqual({ status: 'loading' });
    expect(firstGrid('failed')).toEqual({ status: 'failed' });
  });
});

describe('the sample client', () => {
  it('saves a switch, and the grid keeps it', async () => {
    const client = sampleClient(null, now);
    const before = settingSaving(firstGrid(null), 'guest_replies', 'push', false);
    const after = (await saveSetting(client, 'guest_replies', 'push', false))(before);

    expect(after).toMatchObject({ status: 'loaded', saved: true, unsaved: null, saving: [] });
    expect(after.status === 'loaded' && after.settings[0]?.push.on).toBe(false);
  });

  it('refuses Messages email in the saveFailed state, and puts the switch back', async () => {
    const client = sampleClient('saveFailed', now);
    const before = settingSaving(firstGrid(null), 'messages', 'email', false);
    const after = (await saveSetting(client, 'messages', 'email', false))(before);

    expect(after).toMatchObject({ status: 'loaded', saved: false, unsaved: SAMPLE_SWITCH });
    expect(after.status === 'loaded' && after.settings[1]?.email.on).toBe(true);
  });

  it('saves every other switch in the saveFailed state', async () => {
    const client = sampleClient('saveFailed', now);
    const after = (await saveSetting(client, 'messages', 'push', false))(firstGrid(null));

    expect(after).toMatchObject({ saved: true, unsaved: null });
  });

  it('loads on Try again', async () => {
    const apply = await readSettings(sampleClient('failed', now));

    expect(apply({ status: 'failed' })).toMatchObject({ status: 'loaded' });
  });
});
