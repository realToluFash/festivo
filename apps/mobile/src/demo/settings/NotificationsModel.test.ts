import { describe, expect, it } from 'vitest';

import { readSettings, saveSetting, settingSaving } from '../../kit/notificationSettings.ts';
import {
  categoryNote,
  firstGrid,
  NEVER_SAVED,
  notificationsStateOf,
  quietHoursLine,
  SAMPLE_SETTINGS,
  sampleClient,
  switchName,
} from './NotificationsModel.ts';

const now = () => Promise.resolve();
const spaced = (words: string) => words.replace(/\s/gu, ' ');

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
        .map((channel) => switchName(row.category, channel)),
    );

    expect(locked).toEqual(['Account & security Email']);
  });

  it('fill Money’s thresholds in the reader’s numbers', () => {
    expect(categoryNote('money', 'en')).toBe(
      'Payments due, usage at 80% and 100%, failed payments and invoices.',
    );
  });
});

describe('quiet hours', () => {
  it('follow the reader’s clock', () => {
    expect(spaced(quietHoursLine('en-US'))).toBe(
      'Between 9:00 PM and 8:00 AM your time, only Event day pushes come through.',
    );
    expect(spaced(quietHoursLine('en-GB'))).toBe(
      'Between 21:00 and 08:00 your time, only Event day pushes come through.',
    );
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

    expect(grid.status === 'loaded' && grid.unsaved).toEqual(NEVER_SAVED);
    expect(
      grid.status === 'loaded' && grid.settings.find((row) => row.category === 'messages'),
    ).toMatchObject({ email: { on: true } });
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

    expect(after).toMatchObject({ status: 'loaded', saved: false, unsaved: NEVER_SAVED });
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
