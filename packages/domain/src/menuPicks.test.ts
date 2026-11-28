import type { MenuDish, PicksCourse, PicksWaiting } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  courseHostCount,
  defaultedOn,
  goesBackTo,
  hostCount,
  showsDefaulted,
  waitingSplit,
} from './menuPicks.ts';

const course = (over: Partial<PicksCourse> = {}): PicksCourse => ({
  id: 'main',
  name: 'Main course',
  asksNothing: false,
  skippable: true,
  closed: false,
  default: null,
  rows: [],
  kitchen: 0,
  skipped: 0,
  needsHost: 0,
  notChosen: 0,
  menuChanged: 0,
  menuChangedAllergen: 0,
  room: 48,
  answered: 0,
  ...over,
});

const row = (id: string, kind: 'dish' | 'variant', chosen: number, defaulted: number) => ({
  id,
  kind,
  name: id,
  dish: kind === 'dish' ? null : 'jollof',
  for: null,
  allergens: [],
  chosen,
  defaulted,
  holders: null,
});

describe('Needs the host', () => {
  it('counts a person a menu change flagged for an added allergen, though the course counts them as Menu changed', () => {
    const main = course({ needsHost: 1, menuChanged: 2, menuChangedAllergen: 1 });

    expect(courseHostCount(main)).toBe(2);
    expect(hostCount({ courses: [main, course({ id: 'starter' })] } as never)).toBe(2);
  });
});

describe('a course with a default', () => {
  it('counts the defaulted beside the chosen, from its dish rows alone', () => {
    const main = course({
      rows: [
        row('jollof', 'dish', 14, 2),
        row('chicken', 'variant', 9, 2),
        row('fish', 'dish', 6, 1),
      ],
    });

    expect(defaultedOn(main)).toBe(3);
    expect(showsDefaulted(main)).toBe(true);
  });

  it('shows the Defaulted column once it has a default, before anyone is given it', () => {
    const before = course({
      default: { dish: 'jollof', variant: null, options: [], chooseBy: '2027-05-28' },
    });

    expect(showsDefaulted(before)).toBe(true);
    expect(showsDefaulted(course())).toBe(false);
  });
});

describe('Who hasn’t picked', () => {
  const waiting: PicksWaiting[] = [
    {
      id: 'p1',
      replier: 'Kojo Asante',
      people: [
        { id: 'kojo', name: 'Kojo Asante', courses: ['main'], changed: [], excluded: [] },
        {
          id: 'bea',
          name: 'Bea Mensah',
          courses: ['main', 'dessert'],
          changed: [],
          excluded: [{ course: 'main', reason: 'vegetarian' }],
        },
      ],
    },
    {
      id: 'p2',
      replier: 'Nadia Petrova',
      people: [
        {
          id: 'nadia',
          name: 'Nadia Petrova',
          courses: ['main'],
          changed: [],
          excluded: [{ course: 'main', reason: 'other' }],
        },
      ],
    },
  ];

  it('lists the people never given the default first, apart from the parties', () => {
    const { never, parties } = waitingSplit(waiting);

    expect(never.map((one) => one.id)).toEqual(['bea', 'nadia']);
    expect(parties).toEqual([{ ...waiting[0], people: [waiting[0]?.people[0]] }]);
  });
});

describe('Choose who gets it, taken back', () => {
  const dish: MenuDish = {
    id: 'jollof',
    name: 'Jollof rice',
    description: null,
    allergens: [],
    diets: [],
    libraryDishId: null,
    picked: true,
    variants: [
      {
        id: 'full',
        name: 'Full bowl',
        for: 'everyone',
        allergens: ['celery'],
        diets: [],
        picked: true,
      },
      {
        id: 'kids',
        name: 'Children’s portion',
        for: 'children',
        allergens: [],
        diets: [],
        picked: true,
      },
    ],
    choices: [],
    offered: true,
    items: [],
  };

  it('goes back to not chosen on a course that asks guests something', () => {
    expect(goesBackTo(course(), dish, { allergens: [] })).toEqual({ kind: 'notChosen' });
  });

  it('goes back to the Everyone variant on a course that asks nothing', () => {
    expect(goesBackTo(course({ asksNothing: true }), dish, { allergens: [] })).toEqual({
      kind: 'dish',
      name: 'Full bowl',
    });
  });

  it('goes to Needs the host when the Everyone variant rules them out too', () => {
    expect(goesBackTo(course({ asksNothing: true }), dish, { allergens: ['celery'] })).toEqual({
      kind: 'needsHost',
    });
  });
});
