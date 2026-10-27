import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { cardDateWords } from './eventsHome.ts';

const t = ((key: string, values: Record<string, unknown> = {}) =>
  `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const EVENT = {
  status: 'live' as const,
  startsAt: '2026-11-14T09:00:00+01:00',
  timeZone: 'Europe/Madrid',
  concludedAt: null,
};

describe('cardDateWords', () => {
  it('writes the date with how far away it is, counted in the event’s zone', () => {
    expect(cardDateWords(EVENT, 'live', new Date('2026-10-13T12:00:00Z'), 'en-US', t)).toBe(
      'eventsScreen.dateAway {"date":"Saturday, Nov 14","distance":"timeline.inDays {\\"count\\":32}"}',
    );
  });

  it('says when it started today while it is happening', () => {
    expect(
      cardDateWords(EVENT, 'happening_now', new Date('2026-11-14T09:00:00Z'), 'en-US', t),
    ).toBe('eventsScreen.startedToday {"time":"09:00","timeZone":"Europe/Madrid"}');
  });

  it('says when an event was called off', () => {
    const calledOff = {
      ...EVENT,
      status: 'ended' as const,
      concludedAt: '2026-09-30T10:00:00+02:00',
    };

    expect(cardDateWords(calledOff, 'finished', new Date('2026-10-13T12:00:00Z'), 'en-US', t)).toBe(
      'eventsScreen.calledOffOn {"date":"Sep 30"}',
    );
  });
});
