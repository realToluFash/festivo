import { describe, expect, it } from 'vitest';

import {
  type ChoiceOption,
  choice,
  option,
  optionalSide,
  sauceChoice,
  sideChoice,
} from './dishChoices.ts';
import { childrenFold, variant } from './dishVariants.ts';
import {
  MCW,
  addedAllergens,
  answeredBy,
  asksAtFirstDish,
  changeAsks,
  choiceChange,
  pickedBy,
  pickedWithAdded,
} from './menuChange.ts';
import {
  type EvCourse,
  type EvDish,
  addedAllergenLine,
  choiceCourses,
  sampleCourses,
  variantCourses,
} from './menuCourses.ts';

const main = (courses: readonly EvCourse[]): EvCourse => courses[1] as EvCourse;
const jollof = (courses: readonly EvCourse[]): EvDish => main(courses).dishes[0] as EvDish;

describe('what a menu change asks (sc-3913)', () => {
  it('counts the people who picked a removed dish, naming the course', () => {
    const courses = sampleCourses();
    const asks = changeAsks({ kind: 'dish', courseId: 'k2', dishId: 'k2-jollof' }, courses, 48);

    expect(asks?.title).toBe('Remove Jollof rice from Main?');
    expect(asks?.count).toBe(
      '45 guests picked this dish. They’ll be asked to pick again for Main.',
    );
    expect(asks?.stays).toBe(MCW.staysAgain('Main'));
    expect(asks?.done).toBe(
      'Jollof rice removed from Main. 45 guests will be asked to pick again.',
    );
  });

  it('counts only a removed variant’s people', () => {
    const asks = changeAsks(
      { kind: 'variant', courseId: 'k2', dishId: 'k2-jollof', variantId: 'v-kids' },
      variantCourses(),
      48,
    );

    expect(asks?.title).toBe('Remove Children’s portion from Jollof rice?');
    expect(asks?.people).toBe(9);
  });

  it('asks again, for an allergen added to a dish with variants, the people on its variants', () => {
    const courses = variantCourses();
    const dish = jollof(courses);
    const next: EvDish = { ...dish, contains: ['celery', 'sesame'] };
    const asks = changeAsks(
      { kind: 'allergen', courseId: 'k2', dishId: 'k2-jollof', next },
      courses,
      48,
    );

    expect(dish.pickers).toEqual([]);
    expect(asks?.people).toBe(4);
    expect(addedAllergenLine(dish, dish.contains, next.contains)).toMatch(/^4 guests/u);
  });

  it('asks everyone coming at a course’s first dish, and only once somebody has picked', () => {
    const courses = sampleCourses();
    const bites = courses[3] as EvCourse;
    const dish = { ...jollof(courses), id: 'k4-x', pickers: [] };

    expect(asksAtFirstDish(courses, bites)).toBe(true);
    expect(asksAtFirstDish(courses, main(courses))).toBe(false);
    expect(changeAsks({ kind: 'firstDish', courseId: 'k4', dish }, courses, 48)?.count).toBe(
      'All 48 guests coming will be asked to pick for Late-night bites.',
    );

    const nobodyPicked = courses.map((one) => ({
      ...one,
      dishes: one.dishes.map((d) => ({ ...d, pickers: [] })),
    }));
    expect(asksAtFirstDish(nobodyPicked, nobodyPicked[3] as EvCourse)).toBe(false);
  });

  it('asks again, for an allergen added, only those who have it recorded, each once', () => {
    const courses = sampleCourses();
    const dish = jollof(courses);
    const added = addedAllergens(dish.contains, ['celery', 'sesame', 'peanuts']);

    expect(added).toEqual(['sesame', 'peanuts']);
    expect(pickedWithAdded(dish, added)).toHaveLength(4);
    expect(
      pickedWithAdded(dish, addedAllergens(dish.contains, ['celery', 'crustaceans'])),
    ).toHaveLength(0);
    expect(addedAllergens(dish.contains, 'none')).toEqual([]);
    expect(addedAllergens(['celery', 'sesame'], ['celery'])).toEqual([]);

    const asks = changeAsks(
      {
        kind: 'allergen',
        courseId: 'k2',
        dishId: dish.id,
        next: { ...dish, contains: ['celery', 'sesame'] },
      },
      courses,
      48,
    );
    expect(asks?.count).toBe(
      '4 guests who picked this dish have Sesame recorded. They’ll be asked to pick again for Main, and will appear in Needs the host.',
    );
  });
});

describe('who a choice or variant change asks (sc-3913)', () => {
  it('answers a choice once per guest who picked its dish, so no count passes the room', () => {
    for (const side of [sideChoice(), optionalSide()]) {
      const courses = choiceCourses([side, sauceChoice()]);

      expect(answeredBy(side)).toBe(pickedBy(jollof(courses)));
      expect(answeredBy(side)).toBeLessThanOrEqual(48);
    }
  });

  it('never counts more than answered a choice, at any pick', () => {
    const ten = Array.from({ length: 10 }, () => ['crustaceans'] as const);
    const was = choice(
      'c-two',
      'And two sides?',
      [option('c-a', 'Plantain', 'none', ten), option('c-b', 'Moi moi', ['eggs'], ten)],
      { pick: 2 },
    );
    const now = {
      ...was,
      options: [{ ...(was.options[0] as ChoiceOption), contains: ['crustaceans' as const] }],
    };

    expect(answeredBy(was)).toBe(10);
    expect(choiceChange(was, now).people).toBe(10);
  });

  const sameStarter = (dish: (pepper: EvDish) => EvDish): EvCourse[] =>
    sampleCourses().map((one) =>
      one.id === 'k1' ? { ...one, dishes: one.dishes.map((d) => dish(d)) } : one,
    );

  it('asks everyone coming only when a course everyone gets starts asking', () => {
    const starts = sameStarter((d) => d);
    const pepper = starts[0]?.dishes[0] as EvDish;
    const first = changeAsks(
      {
        kind: 'choice',
        courseId: 'k1',
        dishId: pepper.id,
        choiceId: null,
        next: { ...pepper, choices: [sideChoice(false, 'c-new')] },
      },
      starts,
      48,
    );
    expect(first?.people).toBe(48);

    const asking = sameStarter((d) => ({ ...d, choices: [sideChoice()] }));
    const asked = asking[0]?.dishes[0] as EvDish;
    const second = changeAsks(
      {
        kind: 'choice',
        courseId: 'k1',
        dishId: asked.id,
        choiceId: null,
        next: { ...asked, choices: [...(asked.choices ?? []), sauceChoice('c-new')] },
      },
      asking,
      48,
    );
    expect(second?.people).toBe(45);
    expect(second?.count).toBe(
      '45 guests answered the choices on Catfish pepper soup. They’ll be asked to pick again for Starter.',
    );
  });

  it('asks everyone coming at a second Everyone variant, and nobody at another variant after it', () => {
    const light = variant('v-light', 'Light bowl', 'everyone', ['fish', 'celery'], ['pescatarian']);
    const kids = variantCourses();
    const pepper = kids[0]?.dishes[0] as EvDish;
    const second = changeAsks(
      {
        kind: 'variantAdded',
        courseId: 'k1',
        dishId: pepper.id,
        next: { ...pepper, variants: [...childrenFold(), light] },
      },
      kids,
      48,
    );
    expect(second?.title).toBe('Add Light bowl to Catfish pepper soup?');
    expect(second?.people).toBe(48);

    const two = sameStarter((d) => ({ ...d, variants: [...childrenFold(), light] }));
    const asking = two[0]?.dishes[0] as EvDish;
    const third = variant('v-third', 'Spicy bowl', 'everyone', ['fish'], ['pescatarian']);
    expect(
      changeAsks(
        {
          kind: 'variantAdded',
          courseId: 'k1',
          dishId: asking.id,
          next: { ...asking, variants: [...(asking.variants ?? []), third] },
        },
        two,
        48,
      ),
    ).toBeNull();

    const jollofWays = jollof(kids);
    expect(
      changeAsks(
        {
          kind: 'variantAdded',
          courseId: 'k2',
          dishId: jollofWays.id,
          next: { ...jollofWays, variants: [...(jollofWays.variants ?? []), third] },
        },
        kids,
        48,
      ),
    ).toBeNull();
  });
});
