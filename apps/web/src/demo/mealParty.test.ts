import { describe, expect, it } from 'vitest';

import {
  type Answers,
  NO_ALLERGIES,
  changedRoute,
  SCREENS,
  clearRuledOut,
  copyAnswers,
  copyable,
  courseOf,
  dishOf,
  markOf,
  markedOpen,
  nothingSafe,
  ruledOut,
  screenAt,
  screensOf,
} from './mealParty.ts';

const dish = (course: 'starter' | 'main' | 'dessert', id: string) => {
  const one = dishOf(course, id);
  if (one == null) throw new Error(id);

  return one;
};

describe('the allergy rule on the meal step (sc-3907)', () => {
  it('rules out a dish by the allergens of theirs it contains, in Annex II order', () => {
    expect(ruledOut(dish('starter', 'canape'), ['sesame', 'peanuts'])).toEqual({
      kind: 'allergen',
      codes: ['peanuts', 'sesame'],
    });
    expect(ruledOut(dish('starter', 'pepper'), ['peanuts'])).toBeNull();
  });

  it('rules out Allergens not stated for anyone with one of the 14, and nobody else', () => {
    expect(ruledOut(dish('starter', 'gizdodo'), ['milk'])).toEqual({ kind: 'notStated' });
    expect(ruledOut(dish('starter', 'gizdodo'), [])).toBeNull();
  });

  it('finds nothing safe when every dish is ruled out', () => {
    expect(nothingSafe(courseOf('main'), ['celery', 'fish'])).toBe(true);
    expect(nothingSafe(courseOf('main'), ['fish'])).toBe(false);
  });

  it('asks person by person, course by course', () => {
    expect(SCREENS.map((one) => `${one.who} ${one.course} ${one.n}/${one.total}`)).toEqual([
      'me starter 1/3',
      'me main 2/3',
      'me dessert 3/3',
      'chidi starter 1/3',
      'chidi main 2/3',
      'chidi dessert 3/3',
    ]);
  });
});

const picked: Answers = {
  'chidi|main': { kind: 'chosen', dishId: 'egusi', by: 'guest' },
  'chidi|dessert': { kind: 'chosen', dishId: 'icecream', by: 'host' },
  'chidi|starter': { kind: 'kitchen' },
};

describe('a pick an allergy given since rules out (sc-3907)', () => {
  it('clears it going forward, keeps the rest, and keeps a pick the host made', () => {
    const result = clearRuledOut(picked, { ...NO_ALLERGIES, chidi: ['milk'] }, SCREENS);

    expect(result.answers['chidi|main']).toBeUndefined();
    expect(result.answers['chidi|starter']).toEqual({ kind: 'kitchen' });
    expect(result.answers['chidi|dessert']).toEqual(picked['chidi|dessert']);
    expect(result.cleared).toEqual({ 'chidi|main': { dishId: 'egusi', codes: ['milk'] } });
  });

  it('marks it at Check and send, never a host’s pick, and counts open rows only', () => {
    const milk = { ...NO_ALLERGIES, chidi: ['milk'] } as const;

    expect(markOf('chidi|main', picked, milk, 'en')).toBe(
      'Chidi Okonkwo-Williams is allergic to: milk.',
    );
    expect(markOf('chidi|dessert', picked, milk, 'en')).toBeNull();
    expect(markOf('chidi|main', picked, NO_ALLERGIES, 'en')).toBeNull();
    expect(markedOpen(picked, milk, () => false, 'en', SCREENS)).toEqual(['chidi|main']);
    expect(markedOpen(picked, milk, (course) => course === 'main', 'en', SCREENS)).toEqual([]);
  });

  it('walks only the people it is given, as Preview as guest does for the host alone', () => {
    const milk = { ...NO_ALLERGIES, chidi: ['milk'] } as const;
    const hostAlone = screensOf(['me']);

    expect(clearRuledOut(picked, milk, hostAlone).cleared).toEqual({});
    expect(markedOpen(picked, milk, () => false, 'en', hostAlone)).toEqual([]);
    expect(screenAt('me', 'main', hostAlone)).toBe(1);
    expect(screenAt('chidi', 'main', hostAlone)).toBe(-1);
  });
});

describe('what Same as copies (sc-17283)', () => {
  const open = () => false;
  const from: Answers = {
    'me|starter': { kind: 'chosen', dishId: 'gizdodo', by: 'host' },
    'me|main': { kind: 'kitchen' },
    'me|dessert': { kind: 'skipped' },
    'tom|starter': { kind: 'kitchen' },
  };

  it('copies a pick that can be picked, as the guest’s, and replaces what was there', () => {
    const result = copyAnswers(from, 'me', 'tom', [], open);

    expect(result.asked).toEqual([]);
    expect(result.answers['tom|starter']).toEqual({
      kind: 'chosen',
      dishId: 'gizdodo',
      by: 'guest',
    });
    expect(result.answers['tom|main']).toEqual({ kind: 'kitchen' });
    expect(result.answers['tom|dessert']).toEqual({ kind: 'skipped' });
  });

  it('asks an allergen, Allergens not stated, chef’s choice with nothing safe, and needs the host', () => {
    expect(copyAnswers(from, 'me', 'tom', ['milk'], open).asked).toEqual(['starter']);
    expect(copyAnswers(from, 'me', 'tom', ['celery', 'fish'], open).asked).toEqual([
      'starter',
      'main',
    ]);
    const host: Answers = { ...from, 'me|main': { kind: 'host' } };
    expect(copyAnswers(host, 'me', 'tom', [], open).asked).toEqual(['main']);
    expect(copyAnswers(host, 'me', 'tom', [], open).answers['tom|main']).toBeUndefined();
  });

  it('never copies onto a closed course, and stays a copy when the source changes', () => {
    const result = copyAnswers(from, 'me', 'tom', [], (course) => course === 'starter');

    expect(result.answers['tom|starter']).toEqual({ kind: 'kitchen' });
    expect(result.asked).toEqual([]);
    const changed = { ...result.answers, 'me|main': { kind: 'skipped' } } as const;
    expect(changed['tom|main']).toEqual({ kind: 'kitchen' });
    expect(copyable(undefined, courseOf('main'), [])).toBe(false);
  });
});

describe('what a Menu changed visit asks (sc-3913)', () => {
  const removed = { kind: 'changed', dish: 'Suya skewers', why: 'removed' } as const;
  const answers: Answers = {
    'me|starter': removed,
    'me|main': { kind: 'kitchen' },
    'chidi|starter': removed,
    'chidi|main': { kind: 'changed', dish: 'Sea bass', why: 'removed' },
  };

  it('walks only the changed courses that are still open, in party order', () => {
    expect(changedRoute(answers, SCREENS, () => false)).toEqual([
      screenAt('me', 'starter'),
      screenAt('chidi', 'starter'),
      screenAt('chidi', 'main'),
    ]);
    expect(changedRoute(answers, SCREENS, (course) => course === 'main')).toEqual([
      screenAt('me', 'starter'),
      screenAt('chidi', 'starter'),
    ]);
  });

  it('never copies a Menu changed answer to another person', () => {
    expect(copyable(removed, courseOf('starter'), [])).toBe(false);
  });
});
