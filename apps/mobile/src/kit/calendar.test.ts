import type { ListedEvent } from '@soirely/api-client';
import { calendarDays, shownPhase } from '@soirely/domain';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  agendaMonth,
  agendaOf,
  barLook,
  barWords,
  calEventOf,
  landingIn,
  offRule,
  piecesOf,
  shownIn,
  weekIndexOf,
  weeksAround,
} from './calendar.ts';
import { rowTag } from './eventsList.ts';

const i18n = createInstance();
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const AT = new Date('2026-11-03T09:00:00Z');
const NOVEMBER = { year: 2026, month: 11 };

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

const loaded = (one: ListedEvent, now = AT) => calEventOf(one, shownPhase(one, AT, now));

describe('an event on the Calendar', () => {
  it('takes the phase Events shows once its start has passed since the load', () => {
    const later = new Date('2026-11-06T20:00:00Z');
    const shown = loaded(event('Ada & Tunde'), later);

    expect(shown.phase).toBe('happening_now');
    expect(offRule(shown, i18n.t)).toBeNull();
    expect(barWords(shown, true, 3, i18n.t)).toBe('Ada & Tunde');
  });

  it('marks a finished one as Events does, and sinks it', () => {
    const after = new Date('2026-11-08T15:00:00Z');
    const shown = loaded(event('Ada & Tunde'), after);

    expect(shown.phase).toBe('finished');
    expect(offRule(shown, i18n.t)).toEqual(rowTag(shown, true, i18n.t));
    expect(barLook(shown)).toBe('sunk');
  });

  it('says Paused on a paused one, with the tag Events gives it', () => {
    const shown = loaded(
      event('Gala', { status: 'paused', phase: 'paused', pausedAt: '2026-11-01T00:00:00Z' }),
    );

    expect(offRule(shown, i18n.t)).toEqual({ kind: 'paused', word: 'Paused' });
    expect(barLook(shown)).toBe('tint');
    expect(barWords(shown, true, 3, i18n.t)).toContain('Paused');
  });

  it('says Called off on a called-off one, and sinks it', () => {
    const shown = loaded(
      event('Offsite', {
        status: 'ended',
        phase: 'finished',
        concludedAt: '2026-11-02T10:00:00Z',
      }),
    );

    expect(shown.calledOff).toBe(true);
    expect(offRule(shown, i18n.t)).toEqual({ kind: 'ended', word: 'Called off' });
    expect(barLook(shown)).toBe('sunk');
  });

  it('leads with the word on a phone bar of two days, and keeps a one-day bar to its name', () => {
    const shown = loaded(event('Draft', { status: 'draft', phase: 'draft', madeLiveAt: null }));

    expect(barWords(shown, false, 2, i18n.t)).toMatch(/^Draft/);
    expect(barWords(shown, false, 1, i18n.t)).toBe('Draft');
  });
});

describe('the weeks', () => {
  const days = calendarDays([loaded(event('Ada & Tunde'))], 'all');
  const weeks = weeksAround(NOVEMBER, 1, days);

  it('run on one after another with no week twice, each starting on the first day', () => {
    const starts = weeks.map((week) => week.start);

    expect(new Set(starts).size).toBe(starts.length);
    expect(starts.every((start) => new Date(`${start}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
  });

  it('draw a three-day event as one bar in one lane', () => {
    const week = weeks[weekIndexOf(weeks, '2026-11-06')];
    if (week == null) throw new Error('No week holds Nov 6.');
    const bars = piecesOf(week, 3).filter((piece) => piece.kind === 'bar');

    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ lane: 0, first: true, last: true });
  });

  it('count what a day has no room for as more', () => {
    const week = weeks[weekIndexOf(weeks, '2026-11-06')];
    const cell = week?.cells.find((each) => each.day === '2026-11-06');
    if (cell == null) throw new Error('No cell for Nov 6.');

    expect(shownIn(cell, 0).more).toBe(cell.items.length);
  });
});

describe('Agenda', () => {
  const days = calendarDays([loaded(event('Ada & Tunde'))], 'all');

  it('lists today even with nothing on it, under its month', () => {
    const entries = agendaOf(NOVEMBER, days, '2026-11-03');

    expect(entries.some((entry) => entry.kind === 'day' && entry.day === '2026-11-03')).toBe(true);
  });

  it('steps to the nearest month with days in it, and lands on the month asked for', () => {
    const entries = agendaOf(NOVEMBER, days, '2026-11-03');

    expect(agendaMonth(entries, { year: 2026, month: 9 }, 1)).toEqual(NOVEMBER);
    expect(agendaMonth(entries, NOVEMBER, 1)).toBeNull();
    expect(landingIn(entries, '2026-10-01', '2026-11-03')).toBe('month-2026-11');
  });
});
