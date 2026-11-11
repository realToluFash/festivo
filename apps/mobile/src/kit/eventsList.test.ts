import type { ListedEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { cardStep, dayTiles, listEventOf, rowTag, shownEvent } from './eventsList.ts';

const t = ((key: string) => key) as unknown as TFunction;

const EVENT = {
  id: 'ev-1',
  name: 'Ana & Leo',
  type: 'wedding',
  status: 'live',
  startsAt: '2026-11-14T09:00:00+01:00',
  endsAt: '2026-11-14T23:00:00+01:00',
  timeZone: 'Europe/Madrid',
  concludedAt: null,
  venue: null,
  cover: null,
  milestones: [],
} as unknown as ListedEvent;

describe('listEventOf', () => {
  it('has no place and no photo until the event has a venue and a cover', () => {
    expect(listEventOf(EVENT)).toMatchObject({ place: null, photo: null });
  });

  it("takes the venue's name, else its address", () => {
    const named = { ...EVENT, venue: { name: 'Finca Pilar', address: { formatted: 'Calle 1' } } };
    const unnamed = { ...EVENT, venue: { name: null, address: { formatted: 'Calle 1' } } };

    expect(listEventOf(named as unknown as ListedEvent).place).toBe('Finca Pilar');
    expect(listEventOf(unnamed as unknown as ListedEvent).place).toBe('Calle 1');
  });

  it('carries the cover with the event type it is drawn for', () => {
    const cover = { url: 'https://example.test/c.jpg' };
    const listed = listEventOf({ ...EVENT, cover } as unknown as ListedEvent);

    expect(listed.photo).toEqual({ cover, type: 'wedding' });
  });
});

describe('rowTag', () => {
  const shown = (phase: Parameters<typeof shownEvent>[1]) => shownEvent(listEventOf(EVENT), phase);

  it('marks only what sets a row apart in its own tab', () => {
    expect(rowTag(shown('live'), false, t)).toBeNull();
    expect(rowTag(shown('draft'), false, t)).toBeNull();
    expect(rowTag(shown('happening_now'), false, t)).toEqual({
      kind: 'now',
      word: 'eventsScreen.happeningNow',
    });
    expect(rowTag(shown('paused'), false, t)).toEqual({
      kind: 'paused',
      word: 'eventsScreen.paused',
    });
  });

  it('names every phase where tabs are mixed', () => {
    expect(rowTag(shown('draft'), true, t)?.word).toBe('eventsScreen.draft');
    expect(rowTag(shown('live'), true, t)?.word).toBe('eventsScreen.live');
    expect(rowTag(shown('finished'), true, t)?.word).toBe('eventsScreen.finished');
  });
});

describe('cardStep', () => {
  const NOW = new Date('2026-11-10T12:00:00Z');
  const unread = (phase: Parameters<typeof shownEvent>[1]) =>
    shownEvent({ ...listEventOf(EVENT), milestones: null }, phase);

  it('offers no step for a live event whose milestones are still unread, never Duplicate', () => {
    expect(cardStep(unread('live'), NOW, 'en', t)).toBeNull();
    expect(cardStep(unread('happening_now'), NOW, 'en', t)).toBeNull();
  });

  it('offers Duplicate once a live event has no milestone left', () => {
    expect(cardStep(shownEvent(listEventOf(EVENT), 'live'), NOW, 'en', t)).toMatchObject({
      action: 'duplicate',
    });
  });

  it('does not wait on milestones where the phase alone decides the step', () => {
    expect(cardStep(unread('draft'), NOW, 'en', t)).toMatchObject({ action: 'makeLive' });
    expect(cardStep(unread('paused'), NOW, 'en', t)).toMatchObject({ action: 'resume' });
    expect(cardStep(unread('finished'), NOW, 'en', t)).toMatchObject({ action: 'duplicate' });
  });
});

describe('dayTiles', () => {
  const DAY = 86_400_000;
  const lasting = (days: number, phase: Parameters<typeof shownEvent>[1]) =>
    shownEvent(
      listEventOf({
        ...EVENT,
        endsAt: new Date(Date.parse('2026-11-14T22:00:00+01:00') + (days - 1) * DAY).toISOString(),
      }),
      phase,
    );
  const drawn = (tiles: ReturnType<typeof dayTiles>) =>
    tiles?.map((tile) => {
      if (tile.kind === 'gap') return tile.more;

      return tile.today ? `[${tile.day}]` : tile.day;
    });
  const before = new Date('2026-11-01T12:00:00+01:00');

  it('keeps a tile a day for up to a week', () => {
    expect(drawn(dayTiles(lasting(7, 'live'), before, 'en-GB'))).toEqual([
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
    ]);
  });

  it('draws the first and last day of a longer event, with the days between counted', () => {
    expect(drawn(dayTiles(lasting(8, 'live'), before, 'en-GB'))).toEqual(['14', '+6', '21']);
    expect(drawn(dayTiles(lasting(547, 'draft'), before, 'en-GB'))).toEqual(['14', '+545', '13']);
  });

  it('adds today between them only while it is on', () => {
    const on = new Date('2026-11-18T12:00:00+01:00');

    expect(drawn(dayTiles(lasting(10, 'happening_now'), on, 'en-GB'))).toEqual([
      '14',
      '+3',
      '[18]',
      '+4',
      '23',
    ]);
    expect(drawn(dayTiles(lasting(10, 'paused'), on, 'en-GB'))).toEqual(['14', '+8', '23']);
  });

  it("draws a single hidden day's own tile rather than +1", () => {
    const second = new Date('2026-11-16T12:00:00+01:00');

    expect(drawn(dayTiles(lasting(9, 'happening_now'), second, 'en-GB'))).toEqual([
      '14',
      '15',
      '[16]',
      '+5',
      '22',
    ]);
  });

  it('marks today on the end it falls on', () => {
    const last = new Date('2026-11-21T12:00:00+01:00');

    expect(drawn(dayTiles(lasting(8, 'happening_now'), last, 'en-GB'))).toEqual([
      '14',
      '+6',
      '[21]',
    ]);
  });

  it('keys each tile by its date, so a day number that repeats a month on is its own', () => {
    const keys = (dayTiles(lasting(31, 'live'), before, 'en-GB') ?? []).map((tile) => tile.key);

    expect(keys).toEqual(['2026-11-14', 'gap-2026-11-14', '2026-12-14']);
  });
});
