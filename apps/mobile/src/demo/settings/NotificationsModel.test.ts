import { describe, expect, it } from 'vitest';

import { readSettings, saveSetting, settingSaving } from '../../kit/notificationSettings.ts';
import {
  cardCounts,
  cardSays,
  categoryNote,
  firstGrid,
  firstPage,
  lockedLine,
  NOTIFICATIONS_STATES,
  notificationsStateOf,
  quietHoursLine,
  rowSays,
  rowToggled,
  rowValue,
  SAMPLE_SETTINGS,
  SAMPLE_SWITCH,
  sampleClient,
  saveAnswered,
  switchName,
  switchSaving,
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

  it('leave Account & security’s locked email to the line under its switch', () => {
    expect(categoryNote('account_security', 'en')).toBe(
      'Sign-ins, your password, two-factor, ownership and access.',
    );
    expect(lockedLine('email')).toBe('Email cannot be switched off.');
  });

  it('fill Money’s thresholds in the reader’s numbers', () => {
    expect(categoryNote('money', 'en')).toBe(
      'Payments due, usage at 80% and 100%, failed payments and invoices.',
    );
  });
});

const flipped = (category: string, channel: 'push' | 'email', on: boolean) =>
  SAMPLE_SETTINGS.map((row) =>
    row.category === category ? { ...row, [channel]: { ...row[channel], on } } : row,
  );

describe('the card', () => {
  it('says the channels with at least one kind on', () => {
    expect(cardSays(SAMPLE_SETTINGS)).toBe('You hear by push and email');
    expect(
      cardSays(SAMPLE_SETTINGS.map((row) => ({ ...row, email: { ...row.email, on: false } }))),
    ).toBe('You hear by push only');
    expect(
      cardSays(SAMPLE_SETTINGS.map((row) => ({ ...row, push: { ...row.push, on: false } }))),
    ).toBe('You hear by email only');
  });

  it('counts the switches that are on, each way', () => {
    expect(cardCounts(SAMPLE_SETTINGS)).toBe('5 of 6 by push · 5 of 6 by email');
    expect(cardCounts(flipped('messages', 'email', false))).toBe(
      '5 of 6 by push · 4 of 6 by email',
    );
  });
});

describe('a row’s value', () => {
  it('puts its two switches in words', () => {
    expect(SAMPLE_SETTINGS.map(rowValue)).toEqual([
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

    expect(row && rowValue(row)).toBe('Off');
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
    expect(saved.grid.status === 'loaded' && cardCounts(saved.grid.settings)).toBe(
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

describe('the rows', () => {
  it('open one at a time', () => {
    const one = rowToggled(firstPage(null), 'guest_replies');

    expect(rowToggled(one, 'money').opened).toBe('money');
    expect(rowToggled(one, 'guest_replies').opened).toBeNull();
  });

  it('say Saving… while a save is out, then Saved until another row opens', async () => {
    const own = { category: 'messages', channel: 'push' } as const;
    const open = rowToggled(firstPage(null), 'messages');
    const out = switchSaving(open, own, false);

    expect(rowSays(out, 'messages')).toBe('saving');
    const apply = await saveSetting(sampleClient(null, now), 'messages', 'push', false);
    const answered = saveAnswered(out, apply, own);

    expect(rowSays(answered, 'messages')).toBe('saved');
    expect(rowSays(rowToggled(answered, 'messages'), 'messages')).toBe('saved');
    expect(rowSays(rowToggled(answered, 'money'), 'messages')).toBeNull();
  });

  it('take Saved off a row whose next save fails', async () => {
    const saved = firstPage('saved');
    const out = switchSaving(saved, SAMPLE_SWITCH, true);
    const apply = await saveSetting(sampleClient('saveFailed', now), 'messages', 'email', true);
    const answered = saveAnswered(out, apply, SAMPLE_SWITCH);

    expect(rowSays(answered, 'messages')).toBeNull();
    expect(answered.grid.status === 'loaded' && answered.grid.unsaved).toEqual(SAMPLE_SWITCH);
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
