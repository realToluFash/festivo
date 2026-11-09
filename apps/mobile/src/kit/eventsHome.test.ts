import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { EVENT_CARD_GAP, eventCardWidth, eventDatesWords, summaryWords } from './eventsHome.ts';

const t = ((key: string, values: Record<string, unknown> = {}) =>
  `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const EVENT = {
  status: 'live' as const,
  startsAt: '2026-11-14T09:00:00+01:00',
  endsAt: '2026-11-14T23:00:00+01:00',
  timeZone: 'Europe/Madrid',
  concludedAt: null,
};

describe('eventCardWidth', () => {
  it.each([
    ['the iPhone SE', 'phone', 343, 166],
    ['the phone', 'phone', 358, 174],
    ['the 11-inch iPad upright', 'tabletPortrait', 778, 250],
    ['the 10.9-inch iPad upright', 'tabletPortrait', 764, 245],
    ['the iPad mini upright', 'tabletPortrait', 688, 220],
    ['the 13-inch iPad upright', 'tabletPortrait', 968, 313],
    ['the 11-inch iPad on its side', 'tabletLandscape', 926, 299],
    ['the iPad mini on its side', 'tabletLandscape', 865, 279],
  ] as const)('%s', (_device, kind, room, width) => {
    expect(eventCardWidth(kind, room)).toBe(width);
  });

  it.each([
    ['phone', 343, 2],
    ['phone', 358, 2],
    ['tabletPortrait', 688, 3],
    ['tabletPortrait', 778, 3],
    ['tabletPortrait', 968, 3],
    ['tabletLandscape', 926, 3],
    ['tabletLandscape', 865, 3],
    ['tabletLandscape', 846, 3],
    ['tabletLandscape', 756, 3],
  ] as const)('%s with %i of room fills the row with %i cards', (kind, room, columns) => {
    const row = columns * eventCardWidth(kind, room) + (columns - 1) * EVENT_CARD_GAP[kind];

    expect(row).toBeLessThanOrEqual(room);
    expect(room - row).toBeLessThan(columns);
  });
});

describe('summaryWords', () => {
  it('joins the parts whose count is not 0, in order', () => {
    const join = ((key: string, values: Record<string, unknown> = {}) =>
      key === 'eventsScreen.summaryJoin'
        ? `${String(values.first)} · ${String(values.rest)}`
        : `${key.replace('eventsScreen.summary', '')} ${String(values.count)}`) as unknown as TFunction;

    expect(summaryWords({ happeningNow: 2, upcoming: 3, drafts: 1 }, join)).toBe(
      'HappeningNow 2 · Upcoming 3 · Drafts 1',
    );
    expect(summaryWords({ happeningNow: 0, upcoming: 3, drafts: 0 }, join)).toBe('Upcoming 3');
  });

  it('has nothing to say with nothing to count', () => {
    expect(summaryWords({ happeningNow: 0, upcoming: 0, drafts: 0 }, t)).toBeNull();
  });
});

describe('eventDatesWords', () => {
  it('writes one day, then its start and zone, in the event’s zone', () => {
    expect(eventDatesWords(EVENT, 'en-US', t)).toEqual({
      days: 'Saturday, Nov 14',
      time: 'eventsScreen.timeAndZone {"time":"09:00","timeZone":"Europe/Madrid"}',
    });
  });

  it('writes a multi-day event as its first and last day', () => {
    expect(
      eventDatesWords({ ...EVENT, endsAt: '2026-11-16T12:00:00+01:00' }, 'en-US', t).days,
    ).toBe('eventsScreen.days {"first":"Saturday, Nov 14","last":"Monday, Nov 16"}');
  });

  it('says when an event was called off, with no time', () => {
    expect(
      eventDatesWords(
        { ...EVENT, status: 'ended', concludedAt: '2026-11-10T10:00:00+01:00' },
        'en-US',
        t,
      ),
    ).toEqual({ days: 'eventsScreen.calledOffOn {"date":"Nov 10"}', time: null });
  });
});
