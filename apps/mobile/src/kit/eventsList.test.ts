import type { ListedEvent } from '@soirely/api-client';
import { numberFormat, placeWords } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  cardStep,
  dayTiles,
  daysWords,
  listEventOf,
  rowLine,
  rowTag,
  shownEvent,
  tabsFit,
} from './eventsList.ts';

const t = ((key: string, o?: Record<string, string>) =>
  key === 'search.line.venueCity'
    ? `${o?.venue}, ${o?.city}`
    : key === 'todayScreen.dayAndPlace'
      ? `${o?.day} · ${o?.place}`
      : key) as unknown as TFunction;

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

describe('placeWords', () => {
  it('writes the venue, a comma and its city, as Search does', () => {
    const lineOf = (e: { place: string | null; city: string | null }) =>
      placeWords(e.place, e.city, (key, values) => t(key, values ?? {}));
    const of = (name: string | null, city: string | null) =>
      lineOf(
        listEventOf({
          ...EVENT,
          venue: { name, address: { formatted: 'Calle 1', city } },
        } as unknown as ListedEvent),
      );

    expect(of('Finca Pilar', 'Toledo')).toBe('Finca Pilar, Toledo');
    expect(of('Finca Pilar', null)).toBe('Finca Pilar');
    expect(of(null, 'Toledo')).toBe('Calle 1');
    expect(lineOf(listEventOf(EVENT))).toBe('search.line.venueToBeConfirmed');
  });

  it("is the place in the row's line", () => {
    const event = listEventOf({
      ...EVENT,
      venue: { name: 'Finca Pilar', address: { formatted: 'Calle 1', city: 'Toledo' } },
    } as unknown as ListedEvent);

    expect(rowLine(shownEvent(event, 'live' as never), new Date('2026-11-01'), 'en', t)).toContain(
      'Finca Pilar, Toledo',
    );
  });
});

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

  it("pairs the venue's name with its city only when the name is the place", () => {
    const venue = (name: string | null, city: string | null) =>
      listEventOf({
        ...EVENT,
        venue: { name, address: { formatted: 'Calle 1', city } },
      } as unknown as ListedEvent).city;

    expect(venue('Finca Pilar', 'Toledo')).toBe('Toledo');
    expect(venue('Finca Pilar', null)).toBeNull();
    expect(venue('Finca Pilar', '')).toBeNull();
    expect(venue(null, 'Toledo')).toBeNull();
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

  it('offers no step while an event is on with no milestone left, in the room its Duplicate takes', () => {
    expect(cardStep(shownEvent(listEventOf(EVENT), 'happening_now'), NOW, 'en', t)).toEqual({
      kind: 'none',
      keeps: {
        kind: 'button',
        line: 'timeline.finished',
        label: 'eventDuplicate.open',
        action: 'duplicate',
      },
    });
  });

  it('offers Duplicate once it is over', () => {
    expect(cardStep(shownEvent(listEventOf(EVENT), 'finished'), NOW, 'en', t)).toMatchObject({
      kind: 'button',
      line: 'timeline.finished',
      action: 'duplicate',
    });
  });

  it("writes next up's day with its year only when it is not this year", () => {
    const withDate = ((key: string, values?: { date?: string }) =>
      values?.date ?? key) as unknown as TFunction;
    const nextUpAt = (at: string) =>
      shownEvent(
        {
          ...listEventOf(EVENT),
          milestones: [
            {
              at,
              title: 'ends',
              note: null,
              owner: 'event' as const,
              area: 'event',
              action: null,
              done: false,
            },
          ],
        },
        'live',
      );

    expect(cardStep(nextUpAt('2028-04-29T17:00:00+02:00'), NOW, 'en-GB', withDate)).toMatchObject({
      kind: 'next',
      when: 'Sat, 29 Apr 2028, 17:00',
    });
    expect(cardStep(nextUpAt('2026-11-13T17:00:00+01:00'), NOW, 'en-GB', withDate)).toMatchObject({
      kind: 'next',
      when: 'Fri 13 Nov, 17:00',
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

  it.each([
    ['pt-BR', '+1200'],
    ['pt', '+1200'],
    ['es-MX', '+1200'],
    ['en-US', '+1,200'],
    ['fr-CA', '+1\u202f200'],
  ])('counts the days between in the shown language, never %s region', (locale, more) => {
    expect(drawn(dayTiles(lasting(1202, 'draft'), before, locale))?.[1]).toBe(more);
  });

  it('groups seven digits with the space its screen-reader label is heard with', () => {
    expect(drawn(dayTiles(lasting(1_365_247, 'draft'), before, 'pt-BR'))?.[1]).toBe(
      `+${numberFormat('pt').format(1_365_245)}`,
    );
    expect(numberFormat('pt').format(1_365_245)).toMatch(/^1\s365\s245$/u);
  });

  it('keys each tile by its date, so a day number that repeats a month on is its own', () => {
    const keys = (dayTiles(lasting(31, 'live'), before, 'en-GB') ?? []).map((tile) => tile.key);

    expect(keys).toEqual(['2026-11-14', 'gap-2026-11-14', '2026-12-14']);
  });
});

describe('daysWords', () => {
  const words = ((key: string, values: Record<string, unknown> = {}) =>
    `${key} ${JSON.stringify(values)}`) as unknown as TFunction;
  const now = new Date('2026-11-11T12:00:00+01:00');
  const day = {
    status: 'live' as const,
    startsAt: '2026-11-14T09:00:00+01:00',
    endsAt: '2026-11-14T23:00:00+01:00',
    timeZone: 'Europe/Madrid',
    concludedAt: null,
  };

  it('writes one day in the event’s zone', () => {
    expect(daysWords(day, now, 'en-US', true, words)).toBe('Saturday, Nov 14');
  });

  it('writes a multi-day event as its first and last day', () => {
    expect(
      daysWords({ ...day, endsAt: '2026-11-16T12:00:00+01:00' }, now, 'en-US', true, words),
    ).toBe('eventsScreen.days {"first":"Saturday, Nov 14","last":"Monday, Nov 16"}');
  });

  it('says in a list when an event was called off', () => {
    expect(
      daysWords(
        { ...day, status: 'ended', concludedAt: '2026-11-10T10:00:00+01:00' },
        now,
        'en-US',
        true,
        words,
      ),
    ).toBe('eventsScreen.calledOffOn {"date":"Nov 10"}');
  });

  it('names the year on every date when one is not this year', () => {
    expect(
      daysWords({ ...day, endsAt: '2027-01-02T12:00:00+01:00' }, now, 'en-US', true, words),
    ).toBe('eventsScreen.days {"first":"Saturday, Nov 14, 2026","last":"Saturday, Jan 2, 2027"}');
  });
});

describe('the tabs’ words at the largest sizes', () => {
  it('keeps their size where every tab fits', () => {
    expect(tabsFit(340, [90, 60, 50], [23, 4, 4], 24)).toBe(1);
  });

  it('steps every tab’s words down together until the row holds them, the tick and the pads unscaled', () => {
    const fit = tabsFit(340, [250, 180, 140], [23, 4, 4], 24);

    expect(fit).toBeCloseTo((340 - 3 * 24 - 31) / (570 - 31));
    expect(23 + 227 * fit + 4 + 176 * fit + 4 + 136 * fit + 3 * 24).toBeCloseTo(340);
  });
});
