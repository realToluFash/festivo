import type { MenuCourse, MenuDish } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  CLEARED,
  checkDefault,
  hasDefaultProblem,
  pickWords,
  sentDefault,
  withDish,
} from './courseDefault.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;
const day = (date: string): string => date;

const dish = (id: string, more: Partial<MenuDish> = {}): MenuDish => ({
  id,
  name: id,
  description: null,
  allergens: [],
  diets: [],
  libraryDishId: null,
  picked: false,
  variants: [],
  choices: [],
  offered: true,
  items: [],
  ...more,
});

const MAIN: MenuCourse = {
  id: 'c_main',
  name: 'Main',
  servedAt: null,
  scheduleItem: null,
  answer: 'choose',
  skippable: false,
  ownItems: [],
  items: [],
  picksClose: { at: '2030-11-15T18:00:00+01:00', source: 'start', closed: false },
  default: null,
  dishes: [
    dish('Jollof rice', {
      choices: [
        {
          id: 'ch_side',
          question: 'And a side?',
          pick: 1,
          required: true,
          draft: false,
          noneAnswers: 0,
          options: [
            { id: 'o_plantain', name: 'Plantain', allergens: [], picks: 0 },
            { id: 'o_salad', name: 'Salad', allergens: [], picks: 0 },
          ],
        },
      ],
    }),
    dish('Rice and stew', {
      variants: [
        { id: 'v_plate', name: 'Plate', for: 'everyone', allergens: [], diets: [], picked: false },
        { id: 'v_kids', name: 'Kids', for: 'children', allergens: [], diets: [], picked: false },
      ],
    }),
  ],
};

const DATES = { today: '2026-10-14', event: '2030-11-15', stored: null, locked: false };

describe('the default and its choose-by date', () => {
  it('asks nothing of a course with neither set', () => {
    expect(hasDefaultProblem(checkDefault(CLEARED, MAIN, DATES, t, day))).toBe(false);
  });

  it('refuses one of the pair without the other', () => {
    expect(checkDefault({ ...CLEARED, chooseBy: '2030-11-10' }, MAIN, DATES, t, day).dish).toBe(
      'courseDefault.onlyDate',
    );
    const dishOnly = withDish(MAIN, CLEARED, 'Rice and stew');
    expect(checkDefault(dishOnly, MAIN, DATES, t, day).chooseBy).toBe('courseDefault.onlyDefault');
  });

  it('selects a dish’s one Everyone variant, and names every required choice left unanswered', () => {
    expect(withDish(MAIN, CLEARED, 'Rice and stew').variantId).toBe('v_plate');
    const errors = checkDefault(
      { ...withDish(MAIN, CLEARED, 'Jollof rice'), chooseBy: '2030-11-10' },
      MAIN,
      DATES,
      t,
      day,
    );
    expect(errors.choices).toEqual({ ch_side: 'courseDefault.answer {"question":"And a side?"}' });
  });

  it('refuses a date on or after the event, and a newly entered past date, but never an unchanged one', () => {
    const form = { ...withDish(MAIN, CLEARED, 'Rice and stew'), chooseBy: '2030-11-15' };
    expect(checkDefault(form, MAIN, DATES, t, day).chooseBy).toContain('courseDefault.afterEvent');
    const past = { ...form, chooseBy: '2026-10-01' };
    expect(checkDefault(past, MAIN, DATES, t, day).chooseBy).toContain('courseDefault.past');
    expect(
      checkDefault(past, MAIN, { ...DATES, stored: '2026-10-01' }, t, day).chooseBy,
    ).toBeNull();
  });

  it('sends the whole pick, and both null to clear', () => {
    const form = {
      ...withDish(MAIN, CLEARED, 'Jollof rice'),
      options: { ch_side: ['o_plantain'] },
      chooseBy: '2030-11-10',
    };
    expect(sentDefault(form, MAIN)).toEqual({
      dish: 'Jollof rice',
      variant: null,
      options: ['o_plantain'],
      chooseBy: '2030-11-10',
    });
    expect(sentDefault(CLEARED, MAIN)).toEqual({ dish: null, chooseBy: null });
    expect(pickWords(MAIN, { dish: 'Jollof rice', variant: null, options: ['o_plantain'] })).toBe(
      'Jollof rice, Plantain',
    );
  });
});
