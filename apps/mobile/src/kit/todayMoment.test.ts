import type { EventGuestFigures, ListedEvent } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { followNumberLocales, followPluralLocales } from '@soirely/domain';
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
    arrivalNote: null,
    hosts: [],
    thankYou: null,
    madeLiveAt: '2026-10-01T00:00:00Z',
    pausedAt: null,
    concludedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    permissions: [],
    milestones: [],
    ...rest,
  };
}

const moment = (events: ListedEvent[], now = NOW) =>
  todayMoment({ events, at: AT }, now, LONDON, 'Folake', i18n.t);

describe('todayMoment', () => {
  it('a planning day greets, names the next event, and shows the tick once the events have loaded', () => {
    const plan = moment([event('Wedding'), event('Draft', { status: 'draft', phase: 'draft' })]);

    expect(plan).toMatchObject({
      kind: 'plan',
      full: false,
      eyebrow: 'Tuesday 3 November',
      hello: 'Good morning, Folake',
      sub: 'Wedding starts on Friday.',
      needs: [],
      lead: null,
      now: null,
    });
    expect(plan.bars.map(({ event: { id }, ...bar }) => [id, bar])).toEqual([
      ['Wedding', { start: 3, span: 3, label: '3 days', openLeft: false, lane: 0 }],
    ]);
    expect(
      plan.agenda.map(({ day, when, items }) => [day, when, items.map((item) => item.title)]),
    ).toEqual([
      ['Today', 'Tue 3 Nov', []],
      ['Fri 6 Nov', 'in 3 days', ['Wedding starts']],
      ['Sat 7 Nov', 'in 4 days', ['Wedding continues']],
      ['Sun 8 Nov', 'in 5 days', ['Wedding ends']],
    ]);
    expect(plan.agenda.flatMap(({ items }) => items.map(({ allDay }) => allDay))).toEqual([
      false,
      true,
      false,
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
          done: false,
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

  it('an event day outside this year carries its year: when Now ends, when it starts, and what is next', () => {
    const long = event('Long run', {
      phase: 'happening_now',
      startsAt: '2026-10-31T10:00:00Z',
      endsAt: '2028-04-29T16:00:00Z',
      dayCount: 547,
    });
    const nextYear = event('New year', {
      startsAt: '2027-02-13T18:00:00Z',
      endsAt: '2027-02-13T23:00:00Z',
      dayCount: 1,
    });

    expect(moment([long]).now?.ends).toBe('Ends Sat, 29 Apr 2028 at 17:00');
    expect(moment([nextYear])).toMatchObject({
      sub: 'New year starts on Sat, 13 Feb 2027.',
      nextUp: { name: 'New year', when: 'Sat, 13 Feb 2027 · in 102 days' },
    });
  });

  it("takes this year from today in the event's zone, not the reader's", () => {
    const newYearsEve = new Date('2026-12-31T12:00:00Z');
    const auckland = { timeZone: 'Pacific/Auckland', venue: null };
    const summer = event('Summer', {
      ...auckland,
      phase: 'happening_now',
      startsAt: '2026-12-30T20:00:00Z',
      endsAt: '2027-01-04T05:00:00Z',
      dayCount: 6,
    });
    const picnic = event('Picnic', {
      ...auckland,
      startsAt: '2027-01-08T23:00:00Z',
      endsAt: '2027-01-09T04:00:00Z',
      dayCount: 1,
    });

    expect(moment([summer], newYearsEve).now?.ends).toBe('Ends Mon 4 Jan at 18:00');
    expect(moment([picnic], newYearsEve)).toMatchObject({
      sub: 'Picnic starts on Sat 9 Jan.',
      nextUp: { when: 'Sat 9 Jan · in 9 days' },
    });
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
  it('an event later today that has not started counts Today, is not live, and the line under the greeting says when it starts', () => {
    const tonight = event('Tonight', {
      startsAt: '2026-11-03T19:00:00Z',
      endsAt: '2026-11-03T23:00:00Z',
      dayCount: 1,
    });
    const plan = moment([tonight]);

    expect(plan).toMatchObject({ kind: 'plan', now: null, sub: 'Tonight starts today at 19:00.' });
    expect(plan.events[0]).toMatchObject({ count: 'Today', live: false, stage: null });
    expect(moment([event('Wedding'), tonight]).sub).toBe('Tonight starts today at 19:00.');
  });

  it('a draft dated today is a draft, never live', () => {
    const draft = event('Draft', {
      status: 'draft',
      phase: 'draft',
      startsAt: '2026-11-03T08:00:00Z',
      endsAt: '2026-11-03T23:00:00Z',
      dayCount: 1,
    });

    expect(moment([draft]).events[0]).toMatchObject({ count: 'Draft', draft: true, live: false });
  });
});

describe("Your events' replies line (sc-29881)", () => {
  const wedding = { invited: 142, coming: 96, notReplied: 25, attended: 0, expected: 0 };
  const read = (guests: EventGuestFigures | null, rest: Partial<ListedEvent> = {}) =>
    moment([event('Wedding', { guests, ...rest })]).events[0]?.ready;

  it('reads coming and the share replied, as Events counts them, over a bar in the same share', () => {
    expect(read(wedding)).toEqual({
      words: '96 coming · 82% replied',
      spoken: '96 coming, 82% replied',
      percent: 82,
      track: true,
    });
  });

  it('keeps the empty bar for an event invited with no replies yet', () => {
    expect(read({ invited: 40, coming: 0, notReplied: 40, attended: 0, expected: 0 })).toEqual({
      words: '0 coming · 0% replied',
      spoken: '0 coming, 0% replied',
      percent: 0,
      track: true,
    });
  });

  it('reads Invitations not sent, with no bar, when nobody is invited', () => {
    expect(read({ invited: 0, coming: 0, notReplied: 0, attended: 0, expected: 0 })).toEqual({
      words: 'Invitations not sent',
      percent: 0,
    });
  });

  it('shows nothing on a draft, without guests.read, or without figures', () => {
    expect(read(wedding, { status: 'draft', phase: 'draft' })).toBeNull();
    expect(read(null)).toBeNull();
    expect(moment([event('Wedding')]).events[0]?.ready).toBeNull();
  });

  it('shows on an event under way as before it', () => {
    const under = event('Wedding', {
      guests: wedding,
      phase: 'happening_now',
      startsAt: '2026-11-02T10:00:00Z',
    });

    expect(moment([under]).events[0]).toMatchObject({
      live: true,
      ready: { words: '96 coming · 82% replied' },
    });
  });

  it('writes its numbers in the reader’s locale', async () => {
    const french = createInstance();
    await french.init({
      resources: { fr: { translation: en } },
      lng: 'fr',
      interpolation: { escapeValue: false },
    });
    followPluralLocales(french.services.pluralResolver);
    followNumberLocales(french.services.formatter!);
    const guests = { invited: 1400, coming: 1204, notReplied: 126, attended: 0, expected: 0 };

    const ready = todayMoment(
      { events: [event('Mariage', { guests })], at: AT },
      NOW,
      { timeZone: 'Europe/Paris', locale: 'fr-FR' },
      'Folake',
      french.t,
    ).events[0]?.ready;

    expect(ready?.words).toBe('1 204 coming · 91 % replied');
  });
});

describe("Today's arrived figure (sc-29978)", () => {
  const coming = { invited: 160, coming: 152, notReplied: 4 };
  const under = (guests: EventGuestFigures | null) =>
    event('Wedding', { guests, phase: 'happening_now', startsAt: '2026-11-02T10:00:00Z' });
  const day = (guests: EventGuestFigures | null) => moment([under(guests)]);

  it('reads arrived of expected on the card, its bar rounded down, and the same on Now beside a ring', () => {
    const read = day({ ...coming, attended: 141, expected: 152 });

    expect(read.events[0]?.ready).toEqual({
      words: '141 of 152 arrived',
      percent: 92,
      track: true,
    });
    expect(read.now?.arrived).toEqual({
      count: '141',
      of: '152',
      share: 141 / 152,
      label: 'arrived',
      spoken: '141 of 152 arrived',
    });
  });

  it('with nobody Coming, reads the arrivals alone: no bar and no ring', () => {
    const read = day({ invited: 0, coming: 0, notReplied: 0, attended: 37, expected: 37 });

    expect(read.events[0]?.ready).toEqual({ words: '37 arrived', percent: 0 });
    expect(read.now?.arrived).toMatchObject({ count: '37', of: null, share: null });
  });

  it('keeps the replies line and no figure while nobody has arrived', () => {
    const read = day({ ...coming, attended: 0, expected: 152 });

    expect(read.events[0]?.ready?.words).toBe('152 coming · 98% replied');
    expect(read.now?.arrived).toBeNull();
  });

  it('shows no arrivals without guests.read', () => {
    const read = day(null);

    expect(read.events[0]?.ready).toBeNull();
    expect(read.now?.arrived).toBeNull();
  });

  it('writes four-digit figures in the reader’s language', async () => {
    const french = createInstance();
    await french.init({
      resources: { fr: { translation: en } },
      lng: 'fr',
      interpolation: { escapeValue: false },
    });
    followPluralLocales(french.services.pluralResolver);
    followNumberLocales(french.services.formatter!);
    const guests = { invited: 1300, coming: 1250, notReplied: 0, attended: 1204, expected: 1250 };

    const read = todayMoment(
      { events: [under(guests)], at: AT },
      NOW,
      { timeZone: 'Europe/Paris', locale: 'fr-FR' },
      'Folake',
      french.t,
    );

    expect(read.events[0]?.ready?.words).toBe('1\u202f204 of 1\u202f250 arrived');
    expect(read.now?.arrived).toMatchObject({ count: '1\u202f204', of: '1\u202f250' });
  });
});

describe('todayMoment Needs you (sc-29884)', () => {
  const owed = (at: string, rest: Partial<ListedEvent['milestones'][number]> = {}) => ({
    at,
    title: 'Give final numbers to the kitchen',
    note: null,
    owner: 'you' as const,
    area: 'menu',
    action: null,
    ...rest,
  });

  it('lists a You milestone for a member who manages its area, and not for one who only reads', () => {
    const milestones = [owed('2026-11-05T23:59:00Z')];
    const manages = moment([event('Wedding', { permissions: ['menu.manage'], milestones })]);
    const reads = moment([event('Wedding', { permissions: ['menu.read'], milestones })]);

    expect(manages.needs?.map(({ title, due }) => [title, due])).toEqual([
      ['Give final numbers to the kitchen', 'Due Thu 5 Nov'],
    ]);
    expect(manages.lead).toBe('1 thing needs you.');
    expect(reads.needs).toEqual([]);
    expect(reads.lead).toBeNull();
  });

  it('leaves Automatic and Event milestones out', () => {
    const milestones = [
      owed('2026-11-05T23:59:00Z', { owner: 'automatic' }),
      owed('2026-11-05T23:59:00Z', { owner: 'event' }),
    ];

    expect(moment([event('Wedding', { permissions: ['menu.manage'], milestones })]).needs).toEqual(
      [],
    );
  });

  it('says overdue in days, earliest first, and counts every row', () => {
    const milestones = [
      owed('2026-11-04T23:59:00Z', { title: 'B' }),
      owed('2026-11-01T23:59:00Z', { title: 'A' }),
    ];
    const shown = moment([event('Wedding', { permissions: ['menu.manage'], milestones })]);

    expect(shown.needs?.map(({ title, due, late }) => [title, due, late])).toEqual([
      ['A', '2 days overdue', true],
      ['B', 'Due tomorrow', false],
    ]);
    expect(shown.lead).toBe('2 things need you.');
  });

  it('writes the year only when the due day is in another year', () => {
    const milestones = [owed('2027-01-13T23:59:00Z')];
    const shown = moment([event('Wedding', { permissions: ['menu.manage'], milestones })]);

    expect(shown.needs?.[0]?.due).toBe('Due Wed, 13 Jan 2027');
  });

  it('has no Needs you on a first run', () => {
    const first = moment([]);

    expect(first.kind).toBe('first');
    expect(first.needs).toBeNull();
    expect(first.lead).toBeNull();
  });
});
