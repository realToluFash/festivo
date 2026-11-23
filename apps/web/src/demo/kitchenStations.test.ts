import { describe, expect, it } from 'vitest';

import { type SheetCourse, menuOf, sheetOf, worldOf } from './kitchenSheet.ts';
import { courseFigures, spotOf } from './seePicks.ts';

const ADDED_ROWS = ['Side · Fried yam', 'Side · Fruit salad', 'Side · Puff-puff'];

const lines = (course: SheetCourse | undefined) =>
  (course?.stations ?? []).map(({ place, lines: all }) => [
    place.name,
    all.map((line) => `${line.chefs ? 'Chef’s choice' : line.name} · ${line.count}`),
  ]);

const named = (state: 'open' | 'closed', menu: 'items' | 'moved' | 'plain', name: string) =>
  sheetOf(worldOf(state, menu), menuOf(menu)).courses.find((one) => one.course.name === name);

describe('By station under each course (sc-34244)', () => {
  it('lists the Main’s stations, the Pass first, every item at 0 too, Chef’s choice last', () => {
    expect(lines(named('open', 'items', 'Main'))).toEqual([
      ['Pass', ['Garden salad · 2', 'Pepper sauce · 48', 'Chef’s choice · 9']],
      [
        'Kitchen',
        [
          'Jollof rice · 17',
          'Plantain · 23',
          'Coconut rice · 12',
          'Moi moi · 4',
          'Fried yam · 0',
          'Flatbread · 10',
        ],
      ],
      ['Grill', ['Fish · 5', 'Chicken · 10', 'Beef · 7']],
    ]);
  });

  it('follows the walking order after a lead moves Grill before Kitchen', () => {
    expect(lines(named('open', 'moved', 'Main')).map(([name]) => name)).toEqual([
      'Pass',
      'Grill',
      'Kitchen',
    ]);
  });

  it('counts Chef’s choice as the guests with no dish, each once, after the close too', () => {
    for (const state of ['open', 'closed'] as const) {
      const main = named(state, 'items', 'Main');
      const figures = courseFigures(worldOf(state, 'items'), main!.course);
      const chefs = main?.stations?.[0]?.lines.at(-1);

      expect(chefs?.chefs).toBe(true);
      expect(chefs?.count).toBe(figures.kitchen + figures.host + figures.none + figures.changed);
    }
  });

  it('leaves the skipped out: the Dessert’s lines add up to the room less Skipped', () => {
    const dessert = named('open', 'items', 'Dessert');
    const skipped = dessert?.rows.find((row) => row.kind === 'skipped')?.count ?? 0;
    const counted = (dessert?.stations ?? [])
      .flatMap((one) => one.lines)
      .reduce((sum, line) => sum + line.count, 0);

    expect(lines(dessert)).toEqual([
      ['Pass', ['Chef’s choice · 7']],
      ['Pastry', ['Chin chin · 20', 'Zobo sorbet · 15', 'Fruit salad · 0', 'Puff-puff · 0']],
    ]);
    expect(counted).toBe(48 - skipped);
  });

  it('counts a guest given a default with no answer to its optional side as Chef’s choice, once', () => {
    const world = worldOf('closed', 'items');
    const dessert = named('closed', 'items', 'Dessert');
    const figures = courseFigures(world, dessert!.course);
    const defaulted = world.people.filter((person) => {
      const spot = spotOf(world, dessert!.course, person);

      return spot.kind === 'dish' && spot.defaulted;
    }).length;

    expect(defaulted).toBeGreaterThan(0);
    expect(lines(dessert)).toEqual([
      [
        'Pass',
        [
          `Chef’s choice · ${figures.kitchen + figures.host + figures.none + figures.changed + defaulted}`,
        ],
      ],
      [
        'Pastry',
        ['Chin chin · 20', `Zobo sorbet · ${15 + defaulted}`, 'Fruit salad · 0', 'Puff-puff · 0'],
      ],
    ]);
  });

  it('gives a course with no items, all at the Pass, no By station', () => {
    expect(named('open', 'items', 'Starter')?.stations).toBeNull();
  });

  it('keeps sc-3911’s rows, and a menu with no items keeps sc-3911’s sheet', () => {
    const plain = sheetOf(worldOf('open'));
    const items = sheetOf(worldOf('open', 'items'), menuOf('items'));

    expect(plain.courses.every((one) => one.stations == null)).toBe(true);
    expect(
      items.courses.map((one) => one.rows.filter((row) => !ADDED_ROWS.includes(row.name))),
    ).toEqual(plain.courses.map((one) => one.rows));
  });
});
