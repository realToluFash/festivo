import { describe, expect, it } from 'vitest';

import type { Milestone } from './timeline.ts';
import { type TodayEvent, greetingAt, today } from './today.ts';

const NOW = new Date('2026-11-03T09:41:00Z');
const LONDON = { timeZone: 'Europe/London', hour: 9, locale: 'en' };

function event(name: string, rest: Partial<TodayEvent> = {}): TodayEvent {
  return {
    id: name,
    name,
    status: 'live',
    phase: 'live',
    startsAt: '2026-11-06T19:00:00Z',
    endsAt: '2026-11-08T14:00:00Z',
    timeZone: 'Europe/London',
    dayCount: 3,
    concludedAt: null,
    milestones: [],
    ...rest,
  };
}

function milestone(at: string, title: string): Milestone {
  return { at, title, note: null, owner: 'automatic', area: 'guests', action: null };
}

const ONE_NIGHT = { startsAt: '2026-11-28T18:00:00Z', endsAt: '2026-11-28T23:00:00Z', dayCount: 1 };

const names = (events: readonly TodayEvent[]) => events.map(({ name }) => name);

describe('today', () => {
  it('greets by the hour', () => {
    expect([greetingAt(9), greetingAt(12), greetingAt(17), greetingAt(18)]).toEqual([
      'morning',
      'afternoon',
      'afternoon',
      'evening',
    ]);
  });

  it('lists under way, then to come soonest first, then drafts', () => {
    const shown = today(
      {
        events: [
          event('draft', { status: 'draft', phase: 'draft' }),
          event('later', ONE_NIGHT),
          event('wedding'),
          event('on', { phase: 'happening_now', startsAt: '2026-11-02T10:00:00Z' }),
        ],
        at: NOW,
      },
      NOW,
      LONDON,
    );

    expect(names(shown.events)).toEqual(['on', 'wedding', 'later', 'draft']);
    expect(shown.now?.name).toBe('on');
  });

  it('takes Now from the event under way that started first, and keeps the other in the list', () => {
    const shown = today(
      {
        events: [
          event('second', { phase: 'happening_now', startsAt: '2026-11-03T08:00:00Z' }),
          event('first', { phase: 'happening_now', startsAt: '2026-11-02T10:00:00Z' }),
        ],
        at: NOW,
      },
      NOW,
      LONDON,
    );

    expect(shown.now?.name).toBe('first');
    expect(names(shown.events)).toEqual(['first', 'second']);
  });

  it('marks seven days from today, each with its event days and milestones', () => {
    const wedding = event('wedding', {
      milestones: [milestone('2026-11-05T09:00:00Z', 'Meal choices close')],
    });
    const shown = today({ events: [wedding], at: NOW }, NOW, LONDON);

    expect(shown.week.map(({ day }) => day)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
    ]);
    expect(shown.week[0]?.today).toBe(true);
    expect(shown.week.map(({ items }) => items.length)).toEqual([0, 0, 1, 1, 1, 1, 0]);
    expect(shown.nextUp).toBeNull();
    expect(shown.now).toBeNull();
  });

  it('names what is next after a week with nothing in it, and leaves drafts off the week', () => {
    const shown = today(
      {
        events: [
          event('party', ONE_NIGHT),
          event('draft', { status: 'draft', phase: 'draft', startsAt: '2026-11-04T18:00:00Z' }),
        ],
        at: NOW,
      },
      NOW,
      LONDON,
    );

    expect(shown.week.every(({ items }) => items.length === 0)).toBe(true);
    expect(shown.nextUp?.name).toBe('party');
  });

  it('takes today in the reader’s zone', () => {
    const late = new Date('2026-11-03T23:30:00Z');
    const shown = today({ events: [], at: late }, late, { ...LONDON, timeZone: 'Asia/Tokyo' });

    expect(shown.week[0]?.day).toBe('2026-11-04');
    expect(shown.events).toEqual([]);
  });
});
