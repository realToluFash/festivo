import type { ListedEvent } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { todayMoment } from './todayMoment.ts';

const i18n = createInstance();
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const NOW = new Date('2026-11-03T09:41:00Z');
const AT = new Date('2026-11-03T09:40:00Z');
const LONDON = { timeZone: 'Europe/London', locale: 'en-GB' };

function event(name: string, rest: Partial<ListedEvent> = {}): ListedEvent {
  return {
    id: name,
    organisationId: 'org',
    name,
    type: 'wedding',
    status: 'live',
    phase: 'live',
    startsAt: '2026-11-06T19:00:00Z',
    endsAt: '2026-11-08T14:00:00Z',
    timeZone: 'Europe/London',
    dayCount: 3,
    currency: 'GBP',
    cover: null,
    venue: { name: 'The Landmark', address: null },
    hosts: [],
    madeLiveAt: '2026-10-01T00:00:00Z',
    pausedAt: null,
    concludedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    milestones: [],
    ...rest,
  };
}

const moment = (events: ListedEvent[], now = NOW) =>
  todayMoment({ events, at: AT }, now, LONDON, 'Folake', i18n.t);

describe('todayMoment', () => {
  it('a planning day greets, names the next event, and has nothing waiting on a source it lacks', () => {
    const plan = moment([event('Wedding'), event('Draft', { status: 'draft', phase: 'draft' })]);

    expect(plan).toMatchObject({
      kind: 'plan',
      full: false,
      eyebrow: 'Tuesday 3 November',
      hello: 'Good morning, Folake',
      sub: 'Wedding starts on Friday.',
      needs: null,
      now: null,
    });
    expect(plan.bars.map(({ event: { id }, ...bar }) => [id, bar])).toEqual([
      ['Wedding', { start: 3, span: 3, label: '3 days', openLeft: false }],
    ]);
    expect(
      plan.agenda.map(({ day, when, items }) => [day, when, items.map((item) => item.title)]),
    ).toEqual([
      ['Today', 'Tue 3 Nov', []],
      ['Fri 6 Nov', 'in 3 days', ['Wedding starts']],
      ['Sat 7 Nov', 'in 4 days', ['Wedding continues']],
      ['Sun 8 Nov', 'in 5 days', ['Wedding ends']],
    ]);
    expect(plan.events.map(({ count, stage, draft }) => [count, stage, draft])).toEqual([
      ['In 3 days', 'Final week', false],
      ['Draft', null, true],
    ]);
  });

  it('a milestone on another event’s day is a dot', () => {
    const later = event('Party', {
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
    const plan = moment([later]);

    expect(plan.days.map(({ dots }) => dots.map(({ id }) => id))).toEqual([
      [],
      ['Party'],
      [],
      [],
      [],
      [],
      [],
    ]);
    expect(plan.sub).toBe('Party starts on Sat 28 Nov.');
  });

  it('on the day, the cover is Now', () => {
    const day = moment(
      [event('Wedding', { phase: 'happening_now' })],
      new Date('2026-11-07T16:10:00Z'),
    );

    expect(day.kind).toBe('day');
    expect(day.hello).toBe('Good afternoon, Folake');
    expect(day.now).toMatchObject({
      name: 'Wedding',
      live: 'Day 2 of 3 · The Landmark',
      ends: 'Ends tomorrow, Sun 8 Nov at 14:00',
    });
    expect(day.bars[0]).toMatchObject({ start: 0, span: 2, label: 'day 2 of 3', openLeft: true });
    expect(day.events[0]).toMatchObject({ count: 'Day 2 of 3', live: true, stage: null });
  });

  it('Now ends today on the last day, and on a date two days out', () => {
    const ends = (now: string) =>
      moment([event('Wedding', { phase: 'happening_now' })], new Date(now)).now?.ends;

    expect(ends('2026-11-08T09:00:00Z')).toBe('Ends today at 14:00');
    expect(ends('2026-11-06T20:00:00Z')).toBe('Ends Sun 8 Nov at 14:00');
  });

  it('a quiet week says so and shows what is next', () => {
    const quiet = moment([
      event('Party', {
        startsAt: '2026-11-28T18:00:00Z',
        endsAt: '2026-11-28T23:00:00Z',
        dayCount: 1,
      }),
    ]);

    expect(quiet.kind).toBe('quiet');
    expect(quiet.nextUp).toMatchObject({ name: 'Party', when: 'Sat 28 Nov · in 25 days' });
  });

  it('a first run welcomes', () => {
    expect(moment([])).toMatchObject({
      kind: 'first',
      hello: 'Welcome, Folake',
      sub: 'Your first event starts here.',
      events: [],
    });
  });
});
