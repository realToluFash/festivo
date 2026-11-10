import { describe, expect, it } from 'vitest';

import type { TodayEvent } from './today.ts';
import { todayView } from './todayView.ts';

const NOW = new Date('2026-11-03T09:41:00Z');
const AT = new Date('2026-11-03T09:40:00Z');
const LONDON = { timeZone: 'Europe/London', locale: 'en-GB' };

function event(id: string, rest: Partial<TodayEvent> = {}): TodayEvent {
  return {
    id,
    name: id,
    status: 'live',
    phase: 'live',
    startsAt: '2026-11-06T19:00:00Z',
    endsAt: '2026-11-08T14:00:00Z',
    concludedAt: null,
    timeZone: 'Europe/London',
    dayCount: 3,
    milestones: [],
    ...rest,
  };
}

const view = (events: TodayEvent[], now = NOW) => todayView({ events, at: AT }, now, LONDON);

describe('todayView', () => {
  it('a planning week bars a multi-day event, names it under the greeting, and counts down to it', () => {
    const plan = view([event('wedding'), event('draft', { status: 'draft', phase: 'draft' })]);

    expect(plan).toMatchObject({ kind: 'plan', greeting: 'morning', on: '2026-11-03', now: null });
    expect(plan.bars.map(({ event: { id }, ...bar }) => [id, bar])).toEqual([
      ['wedding', { start: 3, span: 3, openLeft: false, dayToday: -2 }],
    ]);
    expect(plan.days.map(({ dots }) => dots.length)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(
      plan.agenda.map(({ day, daysAway, items }) => [
        day,
        daysAway,
        items.map((item) => item.kind),
      ]),
    ).toEqual([
      ['2026-11-03', 0, []],
      ['2026-11-06', 3, ['starts']],
      ['2026-11-07', 4, ['continues']],
      ['2026-11-08', 5, ['ends']],
    ]);
    expect(plan.sub).toMatchObject({ kind: 'startsOn', day: '2026-11-06', withinWeek: true });
    expect(plan.cards.map(({ count, live, finalWeek }) => [count, live, finalWeek])).toEqual([
      [{ kind: 'inDays', days: 3 }, false, true],
      [{ kind: 'draft' }, false, false],
    ]);
  });

  it('an event later today that has not started counts Today, is not live, and is the one the line under the greeting names', () => {
    const tonight = event('tonight', {
      startsAt: '2026-11-03T19:00:00Z',
      endsAt: '2026-11-03T23:00:00Z',
      dayCount: 1,
    });

    const alone = view([tonight]);
    expect(alone).toMatchObject({ kind: 'plan', now: null });
    expect(alone.cards[0]).toMatchObject({
      count: { kind: 'today' },
      live: false,
      finalWeek: false,
    });
    expect(alone.sub).toMatchObject({ kind: 'startsToday', event: { id: 'tonight' } });

    expect(view([event('wedding'), tonight]).sub).toMatchObject({
      kind: 'startsToday',
      event: { id: 'tonight' },
    });
  });

  it('a draft dated today is a draft, never live', () => {
    const card = view([
      event('draft', {
        status: 'draft',
        phase: 'draft',
        startsAt: '2026-11-03T08:00:00Z',
        endsAt: '2026-11-03T23:00:00Z',
        dayCount: 1,
      }),
    ]).cards[0];

    expect(card).toMatchObject({ count: { kind: 'draft' }, draft: true, live: false });
  });

  it('tomorrow is one day away and in its final week', () => {
    const card = view([
      event('party', {
        startsAt: '2026-11-04T18:00:00Z',
        endsAt: '2026-11-04T23:00:00Z',
        dayCount: 1,
      }),
    ]).cards[0];

    expect(card).toMatchObject({
      count: { kind: 'inDays', days: 1 },
      live: false,
      finalWeek: true,
    });
  });

  it('on the day, Now is the event under way, its bar runs in from the left, and it ends tomorrow', () => {
    const day = view(
      [event('wedding', { phase: 'happening_now' })],
      new Date('2026-11-07T16:10:00Z'),
    );

    expect(day).toMatchObject({ kind: 'day', greeting: 'afternoon' });
    expect(day.now).toMatchObject({ dayToday: 2, lastDay: '2026-11-08', endsIn: 1 });
    expect(day.bars[0]).toMatchObject({ start: 0, span: 2, openLeft: true, dayToday: 2 });
    expect(day.cards[0]).toMatchObject({ count: { kind: 'dayOf', day: 2, total: 3 }, live: true });
  });

  it('a milestone on a day with no bar is a dot', () => {
    const party = event('party', {
      startsAt: '2026-11-28T18:00:00Z',
      endsAt: '2026-11-28T23:00:00Z',
      dayCount: 1,
      milestones: [
        {
          at: '2026-11-04T10:00:00Z',
          title: 'Replies close',
          note: null,
          owner: 'automatic',
          area: 'guests',
          action: null,
        },
      ],
    });
    const plan = view([party]);

    expect(plan.days.map(({ dots }) => dots.map(({ id }) => id))).toEqual([
      [],
      ['party'],
      [],
      [],
      [],
      [],
      [],
    ]);
    expect(plan.sub).toMatchObject({ kind: 'startsOn', day: '2026-11-28', withinWeek: false });
  });

  it('a quiet week names what is next, and a first run welcomes', () => {
    const party = event('party', {
      startsAt: '2026-11-28T18:00:00Z',
      endsAt: '2026-11-28T23:00:00Z',
      dayCount: 1,
    });

    expect(view([party])).toMatchObject({
      kind: 'quiet',
      nextUp: { event: { id: 'party' }, day: '2026-11-28', daysAway: 25 },
    });
    expect(view([])).toMatchObject({
      kind: 'first',
      greeting: 'welcome',
      sub: { kind: 'first' },
      cards: [],
    });
  });
});
