import type { ListedEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { listEventOf, rowTag, shownEvent } from './eventsList.ts';

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
