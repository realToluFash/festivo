import { firstDayOfWeek, weekdayNames } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { CLOCKS, REUNION, meshFor } from '../events/EventsSample.ts';
import {
  type Item,
  PHONE_WEEK,
  WIDE_WEEK,
  agendaMonth,
  agendaOf,
  barWords,
  calendarEvents,
  calendarStateOf,
  dayHeading,
  dayLabel,
  daysOf,
  emptyMonth,
  firstNamed,
  itemHref,
  pinnedOf,
  piecesOf,
  rowWhen,
  sampleOf,
  shownIn,
  startOf,
  weekHeight,
  weekIndexOf,
  weeksAround,
} from './CalendarModel.ts';

const NOVEMBER = { year: 2026, month: 11 };
const now = new Date(CLOCKS.reader);
const events = calendarEvents(sampleOf(null), now);
const all = daysOf(events, 'all');
const sunday = weeksAround(NOVEMBER, 0, all);

function title(item: Item | null): string | null {
  if (item == null) return null;

  return item.kind === 'event' ? item.event.name : item.milestone.title;
}

function weekOf(day: string) {
  const week = sunday[weekIndexOf(sunday, day)];
  if (week == null) throw new Error(`No week holds ${day}.`);

  return week;
}

function cellOf(day: string) {
  const cell = weekOf(day).cells.find((one) => one.day === day);
  if (cell == null) throw new Error(`No cell for ${day}.`);

  return cell;
}

describe('the weeks', () => {
  it('start on the locale’s first day, as CLDR has it', () => {
    expect(firstDayOfWeek('en-US')).toBe(0);
    for (const locale of ['en-GB', 'es', 'fr']) expect(firstDayOfWeek(locale)).toBe(1);
    expect(weekdayNames('en-GB', firstDayOfWeek('en-GB'), 'narrow')).toEqual([
      'M',
      'T',
      'W',
      'T',
      'F',
      'S',
      'S',
    ]);

    const monday = weeksAround(NOVEMBER, 1, all);
    expect(weekOf('2026-11-03').start).toBe('2026-11-01');
    expect(monday[weekIndexOf(monday, '2026-11-03')]?.start).toBe('2026-11-02');
  });

  it('run on one after another, two years each way, with no week twice', () => {
    const starts = sunday.map((week) => week.start);

    expect(new Set(starts).size).toBe(starts.length);
    expect(starts[0]! <= '2024-11-01').toBe(true);
    expect(starts[starts.length - 1]! >= '2028-11-24').toBe(true);
    for (const [index, week] of sunday.entries())
      if (index > 0)
        expect(Date.parse(week.start) - Date.parse(sunday[index - 1]!.start)).toBe(604800000);
  });

  it('pin the month of the top week’s last day', () => {
    expect(pinnedOf(weekOf('2026-11-29'), NOVEMBER)).toEqual({ year: 2026, month: 12 });
    expect(pinnedOf(weekOf('2027-01-31'), NOVEMBER)).toEqual({ year: 2027, month: 2 });
    expect(emptyMonth({ year: 2027, month: 2 }, all)).toBe(true);
    expect(emptyMonth(NOVEMBER, all)).toBe(false);
  });
});

describe('the lanes', () => {
  it('keep Ireti at 40 in its lane under the offsite’s, and count the rest as more', () => {
    const { shown, more } = shownIn(cellOf('2026-11-14'), PHONE_WEEK.fit);

    expect(shown.map(title)).toEqual([null, 'Ireti at 40', 'Gala Fundación Lucía']);
    expect(more).toBe(2);
    expect(cellOf('2026-11-14').items.map(title)).toEqual([
      'Ireti at 40',
      'Gala Fundación Lucía',
      'Ireti at 40 ends',
      'Gala Fundación Lucía starts',
    ]);
  });

  it('shows the two bars and nothing more with Events only', () => {
    const only = weeksAround(NOVEMBER, 0, daysOf(events, 'events'));
    const cell = only[weekIndexOf(only, '2026-11-14')]?.cells[6];

    expect(cell == null ? null : shownIn(cell, PHONE_WEEK.fit)).toMatchObject({ more: 0 });
    expect(cell?.slots.filter((slot) => slot != null).map(title)).toEqual([
      'Ireti at 40',
      'Gala Fundación Lucía',
    ]);
  });

  it('draws each bar once across its days, in one lane', () => {
    const bars = piecesOf(weekOf('2026-11-08'), PHONE_WEEK.fit).flatMap((piece) =>
      piece.kind === 'bar' ? [[piece.event.id, piece.lane, piece.from, piece.to]] : [],
    );

    expect(bars).toEqual([
      ['evt-off', 0, 4, 5],
      ['evt-ireti-2', 1, 5, 6],
      ['evt-gala-4', 2, 6, 6],
    ]);
  });

  it('makes each week as tall as its busiest day', () => {
    expect(weekHeight(weekOf('2026-11-01'), PHONE_WEEK)).toBe(4 + 24 + 3 + 2 * 21 + 6);
    expect(weekHeight(weekOf('2026-11-08'), PHONE_WEEK)).toBe(4 + 24 + 3 + 3 * 21 + 17 + 6);
    expect(weekHeight(weekOf('2026-11-15'), PHONE_WEEK)).toBe(52);
    expect(weekHeight(weekOf('2026-11-15'), WIDE_WEEK)).toBe(72);
  });
});

describe('each date on its event’s own day', () => {
  it('puts the quinceañera on Sat, Oct 10, though it is Oct 11 in London', () => {
    expect(cellOf('2026-10-10').items.map(title)).toEqual([
      'Lucía’s quinceañera',
      'Lucía’s quinceañera starts',
    ]);
    expect(cellOf('2026-10-11').items).toEqual([]);
  });

  it('gives the offsite only its called-off moment, and a one-day event only its start', () => {
    expect(cellOf('2026-10-30').items.map(title)).toEqual(['Team offsite called off']);
    expect(cellOf('2026-11-12').items.map(title)).toEqual(['Team offsite']);
    expect(cellOf('2026-12-03').items.map(title)).toEqual([
      'Ire Events end-of-year party',
      'Ire Events end-of-year party starts',
    ]);
  });

  it('names the zone only when it is not the reader’s, and the days of a multi-day event', () => {
    const [ireti, gala] = cellOf('2026-11-14').items;

    expect(ireti == null ? null : rowWhen(ireti, 'en-US')).toBe(
      '19:00 · Fri, Nov 13 to Sat, Nov 14',
    );
    expect(gala == null ? null : rowWhen(gala, 'en-US')).toBe('19:30 Europe/Madrid');
  });
});

describe('the month’s edge', () => {
  it('carries the reunion from Sat, Nov 28 into the next week, in teal', () => {
    expect(meshFor(REUNION.id)).toBe('teal');

    const edge = daysOf(calendarEvents(sampleOf('monthEdge'), now), 'all');
    const weeks = weeksAround(NOVEMBER, 0, edge);
    const bars = (day: string) =>
      piecesOf(weeks[weekIndexOf(weeks, day)]!, PHONE_WEEK.fit).flatMap((piece) =>
        piece.kind === 'bar' && piece.event.id === REUNION.id
          ? [[piece.from, piece.to, piece.first, piece.last]]
          : [],
      );

    expect(bars('2026-11-28')).toEqual([[6, 6, true, false]]);
    expect(bars('2026-11-29')).toEqual([[0, 2, false, true]]);
    expect(sampleOf(null).some((event) => event.id === REUNION.id)).toBe(false);
  });
});

describe('the words', () => {
  const offsite = events.find((event) => event.id === 'evt-off')!;
  const party = events.find((event) => event.id === 'evt-party-2')!;

  it('lead with the word on a phone bar that holds two days, and follow the name on a wide one', () => {
    expect(barWords(offsite, false, 2)).toBe('Called off · Team offsite');
    expect(barWords(party, false, 1)).toBe('Ire Events end-of-year party');
    expect(barWords(offsite, true, 2)).toBe('Team offsite · Called off');
    expect(barWords(events[0]!, true, 3)).toBe('Adaeze & Tunde’s wedding');
  });

  it('label each day as main does', () => {
    expect(dayLabel('2026-11-05', '2026-11-03', 2, 'en-US')).toBe('Thursday, November 5, 2 items');
    expect(dayLabel('2026-11-03', '2026-11-03', 0, 'en-US')).toBe('Today, Tuesday, November 3');
    expect(dayHeading('2026-11-14', '2026-11-03', 'en-US')).toBe('Saturday, Nov 14');
    expect(firstNamed('2026-12-01', 'en-US')).toBe('Dec 1');
    expect(firstNamed('2026-12-01', 'en-GB')).toBe('1 Dec');
  });

  it('opens an event’s page, and a milestone its event’s dates', () => {
    const [ireti, , iretiEnds] = cellOf('2026-11-14').items;

    expect(ireti == null ? null : itemHref(ireti)).toBe('/demo/events/evt-ireti-2');
    expect(iretiEnds == null ? null : itemHref(iretiEnds)).toBe(
      '/demo/events/evt-ireti-2?area=schedule',
    );
  });
});

describe('Agenda', () => {
  const entries = agendaOf(NOVEMBER, all, '2026-11-03');

  it('lists today even with nothing on it, under its month', () => {
    const at = entries.findIndex((entry) => entry.kind === 'day' && entry.day === '2026-11-03');

    expect(entries[at - 1]).toMatchObject({ kind: 'month', month: NOVEMBER });
    expect(entries[at]).toMatchObject({ items: [] });
  });

  it('moves to the nearest month with days in it', () => {
    expect(agendaMonth(entries, NOVEMBER, 1)).toEqual({ year: 2026, month: 12 });
    expect(agendaMonth(entries, { year: 2027, month: 1 }, 1)).toBeNull();
    expect(agendaMonth(entries, NOVEMBER, -1)).toEqual({ year: 2026, month: 10 });
  });
});

describe('the states', () => {
  it('opens each by name, and a name it does not know with no state', () => {
    expect(calendarStateOf('busyDay')).toBe('busyDay');
    expect(calendarStateOf('nope')).toBeNull();
    expect(startOf('busyDay', '2026-11-03')).toMatchObject({ view: 'month', open: '2026-11-14' });
    expect(startOf('otherZone', '2026-11-03')).toMatchObject({
      at: '2026-10-04',
      open: '2026-10-10',
    });
    expect(startOf(null, '2026-11-03')).toMatchObject({ view: null, at: null, show: 'all' });
    expect(sampleOf('none')).toEqual([]);
  });
});
