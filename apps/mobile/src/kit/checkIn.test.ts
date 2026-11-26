import type { ListedEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { beforeOpenTags, checksIn, clockOf, onEventDay } from './checkIn.ts';
import { listEventOf, shownEvent } from './eventsList.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

describe('the times', () => {
  it('reads the 24-hour clock in the event’s zone', () => {
    expect(clockOf('2026-11-21T19:42:10+01:00')).toBe('19:42');
  });
});

describe('Open check-in', () => {
  const event = { startsAt: '2026-11-21T18:00:00+01:00', endsAt: '2026-11-22T02:00:00+01:00' };

  it('shows on each of the event’s days, a day counted from 05:00', () => {
    expect(onEventDay(event, '2026-11-21T05:00:00+01:00')).toBe(true);
    expect(onEventDay(event, '2026-11-22T04:59:00+01:00')).toBe(true);
    expect(onEventDay(event, '2026-11-21T04:59:00+01:00')).toBe(false);
    expect(onEventDay(event, '2026-11-22T05:00:00+01:00')).toBe(false);
  });

  it('is for whoever holds guests.check_in', () => {
    expect(checksIn({ permissions: ['guests.read', 'guests.check_in'] })).toBe(true);
    expect(checksIn({ permissions: ['guests.read'] })).toBe(false);
    expect(checksIn(null)).toBe(false);
  });
});

describe('beforeOpenTags', () => {
  const event = shownEvent(
    listEventOf({
      id: 'ev-1',
      name: 'Adaeze at Eko',
      type: 'wedding',
      status: 'live',
      startsAt: '2026-11-21T18:00:00+01:00',
      endsAt: '2026-11-21T23:00:00+01:00',
      timeZone: 'Africa/Lagos',
      concludedAt: null,
      venue: null,
      cover: null,
      milestones: [],
    } as unknown as ListedEvent),
    'live',
  );

  it('names the start beside Live on the day, as the demo draws "Today, 18:00"', () => {
    expect(beforeOpenTags(event, new Date('2026-11-21T14:00:00+01:00'), t)).toEqual([
      { word: 'eventsScreen.live', mark: 'live' },
      { word: 'checkIn.todayAt {"time":"18:00"}' },
    ]);
  });

  it("keeps the card's own chips on an earlier day", () => {
    expect(beforeOpenTags(event, new Date('2026-11-20T23:30:00+01:00'), t)).toEqual([
      { word: 'eventsScreen.live', mark: 'live' },
      { word: 'timeline.inDays {"count":1}' },
    ]);
  });
});
