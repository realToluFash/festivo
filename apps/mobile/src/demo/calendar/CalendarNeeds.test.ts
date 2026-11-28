import { init } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { emptyMonthLine } from '../../kit/calendar.ts';
import { CLOCKS } from '../events/EventsSample.ts';
import {
  type Item,
  SHOWS,
  agendaOf,
  calendarEvents,
  daysOf,
  heldOn,
  needsLabel,
  needsLanding,
  needsWhen,
  overdueIn,
  sampleOf,
  showWords,
  startOf,
} from './CalendarModel.ts';

beforeAll(() =>
  init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const NOVEMBER = { year: 2026, month: 11 };
const DECEMBER = { year: 2026, month: 12 };
const TODAY = '2026-11-03';
const now = new Date(CLOCKS.reader);
const owner = calendarEvents(sampleOf(null), now, 'owner');
const needs = daysOf(owner, 'needs');

function titles(items: readonly Item[] | undefined): string[] {
  return (items ?? []).map((item) =>
    item.kind === 'event' ? item.event.name : item.milestone.title,
  );
}

function rowOn(day: string, title: string): Item {
  const item = needs
    .get(day)
    ?.find((one) => one.kind === 'milestone' && one.milestone.title === title);
  if (item == null) throw new Error(`No ${title} on ${day}.`);

  return item;
}

describe('Show', () => {
  it('offers Only what needs you last, and opens on Events and milestones', () => {
    expect(SHOWS).toEqual(['all', 'events', 'needs']);
    expect(startOf(null, TODAY).show).toBe('all');
    expect(startOf('needsMonth', TODAY).show).toBe('needs');
  });
});

describe('Only what needs you', () => {
  it('shows only the You milestones whose area the reader changes, on their event’s own day', () => {
    expect([...needs.keys()].sort()).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-09',
      '2026-11-11',
    ]);
    expect(titles(needs.get('2026-11-04'))).toEqual([
      'Confirm the florist',
      'Send the seating plan to the venue',
      'Give final numbers to the kitchen',
      'Seat the last 12 guests',
    ]);
    expect(titles(needs.get('2026-11-09'))).toEqual(['Pay the venue’s deposit']);
  });

  it('leaves out events, Automatic and Event milestones, and a row the reader can only read', () => {
    const every = [...needs.values()].flat();

    expect(every.every((item) => item.kind === 'milestone' && item.milestone.owner === 'you')).toBe(
      true,
    );
    expect(heldOn('evt-gala-4', 'owner')).toContain('seating.read');
    expect(titles(every)).not.toContain('Seat the patrons’ tables');
  });

  it('shows nothing to a reader who can act on nothing', () => {
    const reader = calendarEvents(sampleOf(null), now, 'readOnly');

    expect(daysOf(reader, 'needs').size).toBe(0);
  });

  it('keeps the other two options’ days as they were', () => {
    const plain = calendarEvents(sampleOf(null), now);

    expect(
      [...daysOf(owner, 'events').values()].flat().every((item) => item.kind === 'event'),
    ).toBe(true);
    expect(daysOf(plain, 'all').size).toBeGreaterThan(0);
  });
});

describe('overdue', () => {
  it('marks a passed row on its own day, under this option only', () => {
    const cake = rowOn('2026-11-03', 'Confirm the cake');
    const band = rowOn('2026-11-03', 'Pay the band’s balance');

    expect(overdueIn(cake, 'needs', now)).toBe(true);
    expect(overdueIn(band, 'needs', now)).toBe(false);
    expect(overdueIn(cake, 'all', now)).toBe(false);
    expect(overdueIn(cake, 'events', now)).toBe(false);
  });

  it('says the bare Overdue beside its time, and reads it as its own whole key', () => {
    const cake = rowOn('2026-11-03', 'Confirm the cake');
    const band = rowOn('2026-11-03', 'Pay the band’s balance');

    expect(needsWhen(cake, 'en-GB', now)).toBe('09:00 · Overdue');
    expect(needsWhen(band, 'en-GB', now)).toBe('23:59');
    expect(needsLabel(cake, 'en-GB', now)).toBe(
      'Confirm the cake, Adaeze & Tunde’s wedding, 09:00, overdue',
    );
    expect(needsLabel(band, 'en-GB', now)).toBe(
      'Pay the band’s balance, Adaeze & Tunde’s wedding, 23:59',
    );
  });

  it('names the zone beside the time when it is not the reader’s', () => {
    expect(needsWhen(rowOn('2026-11-09', 'Pay the venue’s deposit'), 'en-GB', now)).toBe(
      '18:00 Europe/Madrid',
    );
  });
});

describe('Agenda under this option', () => {
  it('lists only days holding a row, with no heading for an empty today', () => {
    const empty = calendarEvents(sampleOf(null), now, 'todayEmpty');
    const days = daysOf(empty, 'needs');
    const listed = agendaOf(NOVEMBER, days, TODAY, 'needs', 0)
      .filter((entry) => entry.kind === 'day')
      .map((entry) => entry.day);

    expect(listed).toEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11']);
  });

  it('still lists an empty today under the other two options', () => {
    const listed = agendaOf(NOVEMBER, new Map(), TODAY, 'all', 0).map((entry) => entry.key);

    expect(listed).toContain(TODAY);
  });

  it('says a month with no rows needs nothing, where the empty line shows', () => {
    const entries = agendaOf(DECEMBER, needs, TODAY, 'needs', 0);

    expect(entries.map((entry) => entry.kind)).toEqual(['month', 'empty']);
  });
});

describe('Today in Agenda under this option', () => {
  it('lands on today when it holds a row', () => {
    expect(needsLanding(needs, TODAY)).toBe(TODAY);
  });

  it('else on the next day this month that holds one', () => {
    const empty = daysOf(calendarEvents(sampleOf(null), now, 'todayEmpty'), 'needs');

    expect(needsLanding(empty, TODAY)).toBe('2026-11-04');
  });

  it('else on the month’s last such day, else on its empty line', () => {
    expect(needsLanding(needs, '2026-11-20')).toBe('2026-11-11');
    expect(needsLanding(new Map(), TODAY)).toBe('month-2026-11');
  });
});

describe('the empty lines', () => {
  it('replace the month’s under this option only, and only once loaded', () => {
    expect(
      emptyMonthLine(true, DECEMBER, needs, showWords('needs').emptyMonth, 'December 2026'),
    ).toBe('Nothing needs you in December 2026.');
    expect(
      emptyMonthLine(true, DECEMBER, new Map(), showWords('all').emptyMonth, 'December 2026'),
    ).toBe('Nothing on the calendar in December 2026.');
    expect(
      emptyMonthLine(true, NOVEMBER, needs, showWords('needs').emptyMonth, 'November 2026'),
    ).toBeNull();
    expect(
      emptyMonthLine(false, DECEMBER, needs, showWords('needs').emptyMonth, 'December 2026'),
    ).toBeNull();
  });

  it('say the day’s under this option only', () => {
    expect(showWords('needs').emptyDay).toBe('Nothing needs you on this day.');
    expect(showWords('all').emptyDay).toBe('Nothing on this day.');
  });
});
