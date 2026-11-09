import { calendarDays, firstDayOfWeek, keptCalendarPlace, wallDay } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import {
  type Bar,
  type Item,
  type Listed,
  type Week,
  CAL_WORDS,
  SHOWS,
  TODAY,
  agendaOf,
  agendaStop,
  barLabel,
  barWords,
  calendarStart,
  calendarStateOf,
  dayCountOf,
  dayLabel,
  eased,
  fitted,
  itemLink,
  listedOf,
  markLabel,
  milestonesOf,
  movedDay,
  pinnedOf,
  rowLine,
  topsOf,
  weekStart,
  weeksOf,
} from './calendar.ts';
import {
  daysFor,
  isOverdue,
  needsDays,
  needsLabel,
  needsLanding,
  seeded,
} from './calendarNeeds.ts';
import { CLOCKS, REUNION, sampleEvent, sampleEvents } from './events.ts';
import { meshFor } from '../mesh.ts';

const EN = 'en-US';
const NOVEMBER = { year: 2026, month: 11 };
const listed = listedOf(sampleEvents(), CLOCKS.rest);
const all = calendarDays(listed, 'all');

function weekHolding(weeks: readonly Week[], day: string): Week {
  const week = weeks.find((one) => one.days.some((cell) => cell.day === day));

  if (week == null) throw new Error(`No week holds ${day}`);

  return week;
}

function barOf(week: Week, id: string): Bar {
  const bar = week.pieces.find(
    (piece): piece is Bar => piece.kind === 'bar' && piece.item.event.id === id,
  );

  if (bar == null) throw new Error(`No bar for ${id}`);

  return bar;
}

describe('the Calendar in B · A · Weeks as lanes (sc-30329)', () => {
  it('starts each week on the locale’s first day, as CLDR has it', () => {
    expect(firstDayOfWeek('en-US')).toBe(0);
    expect(weekStart('2026-11-03', firstDayOfWeek('en-US'))).toBe('2026-11-01');

    for (const locale of ['en-GB', 'es', 'fr']) {
      expect(firstDayOfWeek(locale)).toBe(1);
      expect(weekStart('2026-11-03', firstDayOfWeek(locale))).toBe('2026-11-02');
    }

    expect(firstDayOfWeek('pt-PT')).toBe(0);
    expect(firstDayOfWeek('pt-BR')).toBe(0);

    expect(weeksOf(NOVEMBER, NOVEMBER, 0, all)[0]?.start).toBe('2026-11-01');
    expect(weeksOf(NOVEMBER, NOVEMBER, 1, all)[0]?.start).toBe('2026-10-26');
  });

  it('runs the months as one scroll, each week once', () => {
    const weeks = weeksOf({ year: 2026, month: 10 }, { year: 2026, month: 12 }, 0, all);
    const starts = weeks.map((week) => week.start);

    expect(new Set(starts).size).toBe(starts.length);
    expect(starts[0]).toBe('2026-09-27');
    expect(starts).toContain('2026-11-01');
    expect(starts.at(-1)).toBe('2026-12-27');
  });

  it('keeps each bar in its lane across the week, and counts the rest as more', () => {
    const week = weekHolding(weeksOf(NOVEMBER, NOVEMBER, 0, all), '2026-11-14');
    const saturday = week.days[6];

    expect(barOf(week, 'evt-off')).toMatchObject({ row: 0, from: 4, span: 2 });
    expect(barOf(week, 'evt-ireti-2')).toMatchObject({ row: 1, from: 5, span: 2 });
    expect(barOf(week, 'evt-gala-4')).toMatchObject({ row: 2, from: 6, span: 1 });
    expect(saturday).toMatchObject({ day: '2026-11-14', count: 4, more: 2 });
    expect(saturday?.keys).toEqual(['event|evt-ireti-2', 'event|evt-gala-4']);
    expect(CAL_WORDS.more(2)).toBe('+2 more');
    expect(week.height).toBe(141);
  });

  it('draws the lanes without re-packing a day that is over', () => {
    const saturday = all.get('2026-11-14') ?? [];
    const shown = fitted({
      day: '2026-11-14',
      inMonth: true,
      slots: [null, ...saturday],
      items: saturday,
    });

    expect(shown.slots[0]).toBeNull();
    expect(shown.slots[1]?.kind === 'event' && shown.slots[1].event.id).toBe('evt-ireti-2');
    expect(shown.slots).toHaveLength(3);
    expect(shown.more).toBe(2);
  });

  it('shows the two bars and nothing more with Events only', () => {
    const week = weekHolding(
      weeksOf(NOVEMBER, NOVEMBER, 0, calendarDays(listed, 'events')),
      '2026-11-14',
    );

    expect(week.days[6]).toMatchObject({ count: 2, more: 0 });
    expect(week.pieces.every((piece) => piece.kind === 'bar')).toBe(true);
  });

  it('makes each week as tall as its busiest day', () => {
    const weeks = weeksOf(NOVEMBER, NOVEMBER, 0, all);

    expect(weekHolding(weeks, '2026-11-05').height).toBe(96);
    expect(weekHolding(weeks, '2026-11-20').height).toBe(72);
    expect(topsOf(weeks).slice(0, 3)).toEqual([0, 96, 237]);
  });

  it('puts every date on its event’s own day', () => {
    const quince = listed.find((event) => event.id === 'evt-quince-4');
    const october = calendarDays(listed, 'all').get('2026-10-10') ?? [];

    expect(quince?.startsAt).toBe('2026-10-11T00:00:00Z');
    expect(october.map((item) => item.event.id)).toEqual(['evt-quince-4', 'evt-quince-4']);
    expect(october[0] && rowLine(october[0], EN)).toBe('18:00 America/Mexico_City');
    expect(calendarDays(listed, 'all').has('2026-10-11')).toBe(false);
  });

  it('dates each event as the API’s EventDates does', () => {
    const titles = (id: string) => {
      const event = sampleEvent(id);

      return event == null ? [] : milestonesOf(event).map((one) => one.title);
    };

    expect(titles('evt-wed-4')).toEqual([
      'Adaeze & Tunde’s wedding starts',
      'Adaeze & Tunde’s wedding ends',
    ]);
    expect(titles('evt-gala-4')).toEqual(['Gala Fundación Lucía starts']);
    expect(titles('evt-off')).toEqual(['Team offsite called off']);
    expect(milestonesOf(sampleEvent('evt-off') ?? REUNION)[0]?.at).toBe('2026-10-30T10:00:00Z');
    expect(
      listed.map((event) => event.milestones.every((one) => one.action == null)),
    ).not.toContain(false);
  });

  it('counts an event’s days in its zone, an end at midnight closing the day before', () => {
    expect(dayCountOf(sampleEvent('evt-wed-4') ?? REUNION)).toBe(3);
    expect(dayCountOf(sampleEvent('evt-ireti-2') ?? REUNION)).toBe(2);
    expect(dayCountOf(sampleEvent('evt-gala-4') ?? REUNION)).toBe(1);
    expect(
      dayCountOf({ ...REUNION, startsAt: '2026-11-28T20:00:00Z', endsAt: '2026-11-29T00:00:00Z' }),
    ).toBe(1);
  });

  it('adds the reunion across November’s edge, in teal', () => {
    const withReunion = calendarDays(listedOf([...sampleEvents(), REUNION], CLOCKS.rest), 'all');
    const weeks = weeksOf(NOVEMBER, { year: 2026, month: 12 }, 0, withReunion);

    expect(meshFor(REUNION.id)).toBe('ireti');
    expect(sampleEvents().some((event) => event.id === REUNION.id)).toBe(false);
    expect(sampleEvent(REUNION.id)?.name).toBe('Okafor family reunion');
    expect(barOf(weekHolding(weeks, '2026-11-28'), REUNION.id)).toMatchObject({
      from: 6,
      span: 1,
      starts: true,
      ends: false,
    });
    expect(barOf(weekHolding(weeks, '2026-12-01'), REUNION.id)).toMatchObject({
      from: 0,
      span: 3,
      starts: false,
      ends: true,
    });
    expect(withReunion.get('2026-12-01')?.map((item) => item.kind)).toEqual(['event', 'milestone']);
  });

  it('labels the days, bars and marks as the boards do', () => {
    const week = weekHolding(weeksOf(NOVEMBER, NOVEMBER, 0, all), '2026-11-14');
    const marks = (all.get('2026-11-13') ?? []).filter((item) => item.kind === 'milestone');

    expect(dayLabel('2026-11-14', 4, EN)).toBe('Saturday, November 14, 4 items');
    expect(dayLabel(TODAY, 0, EN)).toBe('Today, Tuesday, November 3');
    expect(barLabel(barOf(week, 'evt-ireti-2').item, EN)).toBe(
      'Ireti at 40, Live, 19:00, Fri, Nov 13 to Sat, Nov 14',
    );
    expect(barLabel(barOf(week, 'evt-gala-4').item, EN)).toBe(
      'Gala Fundación Lucía, Live, 19:30 Europe/Madrid, Sat, Nov 14',
    );
    expect(barLabel(barOf(week, 'evt-off').item, EN)).toBe(
      'Team offsite, Called off, 09:00 Europe/Lisbon, Thu, Nov 12 to Fri, Nov 13',
    );
    expect(barWords(barOf(week, 'evt-off').item.event)).toBe('Team offsite · Called off');
    expect(barWords(barOf(week, 'evt-ireti-2').item.event)).toBe('Ireti at 40');
    expect(marks[0]?.kind === 'milestone' && markLabel(marks[0], EN)).toBe(
      'Ireti at 40 starts, 19:00',
    );
  });

  it('opens an event’s page, and a milestone with no action its All dates', () => {
    const saturday = all.get('2026-11-14') ?? [];

    expect(saturday.map(itemLink)).toEqual([
      '/demo/events/evt-ireti-2',
      '/demo/events/evt-gala-4',
      '/demo/events/evt-ireti-2/dates',
      '/demo/events/evt-gala-4/dates',
    ]);
  });

  it('pins the month of the top week’s last day', () => {
    const weeks = weeksOf({ year: 2026, month: 10 }, NOVEMBER, 0, all);
    const tops = topsOf(weeks);
    const turn = weeks.findIndex((week) => week.start === '2026-10-25');

    expect(pinnedOf(weeks, tops, tops[turn] ?? 0)).toEqual({ year: 2026, month: 10 });
    expect(pinnedOf(weeks, tops, tops[turn + 1] ?? 0)).toEqual(NOVEMBER);
  });

  it('moves the focused day by day, week and month, across month edges', () => {
    expect(movedDay('2026-11-30', 'ArrowRight', 0)).toBe('2026-12-01');
    expect(movedDay('2026-11-01', 'ArrowLeft', 0)).toBe('2026-10-31');
    expect(movedDay('2026-11-28', 'ArrowDown', 0)).toBe('2026-12-05');
    expect(movedDay('2026-11-14', 'Home', 0)).toBe('2026-11-08');
    expect(movedDay('2026-11-14', 'End', 1)).toBe('2026-11-15');
    expect(movedDay('2027-01-31', 'PageDown', 0)).toBe('2027-02-28');
    expect(movedDay('2026-11-14', 'PageUp', 0)).toBe('2026-10-14');
    expect(movedDay('2026-11-14', 'a', 0)).toBeNull();
  });

  it('lists today in Agenda with nothing on it, and an empty month as one line', () => {
    const entries = agendaOf(NOVEMBER, { year: 2027, month: 2 }, all, TODAY);
    const today = entries.find((entry) => entry.day === TODAY);
    const february = entries.filter((entry) => entry.day.startsWith('2027-02'));

    expect(today).toMatchObject({ items: [], turn: NOVEMBER, empty: false });
    expect(entries.filter((entry) => entry.day === '2026-11-06')[0]?.items).toHaveLength(1);
    expect(february).toEqual([
      { day: '2027-02-01', items: [], turn: { year: 2027, month: 2 }, empty: true },
    ]);
  });

  it('enters Agenda on the first day with a row from the day Month enters at', () => {
    const entries = agendaOf(NOVEMBER, { year: 2027, month: 2 }, all, TODAY);
    const listed = entries.filter((entry) => entry.items.length > 0);

    expect(agendaStop(entries, TODAY)).toEqual({
      entry: listed.find((one) => one.day >= TODAY),
      row: 0,
    });
    expect(agendaStop(entries, '2026-11-06')?.entry.day).toBe('2026-11-06');
    expect(agendaStop([], TODAY)).toBeUndefined();
  });

  it('enters Agenda past its last row on that last row, not its day’s first', () => {
    const entries = agendaOf(NOVEMBER, { year: 2027, month: 2 }, all, TODAY);
    const last = entries.filter((entry) => entry.items.length > 0).at(-1);

    expect(last?.items.length).toBeGreaterThan(1);
    expect(agendaStop(entries, '2027-02-01')).toEqual({
      entry: last,
      row: (last?.items.length ?? 0) - 1,
    });
  });

  it('opens each state by name, and where main kept the Calendar without one', () => {
    expect(calendarStateOf('busyDay')).toBe('busyDay');
    expect(calendarStateOf('nope')).toBeNull();
    expect(calendarStart('busyDay', null)).toMatchObject({ open: '2026-11-14', view: 'month' });
    expect(calendarStart('emptyMonth', null).at).toBe('2027-02-01');
    expect(calendarStart('monthEdge', null)).toMatchObject({ reunion: true, at: '2026-11-15' });
    expect(calendarStart('none', null).none).toBe(true);

    const kept = keptCalendarPlace({ view: 'agenda', month: { year: 2026, month: 12 } });

    expect(calendarStart(null, kept)).toMatchObject({ view: 'agenda', at: '2026-12-01' });
    expect(calendarStart('populated', kept)).toMatchObject({ view: 'month', at: TODAY });
    expect(calendarStart(null, 'not json')).toMatchObject({ view: 'month', at: TODAY });
  });

  it('eases the scroll as main’s motionEase', () => {
    expect(eased(0)).toBeCloseTo(0);
    expect(eased(1)).toBeCloseTo(1);
    expect(eased(0.5)).toBeGreaterThan(0.8);
    expect(eased(0.25)).toBeLessThan(eased(0.5));
  });
});

function titlesOn(days: ReadonlyMap<string, Item[]>, day: string): string[] {
  return (days.get(day) ?? []).map((item) =>
    item.kind === 'milestone' ? item.milestone.title : item.event.name,
  );
}

describe('Only what needs you, the Calendar’s third Show (sc-32803)', () => {
  const owner = seeded(listed, 'owner');
  const needs = needsDays(owner, 'en');

  it('offers it last, and every visit starts on Events and milestones', () => {
    expect(SHOWS).toEqual(['all', 'events', 'needs']);
    expect(calendarStart(null, null).show).toBe('all');
    expect(calendarStart('needsMonth', null).show).toBe('needs');

    const kept = keptCalendarPlace({ view: 'agenda', month: NOVEMBER });

    expect(calendarStart(null, kept).show).toBe('all');
  });

  it('lists the You milestones the reader can change, by time then title', () => {
    expect([...needs.keys()].sort()).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-09',
      '2026-11-11',
    ]);
    expect(titlesOn(needs, '2026-11-04')).toEqual([
      'Confirm the florist',
      'Send the seating plan to the venue',
      'Give final numbers to the kitchen',
      'Seat the last 12 guests',
    ]);
    expect(titlesOn(needs, '2026-11-10')).toEqual([]);
  });

  it('shows a reader who can only view nothing at all', () => {
    expect(needsDays(seeded(listed, 'readOnly'), 'en').size).toBe(0);
  });

  it('leaves out events, Automatic and Event milestones', () => {
    const [wedding] = owner.filter((event) => event.id === 'evt-wed-4');

    if (wedding == null) throw new Error('No wedding');

    const automatic: Listed = {
      ...wedding,
      milestones: [
        ...wedding.milestones,
        {
          at: '2026-11-05T09:00:00Z',
          title: 'Reminders go out',
          note: null,
          owner: 'automatic',
          area: 'menu',
          action: null,
        },
      ],
    };
    const items = [...needsDays([automatic], 'en').values()].flat();

    expect(items).not.toHaveLength(0);
    expect(items.every((item) => item.kind === 'milestone' && item.milestone.owner === 'you')).toBe(
      true,
    );
    expect(titlesOn(needsDays([automatic], 'en'), '2026-11-05')).toEqual([]);
    expect(titlesOn(daysFor(owner, 'all', 'en'), '2026-11-05')).toContain(
      'Adaeze & Tunde’s wedding starts',
    );
  });

  it('puts a Lagos row read from Los Angeles across midnight on Lagos’s day', () => {
    const [first] = listed;

    if (first == null) throw new Error('No sample');

    const lagos: Listed = {
      ...first,
      timeZone: 'Africa/Lagos',
      permissions: ['menu.manage'],
      milestones: [
        {
          at: '2026-11-10T23:30:00Z',
          title: 'Give final numbers to the kitchen',
          note: null,
          owner: 'you',
          area: 'menu',
          action: null,
        },
      ],
    };

    expect(wallDay('2026-11-10T23:30:00Z', 'America/Los_Angeles')).toBe('2026-11-10');
    expect([...needsDays([lagos], 'en').keys()]).toEqual(['2026-11-11']);
  });

  it('keeps an overdue row on its own past day, and names it overdue', () => {
    const [toasts] = needs.get('2026-11-02') ?? [];
    const [cake, band] = needs.get(TODAY) ?? [];

    if (toasts?.kind !== 'milestone' || cake?.kind !== 'milestone' || band?.kind !== 'milestone')
      throw new Error('Rows missing');

    expect(isOverdue(toasts.milestone, CLOCKS.rest)).toBe(true);
    expect(isOverdue(cake.milestone, CLOCKS.rest)).toBe(true);
    expect(isOverdue(band.milestone, CLOCKS.rest)).toBe(false);
    expect(needsLabel(cake, EN, CLOCKS.rest)).toBe(
      CAL_WORDS.needsRowLabelOverdue(
        'Confirm the cake',
        'Adaeze & Tunde’s wedding',
        rowLine(cake, EN),
      ),
    );
    expect(needsLabel(band, EN, CLOCKS.rest)).toBe(
      CAL_WORDS.needsRowLabel(
        'Pay the band’s balance',
        'Adaeze & Tunde’s wedding',
        rowLine(band, EN),
      ),
    );
  });

  it('names the zone of a row away from the reader’s', () => {
    const [deposit] = needs.get('2026-11-09') ?? [];

    expect(deposit?.kind === 'milestone' && rowLine(deposit, EN)).toMatch(/Europe\/Madrid$/);
  });

  it('drops today’s rows when their areas stop returning them', () => {
    const later = needsDays(seeded(listed, 'todayEmpty'), 'en');

    expect(later.has(TODAY)).toBe(false);
    expect(later.has('2026-11-02')).toBe(true);
  });

  it('lists only the days that hold a row in Agenda, and a month with none as one line', () => {
    const entries = agendaOf(NOVEMBER, { year: 2026, month: 12 }, needs, TODAY, false);

    expect(entries.map((entry) => entry.day)).toEqual([
      '2026-11-02',
      TODAY,
      '2026-11-04',
      '2026-11-09',
      '2026-11-11',
      '2026-12-01',
    ]);
    expect(entries.at(-1)?.empty).toBe(true);

    const later = needsDays(seeded(listed, 'todayEmpty'), 'en');

    expect(
      agendaOf(NOVEMBER, NOVEMBER, later, TODAY, false).some((entry) => entry.day === TODAY),
    ).toBe(false);
  });

  it('lands Today on today, else the month’s next day with a row, else its last, else its line', () => {
    const later = needsDays(seeded(listed, 'todayEmpty'), 'en');
    const before = new Map([...later].filter(([day]) => day < TODAY));

    expect(needsLanding(needs, TODAY)).toBe(TODAY);
    expect(needsLanding(later, TODAY)).toBe('2026-11-04');
    expect(needsLanding(before, TODAY)).toBe('2026-11-02');
    expect(needsLanding(new Map(), TODAY)).toBe('2026-11-01');
    expect(needsLanding(needs, '2026-12-01')).toBe('2026-12-01');
  });
});
