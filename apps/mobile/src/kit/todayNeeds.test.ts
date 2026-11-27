import { type Milestone, wallDay } from '@soirely/domain';
import { createInstance } from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import en from '../i18n/locales/en.json';
import { dayWords } from './todayMoment.ts';
import { dueWords, needsOf as needsOfWith, type YouEvent } from './todayNeeds.ts';

const i18n = createInstance();
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const LONDON = 'Europe/London';
const dayIn =
  (locale: string) =>
  (date: string, withYear: boolean): string =>
    dayWords(date, locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });
const day = dayIn('en-US');

const needsOf = (events: YouEvent[], now: Date, day: (date: string, withYear: boolean) => string) =>
  needsOfWith(events, now, day, i18n.t);

function milestone(at: string, overrides: Partial<Milestone> = {}): Milestone {
  return {
    at,
    title: 'Give final numbers to the kitchen',
    note: null,
    owner: 'you',
    area: 'menu',
    action: null,
    ...overrides,
  };
}

function event(name: string, overrides: Partial<YouEvent> = {}): YouEvent {
  return {
    shown: { id: name, name, mesh: 'rose', photo: null },
    startsAt: '2026-12-01T12:00:00Z',
    endsAt: '2026-12-01T20:00:00Z',
    status: 'live',
    timeZone: LONDON,
    permissions: ['menu.read', 'menu.manage'],
    milestones: [milestone('2026-11-20T23:59:00Z')],
    ...overrides,
  };
}

const NOW = new Date('2026-11-10T09:00:00Z');

describe('a Finished event', () => {
  it('gives no row, and a Draft keeps its own', () => {
    const ended = event('Ireti at 40', { status: 'ended', endsAt: '2026-06-10T20:00:00Z' });
    const past = event('Dele', { status: 'live', endsAt: '2026-06-10T20:00:00Z' });
    const draft = event('Tayo', { status: 'draft', endsAt: '2026-06-10T20:00:00Z' });

    expect(needsOf([ended, past, draft], NOW, day).map((need) => need.event.name)).toEqual([
      'Tayo',
    ]);
  });
});

describe('who a row is for', () => {
  it('lists a You milestone for a member holding its area’s manage permission', () => {
    expect(needsOf([event('Ireti at 40')], NOW, day).map(({ title }) => title)).toEqual([
      'Give final numbers to the kitchen',
    ]);
  });

  it('lists nothing for a member holding only its area’s read permission', () => {
    expect(needsOf([event('Ireti at 40', { permissions: ['menu.read'] })], NOW, day)).toEqual([]);
  });

  it('leaves out Automatic and Event milestones', () => {
    const others = [
      milestone('2026-11-12T09:00:00Z', { owner: 'automatic', title: 'Replies close' }),
      milestone('2026-11-13T09:00:00Z', { owner: 'event', title: 'Ireti at 40 starts' }),
    ];

    expect(needsOf([event('Ireti at 40', { milestones: others })], NOW, day)).toEqual([]);
  });

  it('lists an area with no page in the app like any other, with the title it was given', () => {
    const budget = milestone('2026-11-20T23:59:00Z', { area: 'budget', title: 'Pay the band' });
    const rows = needsOf(
      [event('Ireti at 40', { milestones: [budget], permissions: ['budget.manage'] })],
      NOW,
      day,
    );

    expect(rows.map(({ title }) => title)).toEqual(['Pay the band']);
  });

  it('drops a row once its area stops returning it', () => {
    expect(needsOf([event('Ireti at 40', { milestones: [] })], NOW, day)).toEqual([]);
  });
});

describe('the due words', () => {
  const due = (at: string, now: string) => dueWords(at, LONDON, new Date(now), day, i18n.t);

  it('before the moment: today, tomorrow, then the date', () => {
    expect(due('2026-11-10T23:59:00Z', '2026-11-10T09:00:00Z')).toEqual({
      words: 'Due today',
      late: false,
    });
    expect(due('2026-11-11T23:59:00Z', '2026-11-10T09:00:00Z').words).toBe('Due tomorrow');
    expect(due('2026-11-13T23:59:00Z', '2026-11-10T09:00:00Z').words).toBe('Due Fri, Nov 13');
  });

  it('adds the year only when the day is in another year', () => {
    expect(due('2027-01-13T23:59:00Z', '2026-11-10T09:00:00Z').words).toBe('Due Wed, Jan 13, 2027');
  });

  it('takes this year from today in the event’s zone', () => {
    // 01:00 on New Year's Day in Auckland, still noon on the 31st in London.
    const newYear = new Date('2026-12-31T12:00:00Z');

    expect(dueWords('2027-01-04T10:59:00Z', 'Pacific/Auckland', newYear, day, i18n.t).words).toBe(
      'Due Mon, Jan 4',
    );
    expect(dueWords('2027-01-04T23:59:00Z', LONDON, newYear, day, i18n.t).words).toBe(
      'Due Mon, Jan 4, 2027',
    );
  });

  it('writes the date the reader’s way, in one format', () => {
    const written = dueWords(
      '2026-11-13T23:59:00Z',
      LONDON,
      new Date('2026-11-10T09:00:00Z'),
      dayIn('en-GB'),
      i18n.t,
    );

    expect(written.words).toBe('Due Fri 13 Nov');
  });

  it('once passed: Overdue on the due day, then in days', () => {
    expect(due('2026-11-10T23:59:00Z', '2026-11-10T23:59:30Z')).toEqual({
      words: 'Overdue',
      late: true,
    });
    expect(due('2026-11-10T23:59:00Z', '2026-11-11T00:00:30Z')).toEqual({
      words: '1 day overdue',
      late: true,
    });
    expect(due('2026-11-10T23:59:00Z', '2026-11-12T09:00:00Z')).toEqual({
      words: '2 days overdue',
      late: true,
    });
  });
});

describe('a device in another zone than the event', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('counts the days in the event’s zone: an event in Lagos read from Los Angeles across midnight', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const lagos = 'Africa/Lagos';
    const acrossMidnight = new Date('2026-11-12T23:30:00Z');

    expect(acrossMidnight.getDate()).toBe(12);
    expect(wallDay(acrossMidnight, lagos)).toBe('2026-11-13');
    expect(dueWords('2026-11-13T23:59:00+01:00', lagos, acrossMidnight, day, i18n.t).words).toBe(
      'Due today',
    );
  });
});

describe('the order', () => {
  const at = (date: string) => [milestone(`${date}T23:59:00Z`)];

  it('is earliest first, so overdue rows lead', () => {
    const rows = needsOf(
      [
        event('Later', { milestones: at('2026-11-20') }),
        event('Overdue', { milestones: at('2026-11-02') }),
        event('Sooner', { milestones: at('2026-11-12') }),
      ],
      NOW,
      day,
    );

    expect(rows.map((row) => [row.event.name, row.late])).toEqual([
      ['Overdue', true],
      ['Sooner', false],
      ['Later', false],
    ]);
  });

  it('breaks a tie by the event’s start, then its name', () => {
    const rows = needsOf(
      [
        event('Zainab at 30', { startsAt: '2026-12-05T12:00:00Z' }),
        event('Bisi at 50', { startsAt: '2026-12-05T12:00:00Z' }),
        event('Ade at 60', { startsAt: '2026-12-09T12:00:00Z' }),
        event('Tola at 40', { startsAt: '2026-12-01T12:00:00Z' }),
      ],
      NOW,
      day,
    );

    expect(rows.map((row) => row.event.name)).toEqual([
      'Tola at 40',
      'Bisi at 50',
      'Zainab at 30',
      'Ade at 60',
    ]);
  });
});
