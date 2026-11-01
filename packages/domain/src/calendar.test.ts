import { describe, expect, it } from 'vitest';

import {
  agendaDays,
  calendarDays,
  type CalendarEvent,
  cellShown,
  firstDayOfWeek,
  keptCalendarPlace,
  monthGrid,
  namesBar,
  readCalendarPlace,
  shiftMonth,
  wallDay,
  weekdayNames,
} from './calendar.ts';
import type { Milestone } from './timeline.ts';

function milestone(at: string, title: string): Milestone {
  return { at, title, note: null, owner: 'event', area: 'events', action: null };
}

function event(
  id: string,
  startsAt: string,
  timeZone: string,
  dayCount = 1,
  milestones: Milestone[] = [],
): CalendarEvent {
  return { id, startsAt, timeZone, dayCount, milestones };
}

const NOVEMBER = { year: 2026, month: 11 };

describe('Placing dates', () => {
  it("puts a date on the event's own calendar day, not the reader's", () => {
    const lagos = event('lagos', '2026-11-14T22:00:00Z', 'Africa/Lagos');

    expect(wallDay(lagos.startsAt, 'Europe/Istanbul')).toBe('2026-11-15');
    expect([...calendarDays([lagos], 'all').keys()]).toEqual(['2026-11-14']);
  });

  it('lists a multi-day event on each of its days, across the end of a month', () => {
    const wedding = event('wedding', '2026-11-28T15:00:00+01:00', 'Europe/Paris', 4);
    const days = calendarDays([wedding], 'all');

    expect([...days.keys()]).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
    expect(days.get('2026-11-28')?.[0]).toMatchObject({ first: true, last: false });
    expect(days.get('2026-12-01')?.[0]).toMatchObject({ first: false, last: true });
    expect(agendaDays(NOVEMBER, days).map(({ day }) => day)).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
    ]);
    expect(agendaDays({ year: 2026, month: 12 }, days).map(({ day }) => day)).toEqual([
      '2026-12-01',
    ]);
  });

  it("puts a milestone on its event's day, and leaves it out under Events only", () => {
    const dinner = event('dinner', '2026-11-20T19:00:00+01:00', 'Europe/Lisbon', 1, [
      milestone('2026-11-10T23:30:00+00:00', 'Send numbers to the kitchen'),
    ]);

    expect([...calendarDays([dinner], 'all').keys()]).toEqual(['2026-11-20', '2026-11-10']);
    expect([...calendarDays([dinner], 'events').keys()]).toEqual(['2026-11-20']);
  });

  it('orders a day: multi-day events, then single-day events by start, then milestones by time', () => {
    const late = event('late', '2026-11-14T20:00:00Z', 'UTC');
    const early = event('early', '2026-11-14T09:00:00Z', 'UTC', 1, [
      milestone('2026-11-14T08:00:00Z', 'Doors'),
    ]);
    const long = event('long', '2026-11-13T09:00:00Z', 'UTC', 3);
    const items = calendarDays([late, early, long], 'all').get('2026-11-14') ?? [];

    expect(
      items.map((item) => (item.kind === 'event' ? item.event.id : item.milestone.title)),
    ).toEqual(['long', 'early', 'late', 'Doors']);
  });
});

describe('The month grid', () => {
  it('starts each week on the given first day and covers the whole month', () => {
    const monday = monthGrid(NOVEMBER, 1, new Map());
    const sunday = monthGrid(NOVEMBER, 0, new Map());

    expect(monday[0]?.[0]?.day).toBe('2026-10-26');
    expect(monday.at(-1)?.at(-1)?.day).toBe('2026-12-06');
    expect(sunday[0]?.[0]?.day).toBe('2026-11-01');
    expect(sunday.at(-1)?.at(-1)?.day).toBe('2026-12-05');
    expect(monday[0]?.[0]?.inMonth).toBe(false);
  });

  it('keeps a multi-day event in one lane across its week', () => {
    const one = event('one', '2026-11-02T09:00:00Z', 'UTC', 2);
    const two = event('two', '2026-11-03T09:00:00Z', 'UTC', 2);
    const week = monthGrid(NOVEMBER, 1, calendarDays([one, two], 'all'))[1] ?? [];
    const lane = (day: number, id: string) =>
      week[day]?.slots.findIndex((slot) => slot?.kind === 'event' && slot.event.id === id);

    expect(lane(1, 'two')).toBe(1);
    expect(lane(2, 'two')).toBe(1);
    expect(week[2]?.slots[0]).toBeNull();
  });

  it('shows what fits and counts the rest as more', () => {
    const events = ['a', 'b', 'c', 'd'].map((id) => event(id, '2026-11-14T09:00:00Z', 'UTC'));
    const cell = monthGrid(NOVEMBER, 1, calendarDays(events, 'all'))
      .flat()
      .find(({ day }) => day === '2026-11-14');

    expect(cell == null ? null : cellShown(cell, 2).more).toBe(2);
    expect(cell == null ? null : cellShown(cell, 4).more).toBe(0);
  });

  it('names a bar on its first day and where it enters a new week', () => {
    expect(namesBar('2026-11-30', false, 1)).toBe(true);
    expect(namesBar('2026-12-01', false, 1)).toBe(false);
    expect(namesBar('2026-11-28', true, 1)).toBe(true);
  });
});

describe('The week', () => {
  it("starts on the locale's first day, as CLDR has it", () => {
    expect(firstDayOfWeek('en-US')).toBe(0);
    expect(firstDayOfWeek('en-GB')).toBe(1);
    expect(firstDayOfWeek('fr')).toBe(1);
    expect(firstDayOfWeek('pt-BR')).toBe(0);
  });

  it('names its days from that first day', () => {
    expect(weekdayNames('en', 1, 'short')[0]).toBe('Mon');
    expect(weekdayNames('en', 0, 'short')[0]).toBe('Sun');
  });
});

describe('The kept place', () => {
  it('reads back what it kept, and nothing from anything else', () => {
    const place = { view: 'agenda' as const, month: { year: 2027, month: 1 } };

    expect(readCalendarPlace(keptCalendarPlace(place))).toEqual(place);
    expect(readCalendarPlace('{"view":"week","month":"2027-01"}')).toBeNull();
    expect(readCalendarPlace('not json')).toBeNull();
    expect(readCalendarPlace(null)).toBeNull();
  });

  it('moves a month across the turn of a year', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});
