import {
  ApiError,
  ERROR_TYPE_PREFIX,
  type StaffEntry,
  type StaffReminder,
} from '@soirely/api-client';
import { noticeClock, noticeLines } from '@soirely/domain';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { flipReminder } from './staffNotices.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const EVENT = {
  startsAt: '2026-10-17T16:00:00Z',
  endsAt: '2026-10-17T23:00:00Z',
  timeZone: 'Africa/Lagos',
};
const CLOCK = noticeClock(EVENT, 'en-US');

function person(more: Partial<StaffEntry> = {}): StaffEntry {
  return {
    id: 'st_1',
    fullName: 'Tope Bello',
    briefing: 'sent',
    inApp: true,
    notice: null,
    ...more,
  } as StaffEntry;
}

const words = (one: StaffEntry, finished = false) =>
  noticeLines(one, finished, CLOCK, t).map((line) => line.words);

describe('a change notice on the tablet (sc-97614)', () => {
  const waiting = person({
    briefing: 'changed',
    notice: {
      state: 'waiting',
      goesAt: '2026-10-15T19:55:00+01:00',
      changes: [{ kind: 'no_shift_left' }],
    },
  } as Partial<StaffEntry>);

  it('turns its Waiting lines into Told once the push is delivered', () => {
    expect(words(waiting)).toEqual([
      'Goes at 19:55',
      'No shift left, still on the staff',
      'Edits before then go in the same message.',
    ]);

    const delivered = person({
      briefing: 'sent',
      notice: { state: 'told', at: '2026-10-15T19:56:00+01:00', channel: 'push', ending: null },
    });

    expect(words(delivered)).toHaveLength(1);
    expect(words(delivered)[0]).toMatch(/^Told on .* at 19:56, by push\.$/);
  });

  it('leaves no Waiting line when the push was refused, so the row keeps Changed since sent', () => {
    const refused = person({ briefing: 'changed', notice: null });

    expect(words(refused)).toEqual([]);
  });
});

describe('turning the reminder switch (sc-97614)', () => {
  const was = { on: true, time: '19:55' } as StaffReminder;

  it('shows the card the API answers', async () => {
    const answer = { ...was, on: false } as StaffReminder;

    expect(await flipReminder(was, false, async () => answer)).toEqual({
      kind: 'saved',
      card: answer,
    });
  });

  it('puts the switch back when the save fails', async () => {
    const result = await flipReminder(was, false, async () => {
      throw new Error('offline');
    });

    expect(result).toEqual({ kind: 'failed', card: was });
    expect(t('notices.notSavedOn')).toBe('Couldn’t save. The reminder is still on.');
  });

  it('puts it back on the 403 a person with staff.read alone is given', async () => {
    const result = await flipReminder(was, false, async () => {
      throw new ApiError({ type: `${ERROR_TYPE_PREFIX}forbidden`, title: 'No', status: 403 });
    });

    expect(result.kind).toBe('failed');
  });

  it('reads the card again once the event is over', async () => {
    const result = await flipReminder(was, false, async () => {
      throw new ApiError({
        type: `${ERROR_TYPE_PREFIX}event_concluded`,
        title: 'Over',
        status: 409,
      });
    });

    expect(result.kind).toBe('over');
  });
});
