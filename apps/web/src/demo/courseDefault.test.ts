import { describe, expect, it } from 'vitest';

import {
  CHOOSE_BY_ID,
  CLEARED,
  DFW,
  type DefaultDates,
  type DefaultForm,
  checkDefault,
  defaultForm,
  defaultLine,
  excludedFromDefault,
  firstDefaultProblem,
  hasDefaultProblem,
  isLocked,
  moveCounts,
  moveOf,
  moveWords,
  offeredDishes,
  optionInput,
  ownAfter,
  pickWords,
  savedDefault,
  variantRadio,
  withDish,
} from './courseDefault.ts';
import { type EvCourse, asksGuests, coursesStart } from './menuCourses.ts';

const courseIn = (state: Parameters<typeof coursesStart>[0], id: string): EvCourse =>
  coursesStart(state).courses.find((one) => one.id === id) as EvCourse;
const starter = (): EvCourse => courseIn('defaultUnset', 'k1');
const main = (): EvCourse => courseIn('defaultUnset', 'k2');
const before: DefaultDates = { today: '2026-10-14', event: '2026-11-14', stored: null };
const form = (over: Partial<DefaultForm>): DefaultForm => ({ ...CLEARED, ...over });

describe('the default and choose-by date are set together (sc-1362)', () => {
  it('lets both be left unset', () => {
    expect(hasDefaultProblem(checkDefault(CLEARED, starter(), before, 'en'))).toBe(false);
  });

  it('refuses one without the other, on the field that is missing', () => {
    const noDate = checkDefault(form({ dishId: 'k1-canape' }), starter(), before, 'en');
    const noDish = checkDefault(form({ chooseBy: '2026-10-16' }), starter(), before, 'en');

    expect(noDate.chooseBy).toBe(DFW.onlyDefault);
    expect(noDish.dish).toBe('Choose a default dish, or clear the choose-by date.');
    expect(noDish.chooseBy).toBeNull();
  });

  it('refuses a date on or after the event’s, and a newly entered one that has passed', () => {
    const on = checkDefault(
      form({ dishId: 'k1-canape', chooseBy: '2026-11-14' }),
      starter(),
      before,
      'en',
    );
    const past = checkDefault(
      form({ dishId: 'k1-canape', chooseBy: '2026-10-12' }),
      starter(),
      before,
      'en',
    );

    expect(on.chooseBy).toBe('Choose a date before the event, Saturday, Nov 14.');
    expect(past.chooseBy).toBe('That date has passed. Choose today, Wednesday, Oct 14, or later.');
  });

  it('never checks an unchanged stored date against today', () => {
    const dates = { ...before, today: '2026-10-17', stored: '2026-10-16' };
    const kept = form({ dishId: 'k1-suya', chooseBy: '2026-10-16' });

    expect(isLocked(dates)).toBe(true);
    expect(checkDefault(kept, starter(), dates, 'en').chooseBy).toBeNull();
  });

  it('asks a whole pick: an Everyone variant and each required choice’s count', () => {
    const coconut = checkDefault(
      form({ dishId: 'k2-coconut', chooseBy: '2026-10-16' }),
      main(),
      before,
      'en',
    );
    const jollof = checkDefault(
      form({ dishId: 'k2-jollof', chooseBy: '2026-10-16', options: { 'c-two': ['c-two-salad'] } }),
      main(),
      before,
      'en',
    );

    expect(coconut.variant).toBe('Choose the default’s variant.');
    expect(coconut.choices).toEqual({ 'c-side': 'Answer “And a side?” for the default.' });
    expect(jollof.variant).toBeNull();
    expect(jollof.choices).toEqual({ 'c-two': 'Choose 2 for “Two sides?”.' });
  });

  it('refuses the Children only variant as the default', () => {
    const kids = form({ dishId: 'k2-coconut', variantId: 'v-kids2', chooseBy: '2026-10-16' });

    expect(checkDefault(kids, main(), before, 'en').variant).toBe(DFW.noVariant);
  });

  it('focuses the first refused field in the order they are drawn', () => {
    const coconut = form({ dishId: 'k2-coconut' });
    const errors = checkDefault(coconut, main(), before, 'en');

    expect(firstDefaultProblem(errors, coconut, main())).toBe(variantRadio('v-chicken2'));
    const noSide = { ...coconut, variantId: 'v-chicken2' };
    expect(firstDefaultProblem(checkDefault(noSide, main(), before, 'en'), noSide, main())).toBe(
      optionInput('c-side', 'c-side-plantain'),
    );
    const noDate = form({ dishId: 'k1-canape' });
    expect(
      firstDefaultProblem(checkDefault(noDate, starter(), before, 'en'), noDate, starter()),
    ).toBe(CHOOSE_BY_ID);
  });

  it('starts another dish’s variant and options blank', () => {
    const whole = form({ dishId: 'k2-coconut', variantId: 'v-fish', options: { 'c-side': ['x'] } });

    expect(withDish(whole, 'k2-jollof')).toEqual(form({ dishId: 'k2-jollof' }));
    expect(withDish(whole, 'k2-coconut')).toBe(whole);
  });
});

describe('the saved default (sc-1362)', () => {
  it('names the dish, its variant and each option', () => {
    const whole = form({
      dishId: 'k2-coconut',
      variantId: 'v-chicken2',
      options: { 'c-side': ['c-side-plantain'] },
      chooseBy: '2026-10-16',
    });
    const pick = savedDefault(whole, main());

    expect(pick).toEqual({
      dishId: 'k2-coconut',
      variantId: 'v-chicken2',
      optionIds: ['c-side-plantain'],
    });
    expect(pickWords(main(), pick as NonNullable<typeof pick>)).toBe(
      'Coconut rice, Chicken, Plantain',
    );
  });

  it('opens Edit course on the stored pair', () => {
    const set = courseIn('defaultWholePick', 'k2');

    expect(defaultForm(set, '2026-10-16')).toEqual({
      dishId: 'k2-coconut',
      variantId: 'v-chicken2',
      options: { 'c-side': ['c-side-plantain'] },
      chooseBy: '2026-10-16',
    });
  });

  it('says when it is given, and to how many once it has been', () => {
    const set = courseIn('defaultSet', 'k1');
    const given = courseIn('defaultAfterDate', 'k1');
    const pick = set.pick as NonNullable<EvCourse['pick']>;

    expect(defaultLine(set, pick, '2026-10-16', false, 'en')).toBe(
      '[Default: Canapé selection. Given on Friday, Oct 16 to anyone coming who hasn’t answered.]',
    );
    expect(defaultLine(given, pick, '2026-10-16', true, 'en')).toBe(
      '[Default: Canapé selection. Given on Friday, Oct 16 to 23 guests who hadn’t answered.]',
    );
  });

  it('offers only the dishes guests can see, on a course that asks them something', () => {
    expect(offeredDishes(starter()).map((one) => one.name)).toEqual([
      'Canapé selection',
      'Beef suya skewers',
    ]);
    expect(asksGuests(courseIn('defaultAsksNothing', 'k1'))).toBe(false);
  });

  it('hands the close back when the pair is cleared', () => {
    expect(ownAfter({ k1: '2026-10-16', k2: '2026-10-18' }, 'k1', null)).toEqual({
      k2: '2026-10-18',
    });
    expect(ownAfter({}, 'k1', '2026-10-16')).toEqual({ k1: '2026-10-16' });
  });
});

describe('who is given the default (sc-1362)', () => {
  it('leaves out anyone with an allergy, or a diet it does not meet', () => {
    expect(excludedFromDefault({ allergies: [], diets: [] }, ['pescatarian'])).toBe(false);
    expect(excludedFromDefault({ allergies: ['sesame'], diets: [] }, ['pescatarian'])).toBe(true);
    expect(excludedFromDefault({ allergies: [], diets: ['halal'] }, ['pescatarian'])).toBe(true);
    expect(excludedFromDefault({ allergies: [], diets: ['other'] }, ['pescatarian'])).toBe(true);
  });

  it('moves those the new default meets, and sends the rest back to not chosen', () => {
    const given = courseIn('defaultMove', 'k1');
    const dates = { ...before, today: '2026-10-17', stored: '2026-10-16' };
    const suya = form({ dishId: 'k1-suya', chooseBy: '2026-10-16' });

    expect(moveCounts([[], ['pescatarian']], ['halal'])).toEqual({ move: 1, back: 1 });
    expect(moveOf(given, suya, dates)).toEqual({
      move: 21,
      back: 2,
      from: 'Canapé selection',
      to: 'Beef suya skewers',
      on: '2026-10-16',
    });
    expect(moveOf(given, form({ dishId: 'k1-canape', chooseBy: '2026-10-16' }), dates)).toBeNull();
    expect(moveOf(given, suya, before)).toBeNull();
  });

  it('words the move and its outcome, one guest in the singular', () => {
    expect(DFW.moveTitle(21, 'Beef suya skewers')).toBe('Move 21 guests to Beef suya skewers?');
    expect(DFW.moveBody(21, 'Canapé selection', 'Friday, Oct 16', 'Beef suya skewers', 2)).toBe(
      '[21 guests given Canapé selection on Friday, Oct 16 move to Beef suya skewers. 2 go back to not chosen, because Beef suya skewers doesn’t meet their diet, and are listed first in Who hasn’t picked.]',
    );
    expect(DFW.moveBody(1, 'A', 'Friday, Oct 16', 'B', 0)).toBe(
      '[1 guest given A on Friday, Oct 16 moves to B.]',
    );
    expect(DFW.moved(21, 'Beef suya skewers', 2)).toBe(
      '[21 guests moved to Beef suya skewers. 2 are back to not chosen.]',
    );
  });

  it('asks to change the default, never to move 0 guests, when nobody moves', () => {
    const given = courseIn('defaultMoveNone', 'k1');
    const dates = { ...before, today: '2026-10-17', stored: '2026-10-16' };
    const move = moveOf(given, form({ dishId: 'k1-suya', chooseBy: '2026-10-16' }), dates);

    expect(move).toEqual({
      move: 0,
      back: 4,
      from: 'Canapé selection',
      to: 'Beef suya skewers',
      on: '2026-10-16',
    });
    expect(move == null ? null : moveWords(move, 'Friday, Oct 16')).toEqual({
      title: '[Change the default to Beef suya skewers?]',
      body: '[Nobody given Canapé selection on Friday, Oct 16 moves to Beef suya skewers. 4 go back to not chosen, because Beef suya skewers doesn’t meet their diet, and are listed first in Who hasn’t picked.]',
      go: '[Change the default]',
      done: '[The default is now Beef suya skewers. 4 are back to not chosen.]',
    });
    expect(DFW.lineGiven('Beef suya skewers', 'Friday, Oct 16', 0)).toBe(
      '[Default: Beef suya skewers. Nobody who hadn’t answered by Friday, Oct 16 has it.]',
    );
  });
});
