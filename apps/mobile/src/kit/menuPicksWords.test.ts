import type { EventMenu, MenuCourse, PicksCourse, PicksRoomPerson } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  defaultLine,
  headerClose,
  hostLine,
  openWords,
  overrideBody,
  picksAccess,
  ruledOutWords,
  savedOverride,
  whoChanges,
} from './menuPicksWords.ts';

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
const t = i18n.t.bind(i18n);

const ZONE = 'Europe/London';

const menuCourse = (id: string, at: string | null, closed = false): MenuCourse =>
  ({
    id,
    name: id,
    servedAt: null,
    answer: 'choose',
    skippable: true,
    dishes: [
      {
        id: 'jollof',
        name: 'Jollof rice',
        description: null,
        allergens: [],
        diets: [],
        libraryDishId: null,
        picked: true,
        variants: [
          {
            id: 'chicken',
            name: 'Chicken',
            for: 'everyone',
            allergens: [],
            diets: [],
            picked: true,
          },
        ],
        choices: [],
        offered: true,
        items: [],
      },
    ],
    ownItems: [],
    items: [],
    picksClose: at == null ? null : { at, source: 'chooseBy', closed },
    default: null,
  }) as MenuCourse;

const picksCourse = (over: Partial<PicksCourse> = {}): PicksCourse => ({
  id: 'main',
  name: 'Main course',
  asksNothing: false,
  skippable: true,
  closed: false,
  default: { dish: 'jollof', variant: 'chicken', options: [], chooseBy: '2027-05-28' },
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

const STARTERS = '2027-05-26T23:59:59+01:00';
const MAINS = '2027-05-28T23:59:59+01:00';

describe('the header’s close (sc-3905)', () => {
  it('says "from" the earliest while the open courses close on different days', () => {
    const menu: EventMenu = {
      courses: [menuCourse('starter', STARTERS), menuCourse('main', MAINS)],
    };

    expect(headerClose(t, menu, ZONE, 'en-GB')).toBe('picks close from Wednesday 26 May');
  });

  it('names the one day once the open courses share it', () => {
    const menu: EventMenu = {
      courses: [menuCourse('starter', STARTERS, true), menuCourse('main', MAINS)],
    };

    expect(headerClose(t, menu, ZONE, 'en-GB')).toBe('picks close Friday 28 May');
  });

  it('says closed on the last day once every course has closed', () => {
    const menu: EventMenu = {
      courses: [menuCourse('starter', STARTERS, true), menuCourse('main', MAINS, true)],
    };

    expect(headerClose(t, menu, ZONE, 'en-GB')).toBe('picks closed on Friday 28 May');
  });

  it('has no close while no course asks guests anything', () => {
    expect(headerClose(t, { courses: [menuCourse('main', null)] }, ZONE, 'en-GB')).toBeNull();
  });
});

describe('a course with a default (sc-1362)', () => {
  const menu: EventMenu = { courses: [{ ...menuCourse('main', MAINS), id: 'main' }] };
  const dish = (defaulted: number) => ({
    id: 'jollof',
    kind: 'dish' as const,
    name: 'Jollof rice',
    dish: null,
    for: null,
    allergens: [],
    chosen: 14,
    defaulted,
    holders: null,
  });

  it('names the default and when it is given, before the close', () => {
    expect(defaultLine(t, menu, picksCourse(), 'en-GB')).toBe(
      'Default: Jollof rice, Chicken. Given on Friday 28 May to anyone coming who hasn’t answered.',
    );
  });

  it('says how many were given it after the close', () => {
    expect(defaultLine(t, menu, picksCourse({ closed: true, rows: [dish(2)] }), 'en-GB')).toBe(
      'Default: Jollof rice, Chicken. Given on Friday 28 May to 2 guests who hadn’t answered.',
    );
  });

  it('has no line on a course without a default', () => {
    expect(defaultLine(t, menu, picksCourse({ default: null }), 'en-GB')).toBeNull();
  });

  it('gives each course a person was never given the default with its reason', () => {
    const names: Record<string, string> = { main: 'Main course', dessert: 'Dessert' };

    expect(
      openWords(
        t,
        'en',
        {
          courses: ['main', 'dessert'],
          excluded: [{ course: 'main', reason: 'vegetarian' }],
        },
        (id) => names[id] ?? '',
      ),
    ).toBe('Not chosen: Main course · Vegetarian and Dessert');
    expect(
      openWords(
        t,
        'en',
        { courses: ['main'], excluded: [{ course: 'main', reason: 'allergy' }] },
        (id) => names[id] ?? '',
      ),
    ).toBe('Not chosen: Main course · allergy');
  });
});

describe('what the screen offers (sc-3909)', () => {
  const someone = [{ id: 'kojo', name: 'Kojo', party: 'p1', allergens: [] }];

  it('offers both choices with guests.manage', () => {
    expect(picksAccess({ canChoose: true, people: someone })).toBe('manage');
  });

  it('shows names but no choices with guests.read alone', () => {
    expect(picksAccess({ canChoose: false, people: someone })).toBe('read');
  });

  it('shows counts only without guests.read', () => {
    expect(picksAccess({ canChoose: false, people: null })).toBe('counts');
    expect(picksAccess({ canChoose: true, people: null })).toBe('counts');
  });
});

describe('Choose who gets it', () => {
  const people: PicksRoomPerson[] = [
    { id: 'ama', name: 'Ama', party: 'p1', allergens: [] },
    { id: 'kojo', name: 'Kojo Asante', party: 'p1', allergens: ['celery'] },
    { id: 'efua', name: 'Efua', party: 'p2', allergens: [] },
  ];
  const variant = { holders: ['efua'], allergens: ['celery'] };

  it('asks first about anyone newly given a variant it rules out', () => {
    const { ruled, leaving } = whoChanges(variant, new Set(['efua', 'ama', 'kojo']), people);

    expect(ruled.map((one) => one.name)).toEqual(['Kojo Asante']);
    expect(leaving).toEqual([]);
  });

  it('takes it back from anyone who had it and is unticked', () => {
    const { ruled, leaving } = whoChanges(variant, new Set(['ama']), people);

    expect(ruled).toEqual([]);
    expect(leaving).toEqual(['efua']);
  });

  it('never asks again about someone who already had it', () => {
    const had = { holders: ['kojo'], allergens: ['celery'] };

    expect(whoChanges(had, new Set(['kojo']), people).ruled).toEqual([]);
  });
});

describe('a plate whose allergens were never stated, on Menu picks (sc-87421)', () => {
  const inSentence = (codes: readonly string[]) => codes.join(' and ');

  it('is ruled out saying nobody stated it, never what it contains', () => {
    expect(ruledOutWords(t, inSentence, ['peanuts', 'celery'], null, 'Kwame Asante')).toBe(
      'Allergens not stated. You can still pick it.',
    );
  });

  it('is not ruled out for a person with none of the 14', () => {
    expect(ruledOutWords(t, inSentence, [], null, 'Ada Obi')).toBeNull();
  });

  it('asks and saves without saying what it contains', () => {
    expect(overrideBody(t, inSentence, 'Puff-puff', ['peanuts'], null, 'Kwame Asante')).toBe(
      'Nobody has stated what’s in Puff-puff. If you know it is safe for Kwame Asante, the pick is saved with your name and the time you confirmed it.',
    );
    expect(savedOverride(t, inSentence, 'Puff-puff', ['peanuts'], null, 'Kwame Asante')).toBe(
      'Recorded as your pick for Kwame Asante, though nobody has stated what’s in Puff-puff.',
    );
  });

  it('says under Needs the host that the pick has no allergens stated', () => {
    const line = {
      person: { id: 'kojo', name: 'Kojo Mensah' },
      course: 'dessert',
      reason: 'allergy' as const,
      pick: 'Puff-puff',
      allergens: ['peanuts'],
      notStated: true,
    };

    expect(hostLine(t, inSentence, line, 'Dessert')).toBe(
      'Dessert: their pick, Puff-puff, has no allergens stated, and their allergy to peanuts was recorded after they picked it.',
    );
    expect(
      hostLine(t, inSentence, { ...line, pick: 'Chin-chin', notStated: false }, 'Dessert'),
    ).toBe('Dessert: their pick, Chin-chin, contains peanuts, recorded after they picked it.');
  });

  it('keeps a stated dish’s words', () => {
    expect(ruledOutWords(t, inSentence, ['celery'], ['celery'], 'Kwame Asante')).toBe(
      'Contains celery, which Kwame Asante is allergic to. You can still pick it.',
    );
    expect(overrideBody(t, inSentence, 'Jollof rice', ['celery'], ['celery'], 'Kwame Asante')).toBe(
      'Jollof rice contains celery. If Kwame Asante’s record is out of date, the pick is saved with your name and the time you confirmed it.',
    );
    expect(
      savedOverride(t, inSentence, 'Jollof rice', ['celery'], ['celery'], 'Kwame Asante'),
    ).toBe(
      'Recorded as your pick for Kwame Asante, despite the record: Jollof rice contains celery.',
    );
  });
});
