import { describe, expect, it } from 'vitest';

import { MCW, addedAllergens, asksAtFirstDish, changeAsks, pickedWithAdded } from './menuChange.ts';
import { type EvCourse, type EvDish, sampleCourses, variantCourses } from './menuCourses.ts';

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
    expect(pickedWithAdded(dish, added)).toBe(4);
    expect(pickedWithAdded(dish, addedAllergens(dish.contains, ['celery', 'crustaceans']))).toBe(0);
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
