import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import pt from '../i18n/locales/pt.json';

import {
  DAYS,
  HOME_READER,
  MAIN,
  MOST_ITEMS,
  RW,
  SCHEDULE_PAGES,
  SCHEDULE_STATES,
  THEIRS,
  atLimit,
  blankForm,
  check,
  courseLine,
  dayCount,
  dayOf,
  differences,
  firstWrong,
  formOf,
  headingLine,
  itemOf,
  lastsHelp,
  linkedItems,
  placeHelp,
  readerOf,
  sampleCourses,
  sampleItems,
  sevenDayItems,
  scheduleAt,
  startsCell,
  tablesOn,
  windowLine,
  withCourseKept,
  withTypedStart,
} from './schedule.ts';

const FRIDAY = DAYS[1];

describe('the schedule’s rules (sc-3893)', () => {
  it('puts an item on the event day of its start, which turns at 05:00', () => {
    expect(dayOf('2026-11-07T00:30')).toBe('2026-11-06');
    expect(dayOf('2026-11-07T04:59')).toBe('2026-11-06');
    expect(dayOf('2026-11-07T05:00')).toBe('2026-11-07');
  });

  it('gives a table per place ordered by first start, items with no place under Main', () => {
    const tables = tablesOn(sampleItems(), FRIDAY);
    expect(tables.map((table) => table.place)).toEqual([MAIN, 'Garden', 'Ballroom']);
    expect(tables.at(-1)?.items.at(-1)?.title).toBe('Late food');
    expect(tablesOn(sampleItems(), DAYS[0]).map((table) => table.place)).toEqual([MAIN]);
    expect(tablesOn(sampleItems(), DAYS[2])).toEqual([]);
  });

  it('says the day in one line, and names the zone only for a reader elsewhere', () => {
    expect(headingLine(sampleItems(), FRIDAY, HOME_READER)).toBe(
      '10 items · 13:30 to 01:00 · 3 places',
    );
    const away = readerOf('en-US', 'away');
    expect(headingLine(sampleItems(), FRIDAY, away)).toMatch(
      /^10 items · 13:30 to 01:00 · 3 places · .+/,
    );
    expect(headingLine(sampleItems(), DAYS[2], HOME_READER)).toBeNull();
  });

  it('writes the weekday on a start after midnight', () => {
    const late = sampleItems().find((one) => one.id === 'late');
    expect(late && startsCell(late, FRIDAY, HOME_READER)).toBe('Sat 00:30');
  });

  it('refuses each field in order, and the start outside the window with its sentence', () => {
    const blank = check(blankForm(FRIDAY), HOME_READER);
    expect(blank.title).toBe(RW.blankTitle);
    expect(blank.time).toBe(RW.noStart);
    expect(firstWrong(blank)).toBe('title');
    const outside = check(
      { ...blankForm('2026-11-07'), title: 'Fireworks', time: '22:00' },
      HOME_READER,
    );
    expect(outside.date).toBe(windowLine(HOME_READER));
    expect(windowLine(HOME_READER)).toBe(
      'Choose a time between Thu 5 Nov, 06:00 and Sat 7 Nov, 15:00.',
    );
    const long = check(
      {
        ...blankForm(FRIDAY),
        title: 'x'.repeat(121),
        time: '21:00',
        lasts: '721',
        owner: 'o'.repeat(121),
        role: 'r'.repeat(41),
        note: 'n'.repeat(501),
      },
      HOME_READER,
    );
    expect(long).toEqual({
      title: RW.longTitle(121),
      lasts: RW.badLength,
      owner: RW.longOwner(121),
      role: RW.longRole(41),
      note: RW.longNote(501),
    });
    expect(
      check({ ...blankForm(FRIDAY), title: 'A', time: '21:00', lasts: '0' }, HOME_READER),
    ).toEqual({});
  });

  it('tells when an item ends, or that it runs until the next', () => {
    const form = { ...blankForm(FRIDAY), time: '23:30', lasts: '90' };
    expect(lastsHelp(form, HOME_READER)).toBe('Ends at 01:00.');
    expect(lastsHelp({ ...form, lasts: '' }, HOME_READER)).toBe(RW.runsOn);
  });

  it('names a new place, and a changed place keeps its start', () => {
    const items = sampleItems();
    const speeches = items.find((one) => one.id === 'speeches') ?? null;
    expect(placeHelp(items, { ...blankForm(FRIDAY), place: 'Terrace' }, null)).toBe(
      RW.newPlace('Terrace'),
    );
    expect(speeches && placeHelp(items, { ...formOf(speeches), place: 'Garden' }, speeches)).toBe(
      RW.moves('Garden'),
    );
    expect(speeches && placeHelp(items, formOf(speeches), speeches)).toBeNull();
  });

  it('matches a typed place against the day’s tables, in any case, keeping its spelling', () => {
    const items = sampleItems();
    const garden = (date: string, place: string) => ({
      ...blankForm(date),
      title: 'Lawn games',
      time: '16:00',
      place,
    });
    expect(placeHelp(items, garden(DAYS[0], 'Garden'), null)).toBe(RW.newPlace('Garden'));
    expect(placeHelp(items, garden(FRIDAY, 'garden'), null)).toBeNull();
    expect(itemOf('x', garden(FRIDAY, 'garden'), ['Garden', 'Ballroom']).place).toBe('Garden');
  });

  it('lists only the fields that differ in the 412', () => {
    const speeches = sampleItems().find((one) => one.id === 'speeches');
    if (speeches == null) throw new Error('no Speeches');
    const rows = differences(
      THEIRS,
      { ...formOf(speeches), title: 'Speeches and toasts' },
      HOME_READER,
    );
    expect(rows.map((row) => row.field)).toEqual(['Title', 'Starts', 'Owner', 'Role']);
  });

  it('pads the event to the most it can hold', () => {
    expect(atLimit()).toHaveLength(MOST_ITEMS);
  });

  it('links every state from the demo’s home', () => {
    const linked = SCHEDULE_PAGES.flatMap((page) => page.states.map((one) => one.to));
    for (const state of SCHEDULE_STATES) expect(linked).toContain(scheduleAt(state));
  });
});

describe('the day tabs’ words (sc-64803)', () => {
  it('counts a day in each of the four languages with the product’s own schedule.items', () => {
    const product = { en, es, fr, pt };
    for (const [lang, words] of Object.entries(product)) {
      const one = words.schedule.items_one.replace('{{count, number}}', '1');
      const other = words.schedule.items_other.replace('{{count, number}}', '12');
      expect([1, 12].map((n) => dayCount(n, lang))).toEqual([one, other]);
    }
  });

  it('gives the seven-day event a day of 1 item and a day of 12', () => {
    const counts = new Map<string, number>();
    for (const one of sevenDayItems())
      counts.set(dayOf(one.starts), (counts.get(dayOf(one.starts)) ?? 0) + 1);
    expect(counts.get('2026-11-07')).toBe(1);
    expect(counts.get('2026-11-08')).toBe(12);
  });
});

describe('a course linked to an item (sc-3898)', () => {
  const [starter, main, dessert, bites] = sampleCourses() as [
    ReturnType<typeof sampleCourses>[number],
    ReturnType<typeof sampleCourses>[number],
    ReturnType<typeof sampleCourses>[number],
    ReturnType<typeof sampleCourses>[number],
  ];

  it('serves a linked course at its item’s start, and names that item', () => {
    expect(courseLine(starter, linkedItems(), 'late', HOME_READER)).toBe(
      'served 17:30 · linked to Dinner',
    );
    expect(courseLine(main, linkedItems(), 'late', HOME_READER)).toBe(
      'served 19:50 · linked to Mains go out',
    );
  });

  it('serves an unlinked course at its own time, and a course with none says nothing', () => {
    expect(courseLine(dessert, linkedItems(), 'late', HOME_READER)).toBe('served 21:30');
    expect(courseLine(bites, linkedItems(), 'late', HOME_READER)).toBeNull();
  });

  it('does not say linked to the item being edited', () => {
    expect(courseLine(main, linkedItems(), 'mains', HOME_READER)).toBe('served 19:50');
  });

  it('serves the edited item’s course at the time typed on its form', () => {
    const typed = withTypedStart(linkedItems(), 'mains', { date: '2026-11-06', time: '20:10' });
    expect(courseLine(main, typed, 'mains', HOME_READER)).toBe('served 20:10');
    expect(courseLine(dessert, typed, 'mains', HOME_READER)).toBe('served 21:30');
    expect(withTypedStart(linkedItems(), 'mains', { date: '2026-11-06', time: '' })).toEqual(
      linkedItems(),
    );
  });

  it('moves a link on save: the other item loses the course and keeps its title', () => {
    const items = linkedItems();
    const late = items.find((one) => one.id === 'late');
    const kept = withCourseKept(items, { ...(late as (typeof items)[number]), course: 'k2' });
    const mains = kept.find((one) => one.id === 'mains');
    expect(mains?.course).toBeNull();
    expect(mains?.title).toBe('Mains go out');
    expect(kept.filter((one) => one.course === 'k2').map((one) => one.id)).toEqual(['late']);
  });

  it('leaves items without a course as they were', () => {
    expect(sampleItems().every((one) => one.course === null)).toBe(true);
  });
});
